"""
校对服务核心逻辑

提供以下功能：
- extract_quotes: 从书稿文本中提取所有引用
- verify_quote: 对单条引用进行三维度校对
- run_proofreading: 主入口，完成完整的校对流程
"""

import asyncio
import json
import logging
import os
import re
from pathlib import Path
from typing import Callable

import aiohttp

from app.config import settings

logger = logging.getLogger(__name__)

# 模型配置
MODEL_ID = "deepseek-ai/DeepSeek-V3.2"

# 硅基流动 API（OpenAI兼容格式）
API_URL = "https://api.siliconflow.cn/v1/chat/completions"

# 原文上下文上限（字符数），检索结果的硬性截断保护
SOURCE_TEXT_MAX_CHARS = 60000

# 并发校对上限
MAX_CONCURRENT_VERIFICATIONS = 2

# 分块提取最大字符数（8000字 ≈ 5300 token，加 prompt + output 远在模型上下文内）
CHUNK_MAX_CHARS = 8000

# 429重试配置
RETRY_WAIT_SECONDS = [15, 30, 45, 60]

# Prompt 文件路径
_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

# 常见中文典籍名称到拼音/别名的映射（用于匹配拼音文件名）
_BOOK_NAME_ALIASES: dict[str, list[str]] = {
    "道德经": ["dao de jing", "daodejing", "老子", "lao zi", "laozi", "道德經"],
    "老子": ["lao zi", "laozi", "dao de jing", "daodejing", "道德经", "道德經"],
    "论语": ["lun yu", "lunyu"],
    "孙子兵法": ["sun zi bing fa", "sunzi bingfa", "孙子"],
    "易经": ["yi jing", "yijing", "周易", "zhou yi", "zhouyi"],
    "周易": ["zhou yi", "zhouyi", "yi jing", "yijing", "易经"],
    "黄帝内经": ["huang di nei jing", "huangdi neijing", "内经", "素问", "灵枢"],
    "内经": ["nei jing", "neijing", "huang di nei jing", "黄帝内经"],
    "孟子": ["meng zi", "mengzi"],
    "庄子": ["zhuang zi", "zhuangzi"],
    "礼记": ["li ji", "liji"],
    "史记": ["shi ji", "shiji"],
    "伤寒论": ["shang han lun", "shanghanlun"],
    "金刚经": ["jin gang jing", "jingangjing"],
    "中庸": ["zhong yong", "zhongyong"],
    "大学": ["da xue", "daxue"],
    "管子": ["guan zi", "guanzi"],
    "淮南子": ["huai nan zi", "huainanzi"],
}


def _normalize_source_work(source_work: str) -> str:
    """
    将 source_work 归一化为基础书名。
    去除书名号、章节信息、繁简差异。
    例如：《老子·道经·第十一章》→ 老子，《道德經》→ 道德经
    """
    # 去除书名号
    name = re.sub(r"[《》「」【】\[\]〈〉]", "", source_work).strip()
    # 去除章节信息（"·" 后的部分通常是章节）
    if "·" in name:
        name = name.split("·")[0].strip()
    # 繁→简 常见替换
    name = name.replace("經", "经").replace("論", "论")
    # 去除括号内注释如 （《道德经》）
    name = re.sub(r"[（(].*?[）)]", "", name).strip()
    # 处理 "或" 分隔的多名称，取第一个
    if "或" in name:
        name = name.split("或")[0].strip()
    return name


def _match_source_work_to_file(work_clean: str, stem: str) -> bool:
    """
    判断 source_work（已归一化的中文名）是否匹配文件名 stem。
    支持中文互相包含 + 拼音匹配。
    """
    stem_lower = stem.lower()
    work_lower = work_clean.lower()

    # 1. 中文互相包含
    if work_lower in stem_lower or stem_lower in work_lower:
        return True

    # 2. 拼音匹配：查 aliases 表
    aliases = _BOOK_NAME_ALIASES.get(work_lower, [])
    for alias in aliases:
        if alias in stem_lower or stem_lower in alias:
            return True

    return False


# 引用特征正则（预过滤用）
_QUOTE_LIKELY_RE = re.compile(
    r'[""「」《》〈〉]'                        # 引号、书名号
    r'|引自|摘自|出自|所言|指出|认为|写道|提到|强调'  # 现代引用标志
    r'|曰|云|有云|有言|尝言|谓|记载|所谓'           # 古文引用标志
    r'|正如|据.*[所而]',                            # 模式匹配
    re.UNICODE,
)


def _load_prompt(filename: str) -> str:
    """从文件加载 system prompt。"""
    prompt_path = _PROMPTS_DIR / filename
    try:
        return prompt_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        logger.error("Prompt 文件不存在: %s", prompt_path)
        raise


def _get_api_key() -> str:
    return settings.siliconflow_api_key or os.environ.get("SILICONFLOW_API_KEY", "")


def _fix_invalid_escapes(text: str) -> str:
    """修复模型生成的 JSON 中非法转义序列（如 \\未知字符）。"""
    # 合法 JSON 转义: \" \\ \/ \b \f \n \r \t \uXXXX
    # 将不合法的 \X 替换为 \\X（双反斜杠）
    return re.sub(r'\\(?!["\\/bfnrtu])', r'\\\\', text)


def _parse_json_from_response(text: str) -> object:
    """
    从模型返回的文本中提取并解析 JSON。
    模型有时会在 JSON 前后添加 markdown 代码块或说明文字，此函数做容错处理。
    使用 json.JSONDecoder().raw_decode() 正确处理字符串内的括号等字符。
    """
    decoder = json.JSONDecoder()

    def _try_parse(s: str) -> object | None:
        """尝试解析，先原样再修复转义。"""
        for candidate in (s, _fix_invalid_escapes(s)):
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass
            try:
                obj, _ = decoder.raw_decode(candidate)
                return obj
            except json.JSONDecodeError:
                pass
        return None

    # 1. 直接尝试整体解析
    stripped = text.strip()
    result = _try_parse(stripped)
    if result is not None:
        return result

    # 2. 提取 ```json ... ``` 代码块
    code_block_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if code_block_match:
        block = code_block_match.group(1).strip()
        result = _try_parse(block)
        if result is not None:
            return result

    # 3. 找第一个 [ 或 { → raw_decode 解析第一个完整 JSON 值
    for marker in ("[", "{"):
        idx = text.find(marker)
        if idx != -1:
            result = _try_parse(text[idx:])
            if result is not None:
                return result

    # 4. 全部失败，抛出原始错误
    return json.loads(stripped)


async def _call_api(system_prompt: str, user_message: str, max_tokens: int = 4096) -> str:
    """
    调用硅基流动 API（OpenAI兼容格式），返回模型回复文本。
    内置 429 重试机制，最多重试4次，等待 15/30/45/60 秒。
    """
    api_key = _get_api_key()
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept-Encoding": "gzip, deflate",  # 排除 brotli，避免解码失败
    }
    payload = {
        "model": MODEL_ID,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
    }

    timeout = aiohttp.ClientTimeout(total=300)
    last_exc = None
    for attempt, wait_sec in enumerate([-1] + RETRY_WAIT_SECONDS):
        if wait_sec > 0:
            logger.warning("API 重试等待 %d 秒（第 %d 次）...", wait_sec, attempt)
            await asyncio.sleep(wait_sec)

        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    API_URL, headers=headers, json=payload, ssl=False
                ) as response:
                    if response.status == 429:
                        last_exc = Exception("429 Rate Limited")
                        continue
                    response.raise_for_status()
                    data = await response.json()

            # OpenAI 兼容格式：choices[0].message.content
            return data["choices"][0]["message"]["content"]

        except aiohttp.ClientResponseError as exc:
            if exc.status == 429:
                last_exc = exc
                continue
            raise
        except (asyncio.TimeoutError, aiohttp.ClientError) as exc:
            logger.warning("网络错误 [%s]，将重试...", type(exc).__name__)
            last_exc = exc
            continue

    raise last_exc


# 纯书名正则：《XXX》或单个书名，无实际引文内容
_BOOK_TITLE_ONLY_RE = re.compile(
    r'^[《》「」\s]*[\u4e00-\u9fff·\s]+[《》「」\s]*$'
)

# 引用文字最低有效长度（排除仅含书名等）
_MIN_QUOTE_LENGTH = 6


def _is_valid_quote(quote: dict) -> bool:
    """
    判断提取的引用是否为有效引文（非仅书名、非问题、非概括描述）。
    """
    text = quote.get("quote", "").strip()
    # 去除首尾引号
    text_bare = re.sub(r'^[""「」\'"]+|[""「」\'"]+$', '', text)

    if len(text_bare) < _MIN_QUOTE_LENGTH:
        return False

    # 纯书名如 "《道德经》"、"《黄帝内经》"
    if _BOOK_TITLE_ONLY_RE.match(text_bare):
        return False

    # 以问号结尾的通常是问题，不是引用
    if text_bare.endswith("？") or text_bare.endswith("?"):
        return False

    return True


def _format_paragraphs_for_prompt(paragraphs: list[dict]) -> str:
    """将段落列表格式化为 [段落N] 文本 字符串（与 extract_quotes_prompt 约定一致）。"""
    lines = []
    for para in paragraphs:
        idx = para.get("index", 0)
        text = para.get("text", "")
        lines.append(f"[段落{idx}] {text}")
    return "\n".join(lines)


async def map_sources_with_llm(
    source_works: list[str],
    filenames: list[str],
) -> list[dict]:
    """
    用大模型将 source_work 归一化并匹配参考文献文件。
    返回: [{"canonical_name": "道德经", "source_works": [...], "matched_file": "xxx.txt"}, ...]
    """
    if not source_works:
        return []

    system_prompt = _load_prompt("map_sources_prompt.txt")
    user_message = (
        f"source_work 列表：{json.dumps(source_works, ensure_ascii=False)}\n"
        f"参考文献文件名：{json.dumps(filenames, ensure_ascii=False)}"
    )

    try:
        raw_text = await _call_api(system_prompt, user_message, max_tokens=2048)
        logger.info("map_sources_with_llm 原始响应: %s", raw_text[:500])

        result = _parse_json_from_response(raw_text)
        if not isinstance(result, list):
            logger.warning("map_sources_with_llm 返回非列表，fallback")
            return []

        # 基本校验：每项必须有 canonical_name 和 source_works
        validated = []
        for item in result:
            if isinstance(item, dict) and "canonical_name" in item and "source_works" in item:
                # 确保 matched_file 是合法文件名或 None
                mf = item.get("matched_file")
                if mf and mf not in filenames:
                    logger.warning("LLM 返回的 matched_file '%s' 不在文件列表中，置为 null", mf)
                    item["matched_file"] = None
                validated.append(item)

        return validated

    except Exception as exc:
        logger.error("map_sources_with_llm 失败: %s, 将 fallback 到字符串匹配", exc)
        return []


def _build_source_mapping(
    source_mapping: list[dict],
) -> tuple[dict[str, str], dict[str, str]]:
    """
    将 LLM 源映射结果转换为两个查找表。

    Returns:
        (work_to_file, work_to_canonical)
        - work_to_file: source_work → 匹配的文件名（无匹配则为空串）
        - work_to_canonical: source_work → 归一化名称
    """
    work_to_file: dict[str, str] = {}
    work_to_canonical: dict[str, str] = {}

    for group in source_mapping:
        canonical = group.get("canonical_name", "")
        matched_file = group.get("matched_file") or ""
        for sw in group.get("source_works", []):
            work_to_canonical[sw] = canonical
            work_to_file[sw] = matched_file

    return work_to_file, work_to_canonical


async def extract_quotes(paragraphs: list[dict]) -> list[dict]:
    """
    从书稿段落列表中提取所有引用。

    Args:
        paragraphs: 段落列表，每项含 index/text/chapter 字段

    Returns:
        引用列表，每项包含 quote / context_before / context_after /
        author_explanation / location_hint / source_work / para_index / chapter 字段。
        若提取失败返回空列表。
    """
    system_prompt = _load_prompt("extract_quotes_prompt.txt")
    formatted = _format_paragraphs_for_prompt(paragraphs)
    user_message = f"请从以下书稿文本中提取所有引用：\n\n{formatted}"

    try:
        raw_text = await _call_api(system_prompt, user_message, max_tokens=4096)
        logger.info("extract_quotes 原始响应（前500字符）: %s", raw_text[:500])

        quotes = _parse_json_from_response(raw_text)

        if isinstance(quotes, dict):
            logger.warning("extract_quotes 返回字典结构，包装为列表")
            quotes = [quotes]
        elif not isinstance(quotes, list):
            logger.warning("extract_quotes 返回非列表结构，强制转为空列表")
            return []

        # 过滤伪引用：仅为书名、过短、或不含实际引文内容
        quotes = [q for q in quotes if _is_valid_quote(q)]

        return quotes

    except json.JSONDecodeError as exc:
        logger.error("extract_quotes JSON 解析失败: %s", exc)
        return []
    except aiohttp.ClientError as exc:
        logger.error("extract_quotes API 调用失败: [%s] %s", type(exc).__name__, exc, exc_info=True)
        return []
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("extract_quotes 未知错误: %s", exc, exc_info=True)
        return []


async def extract_quotes_per_paragraph(
    paragraphs: list[dict],
    log_callback: Callable | None = None,
) -> list[dict]:
    """
    逐段提取引用。

    先用正则预过滤不含引用特征的段落，再逐段调用 API 提取引用，
    使用信号量控制并发数，合并所有结果。
    """
    # 预过滤：只保留含引用特征的段落
    filtered = [p for p in paragraphs if _QUOTE_LIKELY_RE.search(p.get("text", ""))]
    if not filtered:
        if log_callback:
            log_callback("预过滤：未发现含引用特征的段落，跳过提取")
        return []

    if log_callback:
        log_callback(f"预过滤：{len(paragraphs)} 段落 → {len(filtered)} 段落含引用特征")

    semaphore = asyncio.Semaphore(MAX_CONCURRENT_VERIFICATIONS)
    total = len(filtered)
    completed = 0

    async def extract_single(para: dict, idx: int) -> list[dict]:
        nonlocal completed
        async with semaphore:
            result = await extract_quotes([para])
            completed += 1
            if log_callback and (completed % 10 == 0 or completed == total):
                log_callback(f"逐段提取进度：{completed}/{total}")
            return result

    tasks = [extract_single(p, i) for i, p in enumerate(filtered)]
    results_nested = await asyncio.gather(*tasks)

    all_quotes: list[dict] = []
    for r in results_nested:
        all_quotes.extend(r)

    return all_quotes


def group_quotes_by_source(quotes: list[dict]) -> dict[str, list[dict]]:
    """按 source_work 字段对引用进行分组。"""
    groups: dict[str, list[dict]] = {}
    for q in quotes:
        key = q.get("source_work", "").strip() or "未知来源"
        groups.setdefault(key, []).append(q)
    return groups


def _find_source_text_for_work(
    source_work: str,
    source_texts: dict[str, str],
) -> str:
    """
    根据 source_work 名称从已上传原文中模糊匹配对应文本。
    支持中文互相包含 + 拼音文件名匹配。
    """
    if not source_work.strip():
        # 无指定来源，使用第一个原文
        if source_texts:
            return next(iter(source_texts.values()))
        return ""

    work_clean = _normalize_source_work(source_work)
    for fname, text in source_texts.items():
        stem = re.sub(r"[《》「」【】\[\]]", "", Path(fname).stem)
        if _match_source_work_to_file(work_clean, stem):
            return text

    return ""


def _detect_missing_sources(
    quotes: list[dict],
    source_texts: dict[str, str],
) -> list[dict]:
    """
    检测引用中提到的文献是否已上传原文。

    通过模糊匹配 source_work 字段（去书名号后）与 source_texts 的文件名进行比较。
    返回未上传的文献列表，格式：[{"source_work": "《论语》", "quote_count": N}]
    """
    # 统计每部文献的引用数
    source_work_counts: dict[str, int] = {}
    for q in quotes:
        sw = q.get("source_work", "").strip()
        if sw:
            source_work_counts[sw] = source_work_counts.get(sw, 0) + 1

    if not source_work_counts:
        return []

    # 构建已上传文件名 stem 列表
    uploaded_stems = []
    for fname in source_texts.keys():
        stem = re.sub(r"[《》「」【】\[\]]", "", Path(fname).stem)
        uploaded_stems.append(stem)

    missing = []
    for source_work, count in source_work_counts.items():
        work_clean = _normalize_source_work(source_work)
        found = any(
            _match_source_work_to_file(work_clean, stem)
            for stem in uploaded_stems
        )
        if not found:
            missing.append({"source_work": source_work, "quote_count": count})

    return missing


def _detect_missing_sources_from_mapping(
    source_mapping: list[dict],
    quotes: list[dict],
    work_to_file: dict[str, str],
    work_to_canonical: dict[str, str],
) -> list[dict]:
    """
    基于 LLM 映射结果检测未上传原文的文献。
    matched_file 为空的归一化组即为缺失。
    返回: [{"source_work": "论语", "quote_count": N}]
    """
    # 统计每个归一化名称的引用数
    canonical_counts: dict[str, int] = {}
    for q in quotes:
        sw = q.get("source_work", "").strip()
        if sw:
            canonical = work_to_canonical.get(sw, sw)
            canonical_counts[canonical] = canonical_counts.get(canonical, 0) + 1

    # 找出无匹配文件的归一化组
    matched_canonicals = set()
    for sw, fname in work_to_file.items():
        if fname:
            matched_canonicals.add(work_to_canonical.get(sw, sw))

    missing = []
    for canonical, count in canonical_counts.items():
        if canonical not in matched_canonicals:
            missing.append({"source_work": canonical, "quote_count": count})

    return missing


def _normalize_verify_result(raw: dict, para_info: dict) -> dict:
    """
    将模型返回的嵌套校对结果映射为前端期望的平铺字段格式。
    """
    has_issue = raw.get("has_issue")

    # 判断 verdict
    if has_issue is True:
        verdict = "有问题"
    elif has_issue is False:
        verdict = "通过"
    else:
        verdict = "校对失败"

    return {
        # 核心引用字段
        "quote": raw.get("quote", ""),
        "source_work": raw.get("source_work", para_info.get("source_work", "")),
        "quote_location": raw.get("location_hint", para_info.get("location_hint", "")),
        "context_before": para_info.get("context_before", ""),
        "context_after": para_info.get("context_after", ""),
        # 三维度字段（平铺）
        "text_accurate": raw.get("text_accuracy", {}).get("is_accurate"),
        "text_issues": raw.get("text_accuracy", {}).get("issues", ""),
        "source_match": raw.get("text_accuracy", {}).get("original_text", ""),
        "explanation_consistent": raw.get("interpretation_accuracy", {}).get("is_accurate"),
        "explanation_issues": raw.get("interpretation_accuracy", {}).get("issues", ""),
        "context_appropriate": raw.get("context_appropriateness", {}).get("is_appropriate"),
        "context_issues": raw.get("context_appropriateness", {}).get("issues", ""),
        "summary": raw.get("overall_suggestion", ""),
        # 状态字段
        "has_issue": has_issue,
        "verdict": verdict,
        "confidence": raw.get("confidence"),
        # 位置信息
        "chapter": para_info.get("chapter", raw.get("chapter", "")),
        "estimated_page": para_info.get("estimated_page"),
        # 错误信息（若有）
        "error": raw.get("error"),
    }


async def verify_quote(quote_info: dict, source_text: str) -> dict:
    """
    对单条引用进行三维度校对（文字准确性、解释一致性、上下文相符性）。

    Args:
        quote_info: 引用信息字典，包含 quote / context_before / context_after /
                    author_explanation / location_hint 字段
        source_text: 被引用文献原文（自动截取前 SOURCE_TEXT_MAX_CHARS 字符）

    Returns:
        校对结果字典（已通过 _normalize_verify_result 映射为平铺格式）。
        若校对失败返回包含错误信息的字典。
    """
    from app.services.text_retriever import retrieve_relevant_context

    system_prompt = _load_prompt("verify_quote_prompt.txt")

    # 从全文中检索与引用最相关的段落（替代此前的暴力截断）
    relevant_source = retrieve_relevant_context(
        quote_text=quote_info.get("quote", ""),
        source_text=source_text,
        location_hint=quote_info.get("location_hint", ""),
    )
    logger.info(
        "原文 %d 字符 → 检索后 %d 字符",
        len(source_text),
        len(relevant_source),
    )

    quote_text = quote_info.get("quote", "")
    author_explanation = quote_info.get("author_explanation", "")
    context_before = quote_info.get("context_before", "")
    context_after = quote_info.get("context_after", "")

    user_message = (
        "请对以下引用进行校对：\n\n"
        f"【引用文字】\n{quote_text}\n\n"
        f"【作者解释】\n{author_explanation if author_explanation else '（无明确解释）'}\n\n"
        f"【引用前文】\n{context_before if context_before else '（无前文）'}\n\n"
        f"【引用后文】\n{context_after if context_after else '（无后文）'}\n\n"
        f"【原文内容】\n{relevant_source}"
    )

    try:
        raw_text = await _call_api(system_prompt, user_message, max_tokens=2048)
        logger.debug("verify_quote 原始响应（引用：%s…）: %s", quote_text[:30], raw_text[:500])

        result = _parse_json_from_response(raw_text)

        if not isinstance(result, dict):
            raise ValueError("返回结果不是字典结构")

        # 确保 quote 字段存在
        result.setdefault("quote", quote_text)
        return _normalize_verify_result(result, quote_info)

    except json.JSONDecodeError as exc:
        logger.error("verify_quote JSON 解析失败（引用：%s…）: %s", quote_text[:30], exc)
        return _normalize_verify_result(_make_error_result(quote_text, f"JSON 解析失败: {exc}"), quote_info)
    except aiohttp.ClientError as exc:
        logger.error("verify_quote API 调用失败（引用：%s…）: %s", quote_text[:30], exc)
        return _normalize_verify_result(_make_error_result(quote_text, f"API 调用失败: {exc}"), quote_info)
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("verify_quote 未知错误（引用：%s…）: %s", quote_text[:30], exc, exc_info=True)
        return _normalize_verify_result(_make_error_result(quote_text, f"校对过程出错: {exc}"), quote_info)


def _make_error_result(quote_text: str, error_message: str) -> dict:
    """构造校对失败时的兜底原始结果。"""
    return {
        "quote": quote_text,
        "has_issue": None,
        "error": error_message,
        "text_accuracy": {
            "is_accurate": None,
            "issues": "校对失败，无法判断",
            "original_text": "",
        },
        "interpretation_accuracy": {
            "is_accurate": None,
            "issues": "校对失败，无法判断",
            "suggestion": "",
        },
        "context_appropriateness": {
            "is_appropriate": None,
            "issues": "校对失败，无法判断",
            "suggestion": "",
        },
        "overall_suggestion": f"校对过程发生错误：{error_message}",
    }


async def run_proofreading(
    paragraphs: list[dict],
    source_texts: dict[str, str],
    log_callback: Callable | None = None,
) -> dict:
    """
    完整校对流程主入口：预过滤 → 分块提取引用 → 检测缺失原文 → 并发校对 → 聚合结果。

    Args:
        paragraphs: 书稿段落列表（来自 parse_manuscript_structured）
        source_texts: 已上传原文字典 {filename: text}，支持多原文
        log_callback: 可选日志回调，接受一个字符串参数

    Returns:
        完整校对报告，格式：
        {
            "quotes_total": N,
            "issues_count": N,
            "error_count": N,
            "missing_sources": [...],
            "results": [...]
        }
    """
    def log(msg: str) -> None:
        logger.info(msg)
        if log_callback:
            log_callback(msg)

    log("开始校对流程：逐段提取引用...")

    # 步骤 1：逐段提取引用
    quotes = await extract_quotes_per_paragraph(paragraphs, log_callback=log)
    quotes_total = len(quotes)
    log(f"共提取到 {quotes_total} 条引用")

    if quotes_total == 0:
        return {
            "quotes_total": 0,
            "issues_count": 0,
            "error_count": 0,
            "missing_sources": [],
            "results": [],
        }

    # 步骤 2：LLM 源映射（归一化 + 匹配参考文献）
    unique_works = list({q.get("source_work", "").strip() for q in quotes if q.get("source_work", "").strip()})
    filenames = list(source_texts.keys())
    log(f"LLM 源映射：{len(unique_works)} 个来源名称，{len(filenames)} 个参考文献文件")

    source_mapping = await map_sources_with_llm(unique_works, filenames)

    if source_mapping:
        work_to_file, work_to_canonical = _build_source_mapping(source_mapping)
        log(f"LLM 源映射成功：归为 {len(source_mapping)} 组")
        for group in source_mapping:
            mf = group.get('matched_file') or '(无匹配文件)'
            log(f"  {group['canonical_name']}: {group['source_works']} → {mf}")
    else:
        # Fallback 到字符串匹配
        log("LLM 源映射失败，回退到字符串匹配")
        work_to_file = {}
        work_to_canonical = {}
        for sw in unique_works:
            work_to_canonical[sw] = _normalize_source_work(sw)
            source_text = _find_source_text_for_work(sw, source_texts)
            if source_text:
                # 反查文件名
                for fname, text in source_texts.items():
                    if text == source_text:
                        work_to_file[sw] = fname
                        break

    # 步骤 3：按归一化名称分组
    source_groups: dict[str, list[dict]] = {}
    for q in quotes:
        sw = q.get("source_work", "").strip()
        canonical = work_to_canonical.get(sw, sw or "未知来源")
        source_groups.setdefault(canonical, []).append(q)
    log(f"引用按来源分组：共 {len(source_groups)} 个来源")

    # 步骤 3.5：检测缺失原文（基于映射结果）
    missing_sources = _detect_missing_sources_from_mapping(source_mapping, quotes, work_to_file, work_to_canonical)
    if missing_sources:
        missing_names = "、".join(m["source_work"] for m in missing_sources)
        log(f"[警告] 以下文献未上传原文：{missing_names}")

    # 步骤 4：按组校对（用映射表直接查文件）
    log(f"开始按来源分组校对（最多 {MAX_CONCURRENT_VERIFICATIONS} 并发）...")
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_VERIFICATIONS)
    verified_count = 0

    def _make_no_source_result(quote_info: dict) -> dict:
        return {
            **quote_info,
            "verdict": "原文未上传",
            "has_issue": None,
            "text_accurate": None,
            "explanation_consistent": None,
            "context_appropriate": None,
            "summary": "未上传对应文献原文，无法校对",
            "confidence": None,
            "chapter": quote_info.get("chapter", ""),
            "estimated_page": None,
            "source_match": "",
            "text_issues": "",
            "explanation_issues": "",
            "context_issues": "",
            "error": None,
        }

    async def verify_with_semaphore(quote_info: dict, source_text: str) -> dict:
        nonlocal verified_count
        async with semaphore:
            result = await verify_quote(quote_info, source_text)
            verified_count += 1
            if verified_count % 5 == 0 or verified_count == quotes_total:
                log(f"校对进度：{verified_count}/{quotes_total}")
            return result

    all_results: list[dict] = []
    for canonical_name, group in source_groups.items():
        # 从组内任一 source_work 查到对应文件名
        matched_file = None
        for q in group:
            sw = q.get("source_work", "").strip()
            f = work_to_file.get(sw)
            if f:
                matched_file = f
                break
        source_text = source_texts.get(matched_file, "") if matched_file else ""
        if not source_text:
            all_results.extend(_make_no_source_result(q) for q in group)
            continue
        log(f"校对来源「{canonical_name}」：{len(group)} 条引用")
        tasks = [verify_with_semaphore(q, source_text) for q in group]
        group_results = await asyncio.gather(*tasks, return_exceptions=False)
        all_results.extend(group_results)

    # 步骤 5：汇总统计
    issues_count = 0
    error_count = 0
    for result in all_results:
        if result.get("has_issue") is True:
            issues_count += 1
        elif result.get("has_issue") is None and result.get("verdict") != "原文未上传":
            error_count += 1

    log(
        f"校对完成：共 {quotes_total} 条引用，{issues_count} 条存在问题，"
        f"{error_count} 条校对失败"
    )

    return {
        "quotes_total": quotes_total,
        "issues_count": issues_count,
        "error_count": error_count,
        "missing_sources": missing_sources,
        "results": all_results,
    }

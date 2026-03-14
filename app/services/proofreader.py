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

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# 模型配置
MODEL_ID = "deepseek-ai/DeepSeek-V3.2"

# 硅基流动 API（OpenAI兼容格式）
API_URL = "https://api.siliconflow.cn/v1/chat/completions"

# 原文截取上限（字符数），避免超出上下文窗口
SOURCE_TEXT_MAX_CHARS = 20000

# 并发校对上限
MAX_CONCURRENT_VERIFICATIONS = 8

# 分块提取最大字符数
CHUNK_MAX_CHARS = 1500

# 429重试配置
RETRY_WAIT_SECONDS = [15, 30, 45, 60]

# Prompt 文件路径
_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

# 引用特征正则（预过滤用）
_QUOTE_LIKELY_RE = re.compile(
    r'[""「」《》]|引自|摘自|出自|所言|指出|认为|写道', re.UNICODE
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


def _parse_json_from_response(text: str) -> object:
    """
    从模型返回的文本中提取并解析 JSON。
    模型有时会在 JSON 前后添加 markdown 代码块或说明文字，此函数做容错处理。
    """
    # 尝试提取 ```json ... ``` 代码块
    code_block_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if code_block_match:
        json_str = code_block_match.group(1).strip()
    else:
        # 尝试直接找到最外层的 [ 或 { 开始的 JSON 结构
        array_match = re.search(r"(\[[\s\S]*\])", text)
        obj_match = re.search(r"(\{[\s\S]*\})", text)

        if array_match and (not obj_match or array_match.start() <= obj_match.start()):
            json_str = array_match.group(1)
        elif obj_match:
            json_str = obj_match.group(1)
        else:
            json_str = text.strip()

    return json.loads(json_str)


async def _call_api(system_prompt: str, user_message: str, max_tokens: int = 4096) -> str:
    """
    调用硅基流动 API（OpenAI兼容格式），返回模型回复文本。
    内置 429 重试机制，最多重试4次，等待 15/30/45/60 秒。
    """
    api_key = _get_api_key()
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": MODEL_ID,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
    }

    last_exc = None
    for attempt, wait_sec in enumerate([-1] + RETRY_WAIT_SECONDS):
        if wait_sec > 0:
            logger.warning("API 429 限流，等待 %d 秒后重试（第 %d 次）...", wait_sec, attempt)
            await asyncio.sleep(wait_sec)

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(API_URL, headers=headers, json=payload)
                if response.status_code == 429:
                    last_exc = httpx.HTTPStatusError(
                        f"429 Rate Limited", request=response.request, response=response
                    )
                    continue
                response.raise_for_status()
                data = response.json()

            # OpenAI 兼容格式：choices[0].message.content
            return data["choices"][0]["message"]["content"]

        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 429:
                last_exc = exc
                continue
            raise
        except Exception:
            raise

    raise last_exc


def _format_paragraphs_for_prompt(paragraphs: list[dict]) -> str:
    """将段落列表格式化为 [段落N] 文本 字符串（与 extract_quotes_prompt 约定一致）。"""
    lines = []
    for para in paragraphs:
        idx = para.get("index", 0)
        text = para.get("text", "")
        lines.append(f"[段落{idx}] {text}")
    return "\n".join(lines)


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
        logger.debug("extract_quotes 原始响应: %s", raw_text[:500])

        quotes = _parse_json_from_response(raw_text)

        if not isinstance(quotes, list):
            logger.warning("extract_quotes 返回非列表结构，强制转为空列表")
            return []

        return quotes

    except json.JSONDecodeError as exc:
        logger.error("extract_quotes JSON 解析失败: %s", exc)
        return []
    except httpx.HTTPError as exc:
        logger.error("extract_quotes API 调用失败: %s", exc)
        return []
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("extract_quotes 未知错误: %s", exc, exc_info=True)
        return []


async def extract_quotes_chunked(
    paragraphs: list[dict],
    log_callback: Callable | None = None,
) -> list[dict]:
    """
    分块并发提取引用。

    先用正则预过滤不含引用特征的段落，再将剩余段落按 CHUNK_MAX_CHARS 分块，
    最大 MAX_CONCURRENT_VERIFICATIONS 并发提取，合并结果。
    """
    # 预过滤：只保留含引用特征的段落
    filtered = [p for p in paragraphs if _QUOTE_LIKELY_RE.search(p.get("text", ""))]
    if not filtered:
        if log_callback:
            log_callback("预过滤：未发现含引用特征的段落，跳过提取")
        return []

    if log_callback:
        log_callback(f"预过滤：{len(paragraphs)} 段落 → {len(filtered)} 段落含引用特征")

    # 按字符数分块
    chunks: list[list[dict]] = []
    current_chunk: list[dict] = []
    current_chars = 0
    for para in filtered:
        text_len = len(para.get("text", ""))
        if current_chars + text_len > CHUNK_MAX_CHARS and current_chunk:
            chunks.append(current_chunk)
            current_chunk = []
            current_chars = 0
        current_chunk.append(para)
        current_chars += text_len
    if current_chunk:
        chunks.append(current_chunk)

    if log_callback:
        log_callback(f"分块提取：共 {len(chunks)} 块，最大 {MAX_CONCURRENT_VERIFICATIONS} 并发")

    semaphore = asyncio.Semaphore(MAX_CONCURRENT_VERIFICATIONS)

    async def extract_chunk(chunk: list[dict], chunk_idx: int) -> list[dict]:
        async with semaphore:
            if log_callback:
                log_callback(f"正在提取第 {chunk_idx + 1}/{len(chunks)} 块引用...")
            result = await extract_quotes(chunk)
            if log_callback:
                log_callback(f"第 {chunk_idx + 1}/{len(chunks)} 块完成，提取到 {len(result)} 条引用")
            return result

    tasks = [extract_chunk(chunk, i) for i, chunk in enumerate(chunks)]
    results_nested = await asyncio.gather(*tasks)

    all_quotes: list[dict] = []
    for r in results_nested:
        all_quotes.extend(r)

    return all_quotes


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

    # 构建已上传文件名集合（去除扩展名和路径，转小写）
    uploaded_names = set()
    for fname in source_texts.keys():
        stem = Path(fname).stem.lower()
        # 去书名号后的名称也加入
        stem_clean = re.sub(r"[《》「」【】\[\]]", "", stem)
        uploaded_names.add(stem)
        uploaded_names.add(stem_clean)

    missing = []
    for source_work, count in source_work_counts.items():
        # 去书名号后进行模糊匹配
        work_clean = re.sub(r"[《》「」【】\[\]]", "", source_work).lower()
        # 检查是否有上传文件名包含该文献名，或文献名包含上传文件名
        found = any(
            work_clean in name or name in work_clean
            for name in uploaded_names
            if name
        )
        if not found:
            missing.append({"source_work": source_work, "quote_count": count})

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
    system_prompt = _load_prompt("verify_quote_prompt.txt")

    # 截取原文，避免超出上下文窗口
    truncated_source = source_text[:SOURCE_TEXT_MAX_CHARS]
    if len(source_text) > SOURCE_TEXT_MAX_CHARS:
        logger.info(
            "原文超过 %d 字符，已截取前 %d 字符进行校对",
            SOURCE_TEXT_MAX_CHARS,
            SOURCE_TEXT_MAX_CHARS,
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
        f"【原文内容】\n{truncated_source}"
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
    except httpx.HTTPError as exc:
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

    log("开始校对流程：分块提取引用...")

    # 步骤 1：分块并发提取引用
    quotes = await extract_quotes_chunked(paragraphs, log_callback=log)
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

    # 步骤 2：检测缺失原文
    missing_sources = _detect_missing_sources(quotes, source_texts)
    if missing_sources:
        missing_names = "、".join(m["source_work"] for m in missing_sources)
        log(f"[警告] 以下文献未上传原文：{missing_names}")

    # 步骤 3：并发校对（使用信号量限制并发数）
    log(f"开始并发校对（最多 {MAX_CONCURRENT_VERIFICATIONS} 并发）...")
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_VERIFICATIONS)

    # 为每条引用找到对应的原文
    def _find_source_text(quote: dict) -> str:
        source_work = quote.get("source_work", "").strip()
        if not source_work:
            # 无指定来源，使用第一个原文
            if source_texts:
                return next(iter(source_texts.values()))
            return ""

        # 去书名号后模糊匹配
        work_clean = re.sub(r"[《》「」【】\[\]]", "", source_work).lower()
        for fname, text in source_texts.items():
            stem = re.sub(r"[《》「」【】\[\]]", "", Path(fname).stem.lower())
            if work_clean in stem or stem in work_clean:
                return text

        # 未匹配到对应原文
        return ""

    verified_count = 0

    async def verify_with_semaphore(quote_info: dict, idx: int) -> dict:
        nonlocal verified_count
        async with semaphore:
            source_text = _find_source_text(quote_info)
            if not source_text:
                # 无对应原文，标记为"原文未上传"
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
            result = await verify_quote(quote_info, source_text)
            verified_count += 1
            if verified_count % 5 == 0 or verified_count == quotes_total:
                log(f"校对进度：{verified_count}/{quotes_total}")
            return result

    tasks = [verify_with_semaphore(q, i) for i, q in enumerate(quotes)]
    results = await asyncio.gather(*tasks, return_exceptions=False)

    # 步骤 4：汇总统计
    issues_count = 0
    error_count = 0
    for result in results:
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
        "results": list(results),
    }

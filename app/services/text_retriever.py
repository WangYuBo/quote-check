"""
原文段落检索模块

基于字符 n-gram 的滑动窗口检索：从大规模参考原文中定位与引用最相关的段落。
零外部依赖，纯 Python 标准库实现。

典型用法：
    context = retrieve_relevant_context(
        quote_text="惚兮恍兮，其中有象",
        source_text=full_source_million_chars,
        location_hint="第二十一章",
    )
"""

import re
from collections import Counter

# CJK 停用词（高频虚词，对检索无区分度）
_CJK_STOPWORDS = frozenset(
    "之的是而以其不也者于则为与乎故了在有人这那个上下中大小"
    "所可如此已矣焉哉兮若夫且"
)

# CJK 字符范围正则
_CJK_RE = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf]+")

# n-gram 大小
_NGRAM_SIZES = (2, 3, 4)

# 默认参数
_DEFAULT_WINDOW_CHARS = 8000
_DEFAULT_STRIDE_RATIO = 0.5
_DEFAULT_MAX_CONTEXT = 15000
_DEFAULT_TOP_K = 2
_MIN_SCORE_THRESHOLD = 2  # 至少命中 2 个不同搜索词才算有效


def _extract_search_terms(text: str) -> list[str]:
    """从引用文字中提取搜索用的字符 n-gram。

    对中文文本生成 2/3/4-gram，去除含停用词的 gram 和重复项。
    返回去重后的搜索词列表。
    """
    # 提取所有 CJK 字符片段
    cjk_segments = _CJK_RE.findall(text)
    cjk_text = "".join(cjk_segments)

    if not cjk_text:
        # 非中文文本，按空格分词
        words = [w for w in text.split() if len(w) >= 2]
        return list(dict.fromkeys(words))  # 去重保序

    terms: list[str] = []
    seen: set[str] = set()

    for n in _NGRAM_SIZES:
        for i in range(len(cjk_text) - n + 1):
            gram = cjk_text[i : i + n]
            # 跳过全由停用词组成的 gram
            if all(ch in _CJK_STOPWORDS for ch in gram):
                continue
            if gram not in seen:
                seen.add(gram)
                terms.append(gram)

    return terms


def _score_window(
    window_text: str,
    terms: list[str],
    location_hint: str = "",
) -> tuple[int, int, bool]:
    """为一个文本窗口打分。

    Returns:
        (distinct_matches, total_matches, has_location_hint)
    """
    distinct = 0
    total = 0
    for term in terms:
        count = window_text.count(term)
        if count > 0:
            distinct += 1
            total += count

    has_hint = bool(location_hint and location_hint in window_text)
    return (distinct, total, has_hint)


def retrieve_relevant_context(
    quote_text: str,
    source_text: str,
    location_hint: str = "",
    window_chars: int = _DEFAULT_WINDOW_CHARS,
    max_context_chars: int = _DEFAULT_MAX_CONTEXT,
    top_k: int = _DEFAULT_TOP_K,
) -> str:
    """从大规模原文中检索与引用最相关的段落。

    Args:
        quote_text: 待校对的引用文字
        source_text: 完整的参考原文（可达百万字）
        location_hint: 位置提示（如"第二十一章"），用于加权
        window_chars: 滑动窗口大小（字符数）
        max_context_chars: 返回结果的最大字符数
        top_k: 取得分最高的前 k 个窗口

    Returns:
        检索到的相关原文段落。若无有效匹配，回退返回原文开头。
    """
    source_len = len(source_text)

    # 短文本直接返回
    if source_len <= max_context_chars:
        return source_text

    # 提取搜索词
    terms = _extract_search_terms(quote_text)
    if not terms:
        return source_text[:max_context_chars]

    # 滑动窗口扫描
    stride = max(1, int(window_chars * _DEFAULT_STRIDE_RATIO))
    windows: list[tuple[int, int, int, int, bool]] = []
    # (start, end, distinct, total, has_hint)

    pos = 0
    while pos < source_len:
        end = min(pos + window_chars, source_len)
        window_text = source_text[pos:end]
        distinct, total, has_hint = _score_window(window_text, terms, location_hint)
        windows.append((pos, end, distinct, total, has_hint))
        if end >= source_len:
            break
        pos += stride

    # 排序：优先 location_hint 匹配 > distinct 匹配数 > total 匹配数
    windows.sort(key=lambda w: (w[4], w[2], w[3]), reverse=True)

    # 取 top_k
    top_windows = windows[:top_k]

    # 检查是否有有效匹配
    best_distinct = top_windows[0][2] if top_windows else 0
    if best_distinct < _MIN_SCORE_THRESHOLD:
        # 无有效匹配，回退
        return source_text[:max_context_chars]

    # 合并重叠窗口
    spans = sorted([(w[0], w[1]) for w in top_windows])
    merged = _merge_spans(spans)

    # 截取并拼接
    parts: list[str] = []
    total_chars = 0
    for start, end in merged:
        remaining = max_context_chars - total_chars
        if remaining <= 0:
            break
        chunk = source_text[start : min(end, start + remaining)]
        parts.append(chunk)
        total_chars += len(chunk)

    return "\n\n---\n\n".join(parts)


def _merge_spans(spans: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """合并重叠或相邻的区间。"""
    if not spans:
        return []

    merged: list[tuple[int, int]] = [spans[0]]
    for start, end in spans[1:]:
        prev_start, prev_end = merged[-1]
        if start <= prev_end:
            # 重叠或相邻，合并
            merged[-1] = (prev_start, max(prev_end, end))
        else:
            merged.append((start, end))

    return merged

"""
text_retriever 模块的单元测试。

使用 tests/sample_data/ 中的道德经原文和书稿样本进行验证。
"""

from pathlib import Path

import pytest

from app.services.text_retriever import (
    _extract_search_terms,
    _merge_spans,
    retrieve_relevant_context,
)

_SAMPLE_DIR = Path(__file__).parent / "sample_data"


@pytest.fixture
def source_text() -> str:
    """加载道德经原文样本。"""
    return (_SAMPLE_DIR / "source_sample.md").read_text(encoding="utf-8")


@pytest.fixture
def large_source(source_text: str) -> str:
    """构造一个足够大的原文（重复 + 填充），模拟大规模参考文献。"""
    # 在原文前后各填充大量无关文字，确保原文不在开头
    padding = "这是一段无关的填充文字，用于模拟大规模文献中的非相关内容。" * 500
    return padding + "\n\n" + source_text + "\n\n" + padding


# ---- _extract_search_terms ----


def test_extract_terms_chinese():
    terms = _extract_search_terms("道可道，非常道")
    assert len(terms) > 0
    # 应包含 "道可" "可道" "非常" "常道" 等 bigram
    assert "道可" in terms
    assert "非常" in terms


def test_extract_terms_filters_stopwords():
    terms = _extract_search_terms("之的是而以其")
    # 全为停用词，应无 n-gram 生成
    assert len(terms) == 0


def test_extract_terms_empty():
    assert _extract_search_terms("") == []


# ---- _merge_spans ----


def test_merge_overlapping():
    assert _merge_spans([(0, 100), (50, 150)]) == [(0, 150)]


def test_merge_non_overlapping():
    assert _merge_spans([(0, 100), (200, 300)]) == [(0, 100), (200, 300)]


def test_merge_adjacent():
    assert _merge_spans([(0, 100), (100, 200)]) == [(0, 200)]


def test_merge_empty():
    assert _merge_spans([]) == []


# ---- retrieve_relevant_context ----


def test_retrieve_chapter_1(source_text: str):
    """'道可道，非常道' 应该能在原文中定位到第一章。"""
    result = retrieve_relevant_context("道可道，非常道", source_text)
    assert "道可道" in result
    assert "非常道" in result


def test_retrieve_chapter_8(source_text: str):
    """'上善若水' 应该能定位到第八章。"""
    result = retrieve_relevant_context("上善若水", source_text)
    assert "上善若水" in result
    assert "水善利万物而不争" in result


def test_retrieve_chapter_21(source_text: str):
    """'惚兮恍兮，其中有象' 应该能定位到第二十一章。"""
    result = retrieve_relevant_context("惚兮恍兮，其中有象", source_text)
    assert "惚兮恍兮" in result
    assert "其中有象" in result


def test_retrieve_short_source():
    """短文本（小于 max_context_chars）应直接返回全文。"""
    short = "道可道，非常道。名可名，非常名。"
    result = retrieve_relevant_context("道可道", short)
    assert result == short


def test_retrieve_no_match(large_source: str):
    """完全无关的查询应回退返回原文开头。"""
    result = retrieve_relevant_context(
        "量子纠缠与超导体",
        large_source,
        max_context_chars=500,
    )
    # 回退行为：返回原文开头
    assert len(result) <= 500
    assert result == large_source[:500]


def test_retrieve_from_large_source(large_source: str):
    """在大规模原文中，应能正确定位到目标段落（而非返回开头的填充）。"""
    result = retrieve_relevant_context(
        "上善若水。水善利万物而不争",
        large_source,
    )
    assert "上善若水" in result
    # 不应返回开头的填充文字
    assert "这是一段无关的填充文字" not in result or "上善若水" in result


def test_retrieve_with_location_hint(large_source: str):
    """location_hint 应帮助定位到正确章节。"""
    result = retrieve_relevant_context(
        "其中有象",
        large_source,
        location_hint="第二十一章",
    )
    assert "惚兮恍兮" in result


def test_retrieve_max_context_respected(large_source: str):
    """返回结果不应超过 max_context_chars。"""
    result = retrieve_relevant_context(
        "道可道",
        large_source,
        max_context_chars=1000,
    )
    assert len(result) <= 1000

"""
Edge case tests for _detect_missing_sources.
"""
import pytest
from app.services.proofreader import _detect_missing_sources


def test_multiple_quotes_same_missing_source():
    """Multiple quotes from same missing source should show combined count."""
    quotes = [
        {"source_work": "《史记》"},
        {"source_work": "《史记》"},
        {"source_work": "《史记》"},
    ]
    missing = _detect_missing_sources(quotes, {})
    assert len(missing) == 1
    assert missing[0]["quote_count"] == 3


def test_partial_match_filename_contains_work():
    """Filename containing work name should count as found."""
    quotes = [{"source_work": "《周易》"}]
    source_texts = {"周易_王弼注.txt": "content"}
    missing = _detect_missing_sources(quotes, source_texts)
    assert missing == []


def test_partial_match_work_contains_filename():
    """Work name containing filename stem should count as found."""
    quotes = [{"source_work": "《论语·学而篇》"}]
    source_texts = {"论语.txt": "content"}
    missing = _detect_missing_sources(quotes, source_texts)
    assert missing == []


def test_empty_source_texts_all_missing():
    """When no source files uploaded, all unique sources should be missing."""
    quotes = [
        {"source_work": "《论语》"},
        {"source_work": "《孟子》"},
        {"source_work": "《论语》"},
    ]
    missing = _detect_missing_sources(quotes, {})
    works = {m["source_work"] for m in missing}
    assert "《论语》" in works
    assert "《孟子》" in works
    assert sum(m["quote_count"] for m in missing if m["source_work"] == "《论语》") == 2


def test_case_insensitive_match():
    """Match should be case-insensitive for filenames."""
    quotes = [{"source_work": "《Analects》"}]
    source_texts = {"analects.txt": "content"}
    missing = _detect_missing_sources(quotes, source_texts)
    assert missing == []


def test_no_source_work_field():
    """Quotes without source_work field should be ignored."""
    quotes = [{"quote": "some quote without source"}]
    missing = _detect_missing_sources(quotes, {})
    assert missing == []

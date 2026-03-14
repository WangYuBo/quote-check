"""
Tests for proofreader service - covers 429 retry, field mapping, missing source detection.
"""
import asyncio
import json
import pytest
import httpx

# Test _normalize_verify_result field mapping
def test_normalize_verify_result_has_issue():
    from app.services.proofreader import _normalize_verify_result
    raw = {
        "quote": "学而时习之",
        "has_issue": True,
        "confidence": 0.95,
        "text_accuracy": {
            "is_accurate": False,
            "issues": "原文为不亦说乎",
            "original_text": "学而时习之，不亦说乎"
        },
        "interpretation_accuracy": {
            "is_accurate": True,
            "issues": "",
            "suggestion": ""
        },
        "context_appropriateness": {
            "is_appropriate": True,
            "issues": "",
            "suggestion": ""
        },
        "overall_suggestion": "引用有误"
    }
    para_info = {"chapter": "第一章", "estimated_page": 5, "context_before": "上文", "context_after": "下文"}
    result = _normalize_verify_result(raw, para_info)

    assert result["verdict"] == "有问题"
    assert result["text_accurate"] == False
    assert result["text_issues"] == "原文为不亦说乎"
    assert result["source_match"] == "学而时习之，不亦说乎"
    assert result["explanation_consistent"] == True
    assert result["context_appropriate"] == True
    assert result["summary"] == "引用有误"
    assert result["chapter"] == "第一章"
    assert result["estimated_page"] == 5
    assert result["confidence"] == 0.95
    assert result["context_before"] == "上文"
    assert result["context_after"] == "下文"


def test_normalize_verify_result_no_issue():
    from app.services.proofreader import _normalize_verify_result
    raw = {
        "quote": "君子不器",
        "has_issue": False,
        "confidence": 0.99,
        "text_accuracy": {"is_accurate": True, "issues": "", "original_text": "君子不器"},
        "interpretation_accuracy": {"is_accurate": True, "issues": "", "suggestion": ""},
        "context_appropriateness": {"is_appropriate": True, "issues": "", "suggestion": ""},
        "overall_suggestion": "引用准确，无需修改"
    }
    para_info = {"chapter": "", "estimated_page": None}
    result = _normalize_verify_result(raw, para_info)
    assert result["verdict"] == "通过"
    assert result["has_issue"] == False


def test_normalize_verify_result_error():
    from app.services.proofreader import _normalize_verify_result
    raw = {
        "quote": "test",
        "has_issue": None,
        "error": "API 调用失败",
        "text_accuracy": {"is_accurate": None, "issues": "校对失败", "original_text": ""},
        "interpretation_accuracy": {"is_accurate": None, "issues": "校对失败", "suggestion": ""},
        "context_appropriateness": {"is_appropriate": None, "issues": "校对失败", "suggestion": ""},
        "overall_suggestion": "校对失败"
    }
    result = _normalize_verify_result(raw, {})
    assert result["verdict"] == "校对失败"
    assert result["has_issue"] is None


# Test _detect_missing_sources
def test_detect_missing_sources_found():
    from app.services.proofreader import _detect_missing_sources
    quotes = [
        {"source_work": "《论语》", "quote": "学而时习之"},
        {"source_work": "《论语》", "quote": "知之为知之"},
    ]
    source_texts = {"论语全文.txt": "子曰学而时习之..."}
    missing = _detect_missing_sources(quotes, source_texts)
    assert missing == []  # 论语 matches 论语全文


def test_detect_missing_sources_not_found():
    from app.services.proofreader import _detect_missing_sources
    quotes = [
        {"source_work": "《论语》", "quote": "学而时习之"},
        {"source_work": "《道德经》", "quote": "道可道"},
    ]
    source_texts = {"论语全文.txt": "子曰..."}
    missing = _detect_missing_sources(quotes, source_texts)
    # 道德经 not in uploaded files
    assert len(missing) == 1
    assert missing[0]["source_work"] == "《道德经》"
    assert missing[0]["quote_count"] == 1


def test_detect_missing_sources_empty_quotes():
    from app.services.proofreader import _detect_missing_sources
    result = _detect_missing_sources([], {"some_file.txt": "content"})
    assert result == []


def test_detect_missing_sources_no_source_work():
    from app.services.proofreader import _detect_missing_sources
    quotes = [{"source_work": "", "quote": "some quote"}]
    result = _detect_missing_sources(quotes, {})
    assert result == []


# Test 429 retry via mock
@pytest.mark.asyncio
async def test_call_api_retries_on_429(monkeypatch):
    """_call_api should retry up to 4 times on 429 before raising."""
    from app.services import proofreader

    call_count = 0

    class FakeResponse:
        status_code = 429
        def raise_for_status(self):
            raise httpx.HTTPStatusError("429", request=None, response=self)
        @property
        def request(self):
            return None

    class FakeClient:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *args):
            pass
        async def post(self, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            return FakeResponse()

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: FakeClient())
    monkeypatch.setattr(asyncio, "sleep", lambda s: asyncio.coroutine(lambda: None)())
    monkeypatch.setattr(proofreader, "RETRY_WAIT_SECONDS", [0, 0, 0, 0])

    with pytest.raises(Exception):
        await proofreader._call_api("sys", "user")

    # Should have tried 1 initial + 4 retries = 5 total
    assert call_count == 5


# Test _format_paragraphs_for_prompt
def test_format_paragraphs_for_prompt():
    from app.services.proofreader import _format_paragraphs_for_prompt
    paras = [
        {"index": 1, "text": "第一段文字"},
        {"index": 2, "text": "第二段文字"},
    ]
    result = _format_paragraphs_for_prompt(paras)
    assert "[段落1] 第一段文字" in result
    assert "[段落2] 第二段文字" in result

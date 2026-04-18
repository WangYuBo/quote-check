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


# ---- 新增：预过滤正则测试 ----

class TestQuoteLikelyRegex:
    """验证 _QUOTE_LIKELY_RE 覆盖各类引用标志。"""

    @pytest.fixture(autouse=True)
    def _load_regex(self):
        from app.services.proofreader import _QUOTE_LIKELY_RE
        self.regex = _QUOTE_LIKELY_RE

    def test_modern_quotes(self):
        assert self.regex.search("他认为这很重要")
        assert self.regex.search("正如作者所言")
        assert self.regex.search("引自《论语》")

    def test_classical_yue(self):
        """'曰' 是古文最常见的引用标志。"""
        assert self.regex.search("子曰：学而时习之")
        assert self.regex.search("孔子曰")

    def test_classical_yun(self):
        """'云' 在古文中等同于 '说'。"""
        assert self.regex.search("是以圣人云")
        assert self.regex.search("老子有云")

    def test_book_title_marks(self):
        assert self.regex.search("《道德经》第八章")
        assert self.regex.search("「论语」记载")

    def test_jizai(self):
        assert self.regex.search("据《史记》记载")

    def test_no_false_positive_plain(self):
        """不含引用特征的纯文字不应匹配。"""
        assert not self.regex.search("今天天气很好适合散步")


# ---- JSON 解析测试 ----

class TestParseJsonFromResponse:
    """验证 _parse_json_from_response 的各种容错场景。"""

    def _parse(self, text):
        from app.services.proofreader import _parse_json_from_response
        return _parse_json_from_response(text)

    def test_plain_json_array(self):
        result = self._parse('[{"quote": "test"}]')
        assert isinstance(result, list)
        assert result[0]["quote"] == "test"

    def test_json_with_trailing_text(self):
        """JSON 数组后跟说明文字。"""
        text = '[{"quote": "学而时习之"}]\n\n以上是提取的引用。'
        result = self._parse(text)
        assert isinstance(result, list)
        assert len(result) == 1

    def test_code_block_wrapped(self):
        """```json 代码块包裹。"""
        text = '```json\n[{"quote": "test"}]\n```'
        result = self._parse(text)
        assert isinstance(result, list)

    def test_brackets_inside_string(self):
        """字符串值内含 [] 字符（此前 depth 计数 bug 的根因）。"""
        text = '[{"quote": "见[注]第三章", "source_work": "《论语》"}]'
        result = self._parse(text)
        assert isinstance(result, list)
        assert result[0]["quote"] == "见[注]第三章"

    def test_brackets_inside_string_with_trailing(self):
        """字符串内含 [] 且后跟垃圾文本。"""
        text = '[{"quote": "参见[注1]"}]\n这是AI的说明文字'
        result = self._parse(text)
        assert isinstance(result, list)
        assert result[0]["quote"] == "参见[注1]"

    def test_plain_object(self):
        result = self._parse('{"has_issue": true, "quote": "test"}')
        assert isinstance(result, dict)
        assert result["has_issue"] is True

    def test_invalid_escape_fixed(self):
        """模型返回含非法转义的 JSON。"""
        text = r'[{"quote": "\"不迁怒，不二过\""}]'
        result = self._parse(text)
        assert isinstance(result, list)

    def test_invalid_json_raises(self):
        with pytest.raises(json.JSONDecodeError):
            self._parse("这不是JSON")


# ---- group_quotes_by_source 测试 ----

class TestGroupQuotesBySource:

    def test_basic_grouping(self):
        from app.services.proofreader import group_quotes_by_source
        quotes = [
            {"source_work": "《论语》", "quote": "a"},
            {"source_work": "《道德经》", "quote": "b"},
            {"source_work": "《论语》", "quote": "c"},
        ]
        groups = group_quotes_by_source(quotes)
        assert len(groups) == 2
        assert len(groups["《论语》"]) == 2
        assert len(groups["《道德经》"]) == 1

    def test_empty_source_work(self):
        from app.services.proofreader import group_quotes_by_source
        quotes = [{"source_work": "", "quote": "x"}]
        groups = group_quotes_by_source(quotes)
        assert "未知来源" in groups


# ---- _find_source_text_for_work 测试 ----

class TestFindSourceTextForWork:

    def test_match_by_name(self):
        from app.services.proofreader import _find_source_text_for_work
        source_texts = {"论语全文.txt": "子曰学而时习之"}
        result = _find_source_text_for_work("《论语》", source_texts)
        assert result == "子曰学而时习之"

    def test_no_match(self):
        from app.services.proofreader import _find_source_text_for_work
        result = _find_source_text_for_work("《道德经》", {"论语.txt": "text"})
        assert result == ""

    def test_match_pinyin_filename(self):
        """拼音文件名应匹配中文书名。"""
        from app.services.proofreader import _find_source_text_for_work
        source_texts = {"Dao De Jing Wang Bi Zhu Ben - Wang Bi.txt": "道可道非常道"}
        result = _find_source_text_for_work("《道德经》", source_texts)
        assert result == "道可道非常道"

    def test_match_pinyin_sunzi(self):
        """孙子兵法拼音文件名匹配。"""
        from app.services.proofreader import _find_source_text_for_work
        source_texts = {"Sun Zi Bing Fa --Zhong Hua Jing Dian.txt": "兵者国之大事"}
        result = _find_source_text_for_work("《孙子兵法》", source_texts)
        assert result == "兵者国之大事"

    def test_match_chapter_level_source_work(self):
        """章节级 source_work 应匹配基础书名文件。"""
        from app.services.proofreader import _find_source_text_for_work
        source_texts = {"Dao De Jing Wang Bi Zhu Ben - Wang Bi.txt": "道可道"}
        result = _find_source_text_for_work("《老子·道经·第十一章》", source_texts)
        assert result == "道可道"

    def test_match_traditional_chinese(self):
        """繁体 source_work 应匹配。"""
        from app.services.proofreader import _find_source_text_for_work
        source_texts = {"Dao De Jing Wang Bi Zhu Ben.txt": "content"}
        result = _find_source_text_for_work("《道德經》", source_texts)
        assert result == "content"

    def test_empty_source_work_uses_first(self):
        from app.services.proofreader import _find_source_text_for_work
        result = _find_source_text_for_work("", {"a.txt": "first"})
        assert result == "first"


# ---- _normalize_source_work 测试 ----

class TestNormalizeSourceWork:

    def _norm(self, s):
        from app.services.proofreader import _normalize_source_work
        return _normalize_source_work(s)

    def test_strip_book_marks(self):
        assert self._norm("《道德经》") == "道德经"

    def test_strip_chapter(self):
        assert self._norm("《老子·道经·第十一章》") == "老子"

    def test_traditional_to_simplified(self):
        assert self._norm("《道德經》") == "道德经"

    def test_or_separator(self):
        assert self._norm("《老子》或《道德经》") == "老子"

    def test_parentheses(self):
        assert self._norm("《老子》（《道德经》）") == "老子"


# ---- _is_valid_quote 测试 ----

class TestIsValidQuote:

    def _valid(self, quote_text):
        from app.services.proofreader import _is_valid_quote
        return _is_valid_quote({"quote": quote_text})

    def test_real_quote(self):
        assert self._valid("\u201c道生一，一生二，二生三，三生万物\u201d")

    def test_book_title_only(self):
        """纯书名不是有效引用。"""
        assert not self._valid("《道德经》")
        assert not self._valid("《黄帝内经》")

    def test_too_short(self):
        assert not self._valid("普通人")
        assert not self._valid("abc")

    def test_question_not_quote(self):
        assert not self._valid("你认为老子和孔子哪个更伟大？")

    def test_valid_classical_quote(self):
        assert self._valid("志闲而少欲，心安而不惧")


# ---- _build_source_mapping 测试 ----

class TestBuildSourceMapping:

    def test_basic_mapping(self):
        from app.services.proofreader import _build_source_mapping
        source_mapping = [
            {
                "canonical_name": "道德经",
                "source_works": ["《道德经》", "《老子》", "《老子·道经·第十一章》"],
                "matched_file": "Dao De Jing.txt",
            },
            {
                "canonical_name": "论语",
                "source_works": ["《论语》"],
                "matched_file": None,
            },
        ]
        work_to_file, work_to_canonical = _build_source_mapping(source_mapping)

        assert work_to_canonical["《道德经》"] == "道德经"
        assert work_to_canonical["《老子》"] == "道德经"
        assert work_to_canonical["《老子·道经·第十一章》"] == "道德经"
        assert work_to_canonical["《论语》"] == "论语"

        assert work_to_file["《道德经》"] == "Dao De Jing.txt"
        assert work_to_file["《老子》"] == "Dao De Jing.txt"
        assert work_to_file["《论语》"] == ""

    def test_empty_mapping(self):
        from app.services.proofreader import _build_source_mapping
        work_to_file, work_to_canonical = _build_source_mapping([])
        assert work_to_file == {}
        assert work_to_canonical == {}


# ---- _detect_missing_sources_from_mapping 测试 ----

class TestDetectMissingSourcesFromMapping:

    def test_missing_detected(self):
        from app.services.proofreader import _detect_missing_sources_from_mapping
        quotes = [
            {"source_work": "《道德经》", "quote": "a"},
            {"source_work": "《论语》", "quote": "b"},
            {"source_work": "《论语》", "quote": "c"},
        ]
        work_to_file = {"《道德经》": "dao.txt", "《论语》": ""}
        work_to_canonical = {"《道德经》": "道德经", "《论语》": "论语"}
        missing = _detect_missing_sources_from_mapping([], quotes, work_to_file, work_to_canonical)
        assert len(missing) == 1
        assert missing[0]["source_work"] == "论语"
        assert missing[0]["quote_count"] == 2

    def test_all_matched(self):
        from app.services.proofreader import _detect_missing_sources_from_mapping
        quotes = [{"source_work": "《道德经》", "quote": "a"}]
        work_to_file = {"《道德经》": "dao.txt"}
        work_to_canonical = {"《道德经》": "道德经"}
        missing = _detect_missing_sources_from_mapping([], quotes, work_to_file, work_to_canonical)
        assert missing == []

    def test_synonyms_grouped(self):
        """同义词归组后，只要一个有匹配文件就不算缺失。"""
        from app.services.proofreader import _detect_missing_sources_from_mapping
        quotes = [
            {"source_work": "《道德经》", "quote": "a"},
            {"source_work": "《老子》", "quote": "b"},
        ]
        work_to_file = {"《道德经》": "dao.txt", "《老子》": "dao.txt"}
        work_to_canonical = {"《道德经》": "道德经", "《老子》": "道德经"}
        missing = _detect_missing_sources_from_mapping([], quotes, work_to_file, work_to_canonical)
        assert missing == []


# ---- map_sources_with_llm mock 测试 ----

class TestMapSourcesWithLLM:

    @pytest.mark.asyncio
    async def test_successful_mapping(self, monkeypatch):
        from app.services import proofreader

        llm_response = json.dumps([
            {
                "canonical_name": "道德经",
                "source_works": ["《道德经》", "《老子》"],
                "matched_file": "Dao De Jing.txt",
            }
        ], ensure_ascii=False)

        async def fake_call_api(system_prompt, user_message, max_tokens=4096):
            return llm_response

        monkeypatch.setattr(proofreader, "_call_api", fake_call_api)

        result = await proofreader.map_sources_with_llm(
            ["《道德经》", "《老子》"],
            ["Dao De Jing.txt"],
        )
        assert len(result) == 1
        assert result[0]["canonical_name"] == "道德经"
        assert result[0]["matched_file"] == "Dao De Jing.txt"

    @pytest.mark.asyncio
    async def test_invalid_matched_file_corrected(self, monkeypatch):
        """LLM 返回不在文件列表中的 matched_file 应被置为 None。"""
        from app.services import proofreader

        llm_response = json.dumps([
            {
                "canonical_name": "道德经",
                "source_works": ["《道德经》"],
                "matched_file": "nonexistent.txt",
            }
        ], ensure_ascii=False)

        async def fake_call_api(system_prompt, user_message, max_tokens=4096):
            return llm_response

        monkeypatch.setattr(proofreader, "_call_api", fake_call_api)

        result = await proofreader.map_sources_with_llm(
            ["《道德经》"],
            ["Dao De Jing.txt"],
        )
        assert result[0]["matched_file"] is None

    @pytest.mark.asyncio
    async def test_api_failure_returns_empty(self, monkeypatch):
        from app.services import proofreader

        async def fake_call_api(system_prompt, user_message, max_tokens=4096):
            raise Exception("API error")

        monkeypatch.setattr(proofreader, "_call_api", fake_call_api)

        result = await proofreader.map_sources_with_llm(
            ["《道德经》"],
            ["Dao De Jing.txt"],
        )
        assert result == []

    @pytest.mark.asyncio
    async def test_empty_source_works(self):
        from app.services.proofreader import map_sources_with_llm
        result = await map_sources_with_llm([], ["file.txt"])
        assert result == []

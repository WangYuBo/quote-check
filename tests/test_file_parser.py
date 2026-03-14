"""
Tests for app/services/file_parser.py

Run with:
    pytest tests/test_file_parser.py -v
"""

import pytest
from pathlib import Path

from app.services.file_parser import (
    parse_file,
    FileNotFoundError as ParserFileNotFoundError,
    UnsupportedFileTypeError,
    FileParseError,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def txt_file(tmp_path: Path) -> Path:
    """A simple UTF-8 plain-text file."""
    f = tmp_path / "sample.txt"
    f.write_text("天下皆知美之为美，斯恶已。\n皆知善之为善，斯不善已。", encoding="utf-8")
    return f


@pytest.fixture
def md_file(tmp_path: Path) -> Path:
    """A markdown file with headings and inline content."""
    content = (
        "# 道德经摘录\n\n"
        "## 第一章\n\n"
        "道可道，非常道。名可名，非常名。\n\n"
        "## 第二章\n\n"
        "天下皆知美之为美，斯恶已。\n"
    )
    f = tmp_path / "sample.md"
    f.write_text(content, encoding="utf-8")
    return f


@pytest.fixture
def empty_txt_file(tmp_path: Path) -> Path:
    """An empty .txt file."""
    f = tmp_path / "empty.txt"
    f.write_text("", encoding="utf-8")
    return f


@pytest.fixture
def empty_md_file(tmp_path: Path) -> Path:
    """An empty .md file."""
    f = tmp_path / "empty.md"
    f.write_text("", encoding="utf-8")
    return f


@pytest.fixture
def unsupported_file(tmp_path: Path) -> Path:
    """A file with an unsupported extension (.xyz)."""
    f = tmp_path / "data.xyz"
    f.write_text("some data", encoding="utf-8")
    return f


@pytest.fixture
def csv_file(tmp_path: Path) -> Path:
    """A CSV file — also unsupported."""
    f = tmp_path / "data.csv"
    f.write_text("col1,col2\nval1,val2\n", encoding="utf-8")
    return f


# ---------------------------------------------------------------------------
# .txt parsing
# ---------------------------------------------------------------------------

class TestParseTxt:
    def test_returns_string(self, txt_file: Path):
        result = parse_file(str(txt_file))
        assert isinstance(result, str)

    def test_content_is_correct(self, txt_file: Path):
        result = parse_file(str(txt_file))
        assert "天下皆知美之为美" in result
        assert "斯恶已" in result

    def test_multiline_content_preserved(self, txt_file: Path):
        result = parse_file(str(txt_file))
        # Both lines should be present
        assert "皆知善之为善" in result

    def test_explicit_file_type_overrides_extension(self, tmp_path: Path):
        """file_type parameter should override the file's actual extension."""
        f = tmp_path / "notes.dat"
        f.write_text("override content", encoding="utf-8")
        result = parse_file(str(f), file_type=".txt")
        assert "override content" in result


# ---------------------------------------------------------------------------
# .md parsing
# ---------------------------------------------------------------------------

class TestParseMd:
    def test_returns_string(self, md_file: Path):
        result = parse_file(str(md_file))
        assert isinstance(result, str)

    def test_content_contains_text(self, md_file: Path):
        result = parse_file(str(md_file))
        assert "道可道，非常道" in result

    def test_headings_present(self, md_file: Path):
        result = parse_file(str(md_file))
        assert "道德经摘录" in result

    def test_multiline_md(self, md_file: Path):
        result = parse_file(str(md_file))
        assert "天下皆知美之为美" in result


# ---------------------------------------------------------------------------
# Empty file handling
# ---------------------------------------------------------------------------

class TestEmptyFiles:
    def test_empty_txt_returns_empty_string(self, empty_txt_file: Path):
        result = parse_file(str(empty_txt_file))
        assert result == ""

    def test_empty_md_returns_empty_string(self, empty_md_file: Path):
        result = parse_file(str(empty_md_file))
        assert result == ""

    def test_empty_file_does_not_raise(self, empty_txt_file: Path):
        # Should not raise any exception, just return empty string
        try:
            parse_file(str(empty_txt_file))
        except Exception as exc:
            pytest.fail(f"parse_file raised unexpectedly on empty file: {exc}")


# ---------------------------------------------------------------------------
# Unsupported file format
# ---------------------------------------------------------------------------

class TestUnsupportedFormats:
    def test_xyz_raises_unsupported(self, unsupported_file: Path):
        with pytest.raises(UnsupportedFileTypeError):
            parse_file(str(unsupported_file))

    def test_csv_raises_unsupported(self, csv_file: Path):
        with pytest.raises(UnsupportedFileTypeError):
            parse_file(str(csv_file))

    def test_error_message_contains_extension(self, unsupported_file: Path):
        with pytest.raises(UnsupportedFileTypeError, match=r"\.xyz"):
            parse_file(str(unsupported_file))

    def test_error_message_lists_supported_types(self, unsupported_file: Path):
        with pytest.raises(UnsupportedFileTypeError, match=r"Supported types"):
            parse_file(str(unsupported_file))

    def test_no_extension_file_raises_unsupported(self, tmp_path: Path):
        f = tmp_path / "noextension"
        f.write_text("content", encoding="utf-8")
        with pytest.raises(UnsupportedFileTypeError):
            parse_file(str(f))


# ---------------------------------------------------------------------------
# File not found
# ---------------------------------------------------------------------------

class TestFileNotFound:
    def test_nonexistent_path_raises(self, tmp_path: Path):
        nonexistent = tmp_path / "does_not_exist.txt"
        with pytest.raises(ParserFileNotFoundError):
            parse_file(str(nonexistent))

    def test_error_message_contains_path(self, tmp_path: Path):
        nonexistent = str(tmp_path / "ghost.txt")
        with pytest.raises(ParserFileNotFoundError, match="ghost.txt"):
            parse_file(nonexistent)

    def test_directory_path_raises(self, tmp_path: Path):
        # A directory path should raise FileNotFoundError (not a regular file)
        with pytest.raises(ParserFileNotFoundError):
            parse_file(str(tmp_path))


# ---------------------------------------------------------------------------
# file_type parameter normalisation
# ---------------------------------------------------------------------------

class TestFileTypeParameter:
    def test_file_type_without_dot_is_accepted(self, tmp_path: Path):
        """file_type='txt' (no leading dot) should work the same as '.txt'."""
        f = tmp_path / "notes.dat"
        f.write_text("hello world", encoding="utf-8")
        result = parse_file(str(f), file_type="txt")
        assert "hello world" in result

    def test_file_type_uppercase_normalised(self, tmp_path: Path):
        f = tmp_path / "doc.DAT"
        f.write_text("upper case ext", encoding="utf-8")
        result = parse_file(str(f), file_type=".TXT")
        assert "upper case ext" in result

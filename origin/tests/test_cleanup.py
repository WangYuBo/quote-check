"""
文件清理逻辑的单元测试。
"""

import os
import time
from pathlib import Path

from app.main import _cleanup_old_uploads


def test_cleanup_deletes_old_files(tmp_path: Path):
    """超过指定时间的文件应被删除。"""
    old_file = tmp_path / "old_upload.docx"
    old_file.write_text("old content")
    # 将 mtime 设为 2 天前
    old_mtime = time.time() - 48 * 3600
    os.utime(old_file, (old_mtime, old_mtime))

    deleted = _cleanup_old_uploads(tmp_path, max_age_hours=24)
    assert deleted == 1
    assert not old_file.exists()


def test_cleanup_keeps_new_files(tmp_path: Path):
    """新文件不应被删除。"""
    new_file = tmp_path / "new_upload.docx"
    new_file.write_text("new content")

    deleted = _cleanup_old_uploads(tmp_path, max_age_hours=24)
    assert deleted == 0
    assert new_file.exists()


def test_cleanup_nonexistent_dir():
    """不存在的目录应返回 0 且不报错。"""
    deleted = _cleanup_old_uploads(Path("/nonexistent/dir"), max_age_hours=24)
    assert deleted == 0


def test_cleanup_mixed_files(tmp_path: Path):
    """混合新旧文件，只删除旧的。"""
    old_file = tmp_path / "old.txt"
    old_file.write_text("old")
    old_mtime = time.time() - 48 * 3600
    os.utime(old_file, (old_mtime, old_mtime))

    new_file = tmp_path / "new.txt"
    new_file.write_text("new")

    deleted = _cleanup_old_uploads(tmp_path, max_age_hours=24)
    assert deleted == 1
    assert not old_file.exists()
    assert new_file.exists()

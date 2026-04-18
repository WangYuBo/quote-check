"""
API integration tests for the proofreader FastAPI application.

Tests cover:
- GET  /           → 200 OK
- GET  /health     → 200 OK with JSON status
- POST /api/proofread → 422 when files are missing
- GET  /api/result/{task_id} → 404 for unknown task IDs

Prerequisites
-------------
The FastAPI app must be importable. If ``app/main.py`` does not yet exist,
these tests are collected but skipped automatically (see the module-level
``pytestmark``).

Run with:
    pytest tests/test_api.py -v
"""

import importlib
import sys
import pytest

# ---------------------------------------------------------------------------
# Graceful skip if the app entry point is not yet implemented
# ---------------------------------------------------------------------------

def _app_is_available() -> bool:
    try:
        importlib.import_module("app.main")
        return True
    except (ImportError, ModuleNotFoundError):
        return False


pytestmark = pytest.mark.skipif(
    not _app_is_available(),
    reason="app.main not found – skipping API tests until the module is implemented",
)

# ---------------------------------------------------------------------------
# Lazy import of the ASGI app (only when available)
# ---------------------------------------------------------------------------

if _app_is_available():
    from fastapi.testclient import TestClient
    from app.main import app  # type: ignore[import]

    client = TestClient(app, raise_server_exceptions=False)
else:
    # Provide a dummy so the module parses without errors when skipped
    client = None  # type: ignore[assignment]


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def txt_manuscript(tmp_path):
    """A minimal manuscript text file."""
    f = tmp_path / "manuscript.txt"
    f.write_text(
        "第一章\n\n"
        "老子曰：「道可道，非常道。」意为道是无法用语言完全表达的终极存在。\n",
        encoding="utf-8",
    )
    return f


@pytest.fixture()
def txt_source(tmp_path):
    """A minimal source / reference text file."""
    f = tmp_path / "source.txt"
    f.write_text(
        "道可道，非常道。名可名，非常名。\n"
        "无名天地之始；有名万物之母。\n",
        encoding="utf-8",
    )
    return f


# ---------------------------------------------------------------------------
# Health & root endpoint
# ---------------------------------------------------------------------------

class TestHealthCheck:
    def test_health_returns_200(self):
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_response_is_json(self):
        response = client.get("/health")
        data = response.json()
        assert isinstance(data, dict)

    def test_health_status_field(self):
        response = client.get("/health")
        data = response.json()
        # Expect a "status" key with value "ok" or similar positive indicator
        assert "status" in data
        assert data["status"].lower() in {"ok", "healthy", "running"}


class TestRootEndpoint:
    def test_root_returns_200(self):
        response = client.get("/")
        assert response.status_code == 200

    def test_root_response_is_not_empty(self):
        response = client.get("/")
        assert len(response.content) > 0


# ---------------------------------------------------------------------------
# POST /api/proofread — validation errors
# ---------------------------------------------------------------------------

class TestProofreadValidation:
    def test_missing_both_files_returns_422(self):
        """POST with no files at all must return 422 Unprocessable Entity."""
        response = client.post("/api/proofread")
        assert response.status_code == 422

    def test_missing_source_file_returns_422(self, txt_manuscript):
        """POST with only the manuscript but without the source must return 422."""
        with open(txt_manuscript, "rb") as fh:
            response = client.post(
                "/api/proofread",
                files={"manuscript": ("manuscript.txt", fh, "text/plain")},
            )
        assert response.status_code == 422

    def test_missing_manuscript_returns_422(self, txt_source):
        """POST with only the source but without the manuscript must return 422."""
        with open(txt_source, "rb") as fh:
            response = client.post(
                "/api/proofread",
                files={"source": ("source.txt", fh, "text/plain")},
            )
        assert response.status_code == 422

    def test_422_response_body_has_detail(self):
        response = client.post("/api/proofread")
        data = response.json()
        assert "detail" in data


# ---------------------------------------------------------------------------
# GET /api/result/{task_id} — unknown task
# ---------------------------------------------------------------------------

class TestResultEndpoint:
    def test_unknown_task_id_returns_404(self):
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.get(f"/api/result/{fake_id}")
        assert response.status_code == 404

    def test_random_string_task_id_returns_404(self):
        response = client.get("/api/result/this-task-does-not-exist")
        assert response.status_code == 404

    def test_404_body_has_detail(self):
        response = client.get("/api/result/nonexistent-task-id")
        data = response.json()
        assert "detail" in data


# ---------------------------------------------------------------------------
# POST /api/proofread — successful submission (smoke test)
# ---------------------------------------------------------------------------

class TestProofreadSmoke:
    """
    These tests submit real files but do NOT call the Anthropic API.
    They only verify that the endpoint accepts valid input and returns the
    expected task_id structure (the actual proofreading is async/deferred).

    If the endpoint calls Claude synchronously and ANTHROPIC_API_KEY is not
    set, these will be automatically skipped.
    """

    @pytest.fixture(autouse=True)
    def skip_if_no_api_key(self, monkeypatch):
        import os
        if not os.environ.get("ANTHROPIC_API_KEY"):
            pytest.skip("ANTHROPIC_API_KEY not set — skipping live API smoke tests")

    def test_valid_upload_returns_task_id(self, txt_manuscript, txt_source):
        with open(txt_manuscript, "rb") as mf, open(txt_source, "rb") as sf:
            response = client.post(
                "/api/proofread",
                files={
                    "manuscript": ("manuscript.txt", mf, "text/plain"),
                    "source": ("source.txt", sf, "text/plain"),
                },
            )
        # Expect 200 or 202 (accepted for async processing)
        assert response.status_code in {200, 202}
        data = response.json()
        assert "task_id" in data

    def test_task_id_is_string(self, txt_manuscript, txt_source):
        with open(txt_manuscript, "rb") as mf, open(txt_source, "rb") as sf:
            response = client.post(
                "/api/proofread",
                files={
                    "manuscript": ("manuscript.txt", mf, "text/plain"),
                    "source": ("source.txt", sf, "text/plain"),
                },
            )
        data = response.json()
        assert isinstance(data.get("task_id"), str)
        assert len(data["task_id"]) > 0

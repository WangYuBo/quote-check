"""
FastAPI application entry point.

Start the development server:
    python -m app.main
    # or
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

import logging
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.config import settings

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

# Resolve static directory relative to this file's location so that the app
# works regardless of where uvicorn is launched from.
_PROJECT_ROOT = Path(__file__).parent.parent
_STATIC_DIR = _PROJECT_ROOT / "static"

app = FastAPI(
    title=settings.app_title,
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
)

# --- CORS (permissive for local development) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Static files ---
if _STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(_STATIC_DIR)), name="static")
else:
    logger.warning("Static directory not found at %s – skipping mount.", _STATIC_DIR)

# --- API & page routes ---
app.include_router(router)

# --- Ensure uploads directory exists at startup ---
@app.on_event("startup")
async def _startup() -> None:
    settings.ensure_upload_dir()
    logger.info(
        "Upload directory ready: %s",
        settings.upload_dir.resolve(),
    )
    logger.info(
        "%s v%s started (debug=%s)",
        settings.app_title,
        settings.app_version,
        settings.debug,
    )


# ---------------------------------------------------------------------------
# Direct execution
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level="debug" if settings.debug else "info",
    )

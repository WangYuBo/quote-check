"""
Application configuration.
All sensitive values are read from environment variables.
"""

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # --- AI ---
    siliconflow_api_key: str = ""
    siliconflow_api_url: str = "https://api.siliconflow.cn/v1/messages"
    model: str = "deepseek-ai/DeepSeek-V3.2"

    # --- Upload limits ---
    max_upload_size_mb: int = 50

    @property
    def max_upload_size_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024

    # --- Supported file formats ---
    supported_extensions: list[str] = [".docx", ".pdf", ".md", ".txt", ".epub"]

    # --- Storage ---
    upload_dir: Path = Path("./uploads")

    def ensure_upload_dir(self) -> None:
        """Create upload directory if it does not exist."""
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    # --- App meta ---
    app_title: str = "图书引用校对工具"
    app_version: str = "0.1.0"
    debug: bool = False


# Singleton instance used throughout the application
settings = Settings()

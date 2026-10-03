from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

FIXTURES_DIR = Path(__file__).resolve().parents[2] / "fixtures"


class Settings(BaseSettings):
    """Runtime configuration, read from environment variables (or a local .env file)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    crm_base_url: str = "http://localhost:4002"
    crm_timeout_seconds: float = Field(default=3.0, gt=0)
    crm_max_retries: int = Field(default=1, ge=0, le=3)
    crm_retry_backoff_seconds: float = Field(default=0.2, ge=0)
    crm_total_budget_seconds: float = Field(default=5.0, gt=0)
    log_level: str = "INFO"
    history_file: Path = FIXTURES_DIR / "performance-history.json"
    seed_file: Path = FIXTURES_DIR / "seed.json"
    api_token: SecretStr = SecretStr("superday-demo-token")


@lru_cache
def get_settings() -> Settings:
    return Settings()

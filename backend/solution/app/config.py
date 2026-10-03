from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, read from environment variables (or a local .env file)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    crm_base_url: str = "http://localhost:4002"
    crm_timeout_seconds: float = Field(default=3.0, gt=0)
    crm_max_retries: int = Field(default=1, ge=0, le=3)
    crm_retry_backoff_seconds: float = Field(default=0.2, ge=0)
    crm_total_budget_seconds: float = Field(default=5.0, gt=0)
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()

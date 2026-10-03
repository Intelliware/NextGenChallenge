import json
from pathlib import Path
from typing import Any

import pytest

from app.config import Settings

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "crm"

TEST_TOKEN = "superday-demo-token"
AUTH_HEADERS = {"Authorization": f"Bearer {TEST_TOKEN}"}


def load_fixture(name: str) -> Any:
    return json.loads((FIXTURE_DIR / f"{name}.json").read_text())


def fixture_names() -> set[str]:
    return {path.stem for path in FIXTURE_DIR.iterdir() if path.suffix in {".json", ".txt"}}


def make_settings(**overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "crm_base_url": "http://crm.test",
        "crm_timeout_seconds": 3.0,
        "crm_max_retries": 1,
        "crm_retry_backoff_seconds": 0.0,
        "crm_total_budget_seconds": 5.0,
        "log_level": "WARNING",
        "api_token": TEST_TOKEN,
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


@pytest.fixture
def settings() -> Settings:
    return make_settings()

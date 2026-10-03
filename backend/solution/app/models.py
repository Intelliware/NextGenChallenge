from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    """Snake_case in Python, camelCase on the wire."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class PortfolioMetadata(ApiModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "portfolioId": "P-9001",
                "clientId": "abc123",
                "label": "Taxable Brokerage",
                "currency": "CAD",
                "totalMarketValue": 48930.0,
                "dayChangeAmount": 30.0,
                "dayChangePercent": 0.0006134969325153375,
                "totalReturnSinceInception": 0.187,
                "asOf": "2026-10-03T16:00:00Z",
                "warnings": [],
            }
        }
    )

    portfolio_id: str
    client_id: str
    label: str | None = Field(description="Account nickname; null if the CRM did not supply one")
    currency: str = Field(description="ISO 4217 code; defaults to CAD (with a warning) if the CRM omits it")
    total_market_value: float | None
    day_change_amount: float | None
    day_change_percent: float | None = Field(description="Decimal, e.g. 0.0032 = 0.32%")
    total_return_since_inception: float | None = Field(description="Decimal, e.g. 0.187 = 18.7%")
    as_of: str | None = Field(description="ISO 8601 UTC datetime the CRM produced this data")
    warnings: list[str] = Field(
        default_factory=list,
        description="Data-quality notes about fields the CRM omitted or sent in an unusable form",
    )


class ErrorResponse(ApiModel):
    error: str = Field(description="Short machine-readable error code")
    message: str = Field(description="Human-readable explanation")
    request_id: str = Field(description="Matches the X-Request-ID response header")
    details: dict[str, Any] | None = None


# --- Task 3 ---
class PerformanceSnapshot(ApiModel):
    model_config = ConfigDict(json_schema_extra={"example": {"date": "2026-10-03", "marketValue": 48930.0}})

    date: str = Field(description="Snapshot date, YYYY-MM-DD")
    market_value: float = Field(description="Total portfolio market value on that date")

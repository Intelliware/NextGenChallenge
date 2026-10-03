from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    """Snake_case in Python, camelCase on the wire."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class PortfolioMetadata(ApiModel):
    """One CRM account, mapped into our schema.

    Values the CRM leaves out or sends in an unusable form are null and explained in `warnings`.
    """

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

    portfolio_id: str = Field(description="Mapped from `acct_ref`")
    client_id: str = Field(description="Mapped from `client_record.client_id`")
    label: str | None = Field(description="Mapped from `acct_nickname`; null if the CRM did not supply one")
    currency: str = Field(
        description="Mapped from `curr_val.ccy` as an ISO 4217 code; CAD (with a warning) if the CRM omits it"
    )
    total_market_value: float | None = Field(description="Mapped from `curr_val.amt`")
    day_change_amount: float | None = Field(description="Mapped from `chg_1d.amt`")
    day_change_percent: float | None = Field(description="Mapped from `chg_1d.pct`. Decimal, e.g. 0.0032 = 0.32%")
    total_return_since_inception: float | None = Field(
        description="Mapped from `since_inception_pct`. Decimal, e.g. 0.187 = 18.7%"
    )
    as_of: str | None = Field(description="Mapped from `meta.retrieved_at`, as an ISO 8601 UTC datetime")
    warnings: list[str] = Field(
        default_factory=list,
        description="Data-quality notes about fields the CRM omitted or sent in an unusable form",
    )


class ErrorResponse(ApiModel):
    """Every error response has this shape."""

    error: str = Field(description="Short machine-readable error code")
    message: str = Field(description="Human-readable explanation")
    request_id: str = Field(description="Matches the X-Request-ID response header")
    details: dict[str, Any] | None = None


# --- Task 2 ---
class Holding(ApiModel):
    ticker: str
    name: str
    asset_class: str
    quantity: float
    cost_basis_per_share: float
    price: float
    previous_close_price: float
    market_value: float
    weight_percent: float = Field(description="Decimal share of portfolio market value, e.g. 0.5579")
    unrealized_gain_loss: float
    day_change_amount: float
    day_change_percent: float | None = Field(description="Decimal; null when the previous close is 0")


# --- Task 3 ---
class PerformanceSnapshot(ApiModel):
    model_config = ConfigDict(json_schema_extra={"example": {"date": "2026-10-03", "marketValue": 48930.0}})

    date: str = Field(description="Snapshot date, YYYY-MM-DD")
    market_value: float = Field(description="Total portfolio market value on that date")


# --- Task 5 ---
class AllocationEntry(ApiModel):
    model_config = ConfigDict(
        json_schema_extra={"example": {"assetClass": "Equity", "value": 27300.0, "percent": 0.5579}}
    )

    asset_class: str = Field(description='e.g. "Equity", "Fixed Income", "Cash", "Alternatives"')
    value: float = Field(description="Total market value held in this asset class")
    percent: float = Field(description="Decimal share of portfolio market value, e.g. 0.5579")

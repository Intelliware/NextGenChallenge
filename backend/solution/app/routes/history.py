from fastapi import APIRouter, Depends, Path, Query

from app.dependencies import get_history_service
from app.models import PerformanceSnapshot
from app.openapi import error_doc, error_example
from app.routes.portfolios import INVALID_ID_EXAMPLE, NOT_FOUND_EXAMPLE, validate_portfolio_id
from app.services.history_service import HistoryService, parse_range

router = APIRouter(tags=["history"])

PORTFOLIO_ID_EXAMPLES = {
    "P-9001": {"summary": "P-9001: 401 days of history (200)", "value": "P-9001"},
    "P-9002": {"summary": "P-9002: only 60 days, so 1Y returns 60 points (200)", "value": "P-9002"},
    "P-EMPTY": {"summary": "P-EMPTY: no history, so an empty list (200)", "value": "P-EMPTY"},
    "unknown": {"summary": "Unknown id (404)", "value": "UNKNOWN"},
}

RANGE_EXAMPLES = {
    "1D": {"summary": "1D: yesterday and today", "value": "1D"},
    "1M": {"summary": "1M: from the same day last month", "value": "1M"},
    "YTD": {"summary": "YTD: from January 1", "value": "YTD"},
    "1Y": {"summary": "1Y: from the same day last year", "value": "1Y"},
    "All": {"summary": "All: everything (same as leaving range out)", "value": "All"},
    "invalid": {"summary": "1W: not an allowed range (400)", "value": "1W"},
}


@router.get(
    "/portfolios/{portfolio_id}/performance-history",
    response_model=list[PerformanceSnapshot],
    summary="Daily total market value for the performance chart, oldest first",
    description=(
        "If there is less history than the range covers, you get what exists; nothing is padded. "
        "A portfolio with no history returns `[]`."
    ),
    responses={
        400: error_doc(
            "The id is not a valid portfolio id, or range is not one of the allowed values.",
            INVALID_ID_EXAMPLE,
            error_example(
                "invalid_range",
                "range must be one of 1D, 1M, YTD, 1Y, All.",
                {"range": "1W", "allowed": ["1D", "1M", "YTD", "1Y", "All"]},
            ),
        ),
        404: error_doc("There is no portfolio with this id.", NOT_FOUND_EXAMPLE),
        503: error_doc(
            "The history data file is missing or unreadable. The server log names the command that generates it.",
            error_example("history_unavailable", "Performance history data is not available."),
        ),
    },
)
async def get_performance_history(
    portfolio_id: str = Path(description="Portfolio id, such as `P-9001`", openapi_examples=PORTFOLIO_ID_EXAMPLES),
    range_: str | None = Query(
        default=None,
        alias="range",
        description="One of 1D, 1M, YTD, 1Y, All (exact match). Defaults to All. Every range ends today (UTC).",
        openapi_examples=RANGE_EXAMPLES,
    ),
    service: HistoryService = Depends(get_history_service),
) -> list[PerformanceSnapshot]:
    validate_portfolio_id(portfolio_id)
    return service.get_history(portfolio_id, parse_range(range_))

from fastapi import APIRouter, Depends, Query

from app.dependencies import get_history_service
from app.models import PerformanceSnapshot
from app.routes.portfolios import error_doc, validate_portfolio_id
from app.services.history_service import HistoryService, parse_range

router = APIRouter(tags=["history"])


@router.get(
    "/portfolios/{portfolio_id}/performance-history",
    response_model=list[PerformanceSnapshot],
    summary="Daily total market value for the performance chart, oldest first",
    responses={
        400: error_doc(
            "The id is not a valid portfolio id (invalid_portfolio_id), or range is not one of the allowed values.",
            {
                "error": "invalid_range",
                "message": "range must be one of 1D, 1M, YTD, 1Y, All.",
                "requestId": "...",
                "details": {"range": "1W", "allowed": ["1D", "1M", "YTD", "1Y", "All"]},
            },
        ),
        404: error_doc(
            "There is no portfolio with this id.",
            {"error": "portfolio_not_found", "message": "No portfolio found with id 'P-0000'.", "requestId": "..."},
        ),
        503: error_doc(
            "The history data file is missing or unreadable. The server log names the command that generates it.",
            {"error": "history_unavailable", "message": "Performance history data is not available.", "requestId": "..."},
        ),
    },
)
async def get_performance_history(
    portfolio_id: str,
    range_: str | None = Query(
        default=None,
        alias="range",
        description="One of 1D, 1M, YTD, 1Y, All (exact match). Defaults to All. Every range ends today (UTC).",
    ),
    service: HistoryService = Depends(get_history_service),
) -> list[PerformanceSnapshot]:
    validate_portfolio_id(portfolio_id)
    return service.get_history(portfolio_id, parse_range(range_))

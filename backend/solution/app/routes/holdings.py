from fastapi import APIRouter, Depends

from app.dependencies import get_holdings_service
from app.models import ErrorResponse, Holding
from app.services.holdings_service import HoldingsService

router = APIRouter(tags=["holdings"])


@router.get(
    "/portfolios/{portfolio_id}/holdings",
    response_model=list[Holding],
    summary="Holdings with server-side valuation and gain/loss",
    responses={
        404: {
            "model": ErrorResponse,
            "description": "No portfolio with this id. A portfolio with no holdings returns [] instead.",
        },
    },
)
def get_holdings(
    portfolio_id: str, service: HoldingsService = Depends(get_holdings_service)
) -> list[Holding]:
    return service.get_holdings(portfolio_id)

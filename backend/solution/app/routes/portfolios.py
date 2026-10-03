import re

from fastapi import APIRouter, Depends

from app.dependencies import get_portfolio_service
from app.errors import InvalidPortfolioId
from app.models import ErrorResponse, PortfolioMetadata
from app.services.portfolio_service import PortfolioService

router = APIRouter(tags=["portfolios"])

PORTFOLIO_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _error(description: str, example: dict) -> dict:
    return {"model": ErrorResponse, "description": description, "content": {"application/json": {"example": example}}}


@router.get(
    "/portfolios/{portfolio_id}",
    response_model=PortfolioMetadata,
    summary="Portfolio metadata (sourced from the CRM)",
    responses={
        400: _error(
            "The id is not a valid portfolio id. The CRM is not called.",
            {"error": "invalid_portfolio_id", "message": "...", "requestId": "..."},
        ),
        404: _error(
            "The CRM has no account with this id.",
            {"error": "portfolio_not_found", "message": "No portfolio found with id 'P-0000'.", "requestId": "..."},
        ),
        502: _error(
            "The CRM answered with data that could not be interpreted safely.",
            {"error": "crm_bad_response", "message": "...", "requestId": "...", "details": {"reason": "..."}},
        ),
        503: _error(
            "The CRM is down or returned a server error (after one retry). Includes Retry-After.",
            {"error": "crm_unavailable", "message": "...", "requestId": "...", "details": {"upstreamStatus": 503}},
        ),
        504: _error(
            "The CRM did not respond within the timeout.",
            {"error": "crm_timeout", "message": "...", "requestId": "...", "details": {"timeoutSeconds": 3}},
        ),
    },
)
async def get_portfolio(
    portfolio_id: str, service: PortfolioService = Depends(get_portfolio_service)
) -> PortfolioMetadata:
    if not PORTFOLIO_ID_PATTERN.fullmatch(portfolio_id):
        raise InvalidPortfolioId(
            "Portfolio id must be 1-64 characters: letters, digits, '-' or '_'.",
            details={"portfolioId": portfolio_id[:100]},
        )
    return await service.get_metadata(portfolio_id)

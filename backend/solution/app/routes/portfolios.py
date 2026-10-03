import re

from fastapi import APIRouter, Depends, Path

from app.dependencies import get_portfolio_service
from app.errors import InvalidPortfolioId
from app.models import PortfolioMetadata
from app.openapi import error_doc, error_example
from app.services.portfolio_service import PortfolioService

router = APIRouter(tags=["portfolios"])

PORTFOLIO_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
INVALID_ID_MESSAGE = "Portfolio id must be 1-64 characters: letters, digits, '-' or '_'."

INVALID_ID_EXAMPLE = error_example("invalid_portfolio_id", INVALID_ID_MESSAGE, {"portfolioId": "bad id"})
NOT_FOUND_EXAMPLE = error_example("portfolio_not_found", "No portfolio found with id 'UNKNOWN'.")

PORTFOLIO_ID_EXAMPLES = {
    "P-9001": {"summary": "P-9001: complete CRM data (200)", "value": "P-9001"},
    "P-9002": {"summary": "P-9002: 0% day change is flagged in warnings (200)", "value": "P-9002"},
    "P-EMPTY": {"summary": "P-EMPTY: zeros stay zeros (200)", "value": "P-EMPTY"},
    "unknown": {"summary": "Unknown id (404)", "value": "UNKNOWN"},
    "invalid": {"summary": "Invalid id, rejected without calling the CRM (400)", "value": "bad id"},
}


def validate_portfolio_id(portfolio_id: str) -> None:
    if not PORTFOLIO_ID_PATTERN.fullmatch(portfolio_id):
        raise InvalidPortfolioId(INVALID_ID_MESSAGE, details={"portfolioId": portfolio_id[:100]})


@router.get(
    "/portfolios/{portfolio_id}",
    response_model=PortfolioMetadata,
    summary="Portfolio metadata (sourced from the CRM)",
    description=(
        "Calls the CRM, finds the account by `acct_ref` wherever the CRM nests it, and maps the legacy fields "
        "into the schema below. Values the CRM leaves out or sends in an unusable form come back as `null`, "
        "with an explanation in `warnings`.\n\n"
        "Each kind of CRM failure has its own status: `502` for bad data, `503` for an outage and `504` for "
        "a timeout."
    ),
    responses={
        400: error_doc("The id is not a valid portfolio id. The CRM is not called.", INVALID_ID_EXAMPLE),
        404: error_doc("The CRM has no account with this id.", NOT_FOUND_EXAMPLE),
        502: error_doc(
            "The CRM answered with data that could not be interpreted safely.",
            error_example(
                "crm_bad_response",
                "The portfolio service (CRM) returned data that could not be used.",
                {"reason": "CRM client_record has no usable client_id"},
            ),
        ),
        503: error_doc(
            "The CRM is down or returned a server error (a 503 or refused connection is retried first). "
            "Includes a Retry-After header.",
            error_example(
                "crm_unavailable",
                "The portfolio service (CRM) is temporarily unavailable. Please try again shortly.",
                {"upstreamStatus": 503},
            ),
        ),
        504: error_doc(
            "The CRM did not respond within the timeout.",
            error_example(
                "crm_timeout",
                "The portfolio service (CRM) did not respond in time. Please try again shortly.",
                {"timeoutSeconds": 3.0},
            ),
        ),
    },
)
async def get_portfolio(
    portfolio_id: str = Path(description="Portfolio id, such as `P-9001`", openapi_examples=PORTFOLIO_ID_EXAMPLES),
    service: PortfolioService = Depends(get_portfolio_service),
) -> PortfolioMetadata:
    validate_portfolio_id(portfolio_id)
    return await service.get_metadata(portfolio_id)

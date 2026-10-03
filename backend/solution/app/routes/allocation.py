from fastapi import APIRouter, Depends

from app.dependencies import get_allocation_service
from app.models import AllocationEntry, ErrorResponse
from app.services.allocation_service import AllocationService

router = APIRouter(tags=["allocation"])


@router.get(
    "/portfolios/{portfolio_id}/allocation",
    response_model=list[AllocationEntry],
    summary="Portfolio market value broken down by asset class",
    responses={
        404: {
            "model": ErrorResponse,
            "description": "No portfolio with this id. A portfolio with no holdings returns [] instead.",
        },
    },
)
def get_allocation(
    portfolio_id: str, service: AllocationService = Depends(get_allocation_service)
) -> list[AllocationEntry]:
    return service.get_allocation(portfolio_id)

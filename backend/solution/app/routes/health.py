from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.crm.client import CrmClient
from app.dependencies import get_crm_client

router = APIRouter(tags=["health"])


def json_example(description: str, example: dict[str, str]) -> dict:
    return {"description": description, "content": {"application/json": {"example": example}}}


@router.get(
    "/health",
    summary="Liveness: is this service running?",
    description="Answers 200 while the process is up. It never calls the CRM.",
    responses={200: json_example("The service is running.", {"status": "ok"})},
)
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get(
    "/health/ready",
    summary="Readiness: is this service running and can it reach the CRM?",
    responses={
        200: json_example("The CRM is reachable.", {"status": "ok", "crm": "ok"}),
        503: json_example("The CRM is unreachable.", {"status": "degraded", "crm": "unreachable"}),
    },
)
async def ready(crm: CrmClient = Depends(get_crm_client)) -> JSONResponse:
    reachable = await crm.ping()
    if reachable:
        return JSONResponse(status_code=200, content={"status": "ok", "crm": "ok"})
    return JSONResponse(status_code=503, content={"status": "degraded", "crm": "unreachable"})

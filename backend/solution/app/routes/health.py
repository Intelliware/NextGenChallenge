from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.crm.client import CrmClient
from app.dependencies import get_crm_client

router = APIRouter(tags=["health"])


@router.get("/health", summary="Liveness: is this service running?")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/ready", summary="Readiness: is this service running and can it reach the CRM?")
async def ready(crm: CrmClient = Depends(get_crm_client)) -> JSONResponse:
    reachable = await crm.ping()
    if reachable:
        return JSONResponse(status_code=200, content={"status": "ok", "crm": "ok"})
    return JSONResponse(status_code=503, content={"status": "degraded", "crm": "unreachable"})

from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request

from app.config import Settings, get_settings
from app.crm.client import CrmClient
from app.errors import register_error_handlers
from app.request_context import REQUEST_ID_HEADER, configure_logging, request_id_var, resolve_request_id
from app.routes import allocation, health, history, holdings, portfolios


def create_app(settings: Settings | None = None, *, crm_transport: httpx.AsyncBaseTransport | None = None) -> FastAPI:
    """Build the app. `crm_transport` lets tests route CRM calls to an in-process fake."""
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        async with httpx.AsyncClient(
            base_url=settings.crm_base_url,
            timeout=settings.crm_timeout_seconds,
            headers={"Accept": "application/json", "User-Agent": "portfolio-backend/1.0"},
            transport=crm_transport,
        ) as http:
            app.state.crm_client = CrmClient(http, settings)
            yield

    app = FastAPI(
        title="Portfolio Dashboard Backend",
        version="1.0.0",
        description="Wealth management portfolio dashboard API. Monetary values are CAD unless stated.",
        lifespan=lifespan,
    )
    app.state.settings = settings

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        request_id = resolve_request_id(request.headers.get(REQUEST_ID_HEADER))
        request.state.request_id = request_id
        request_id_var.set(request_id)
        response = await call_next(request)
        response.headers[REQUEST_ID_HEADER] = request_id
        return response

    register_error_handlers(app)
    app.include_router(health.router)
    app.include_router(portfolios.router)
    app.include_router(holdings.router)
    app.include_router(history.router)
    app.include_router(allocation.router)
    return app


app = create_app()

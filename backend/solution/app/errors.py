import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.crm.errors import CrmBadResponse, CrmError, CrmNotFound, CrmTimeout, CrmUnavailable
from app.models import ErrorResponse
from app.request_context import REQUEST_ID_HEADER, resolve_request_id

logger = logging.getLogger("app.errors")

RETRY_AFTER_SECONDS = 5


class ApiError(Exception):
    """An error raised by our own route logic, with a fixed status and error code."""

    status_code = 500
    error = "internal_error"

    def __init__(self, message: str, *, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.message = message
        self.details = details


class InvalidPortfolioId(ApiError):
    status_code = 400
    error = "invalid_portfolio_id"


def _request_id(request: Request) -> str:
    request_id = getattr(request.state, "request_id", None)
    if request_id is None:
        request_id = resolve_request_id(request.headers.get(REQUEST_ID_HEADER))
        request.state.request_id = request_id
    return request_id


def error_response(
    request: Request,
    status_code: int,
    error: str,
    message: str,
    *,
    details: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    request_id = _request_id(request)
    body = ErrorResponse(error=error, message=message, request_id=request_id, details=details)
    return JSONResponse(
        status_code=status_code,
        content=jsonable_encoder(body.model_dump(by_alias=True, exclude_none=True)),
        headers={**(headers or {}), REQUEST_ID_HEADER: request_id},
    )


def crm_error_response(request: Request, exc: CrmError) -> JSONResponse:
    if isinstance(exc, CrmNotFound):
        return error_response(
            request, 404, "portfolio_not_found", f"No portfolio found with id '{exc.portfolio_id}'."
        )
    if isinstance(exc, CrmTimeout):
        details = {"timeoutSeconds": exc.timeout_seconds} if exc.timeout_seconds is not None else None
        return error_response(
            request,
            504,
            "crm_timeout",
            "The portfolio service (CRM) did not respond in time. Please try again shortly.",
            details=details,
        )
    if isinstance(exc, CrmUnavailable):
        details = {"upstreamStatus": exc.upstream_status} if exc.upstream_status is not None else None
        return error_response(
            request,
            503,
            "crm_unavailable",
            "The portfolio service (CRM) is temporarily unavailable. Please try again shortly.",
            details=details,
            headers={"Retry-After": str(RETRY_AFTER_SECONDS)},
        )
    if isinstance(exc, CrmBadResponse):
        return error_response(
            request,
            502,
            "crm_bad_response",
            "The portfolio service (CRM) returned data that could not be used.",
            details={"reason": exc.message},
        )
    return error_response(request, 502, "crm_error", "The portfolio service (CRM) failed.")


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def handle_api_error(request: Request, exc: ApiError) -> JSONResponse:
        return error_response(request, exc.status_code, exc.error, exc.message, details=exc.details)

    @app.exception_handler(CrmError)
    async def handle_crm_error(request: Request, exc: CrmError) -> JSONResponse:
        return crm_error_response(request, exc)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        return error_response(
            request, 400, "bad_request", "The request is invalid.", details={"errors": exc.errors()}
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        codes = {404: ("not_found", "No such route."), 405: ("method_not_allowed", "Method not allowed.")}
        error, message = codes.get(exc.status_code, ("http_error", str(exc.detail)))
        return error_response(request, exc.status_code, error, message, headers=getattr(exc, "headers", None))

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled_error path=%s", request.url.path)
        return error_response(request, 500, "internal_error", "An unexpected error occurred.")

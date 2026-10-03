"""Bearer-token check in front of every route except the health checks and the API docs.

It is middleware rather than a per-route dependency, so a route added later is protected without anyone
remembering to opt in. Public paths are matched exactly, never by prefix.
"""

import hmac
import logging

from fastapi import Request, Response
from starlette.middleware.base import RequestResponseEndpoint

from app.errors import Unauthorized, error_response

logger = logging.getLogger("app.auth")

PUBLIC_PATHS = frozenset({"/health", "/health/ready", "/docs", "/docs/oauth2-redirect", "/redoc", "/openapi.json"})

MISSING_TOKEN_MESSAGE = "Missing Authorization header. Send 'Authorization: Bearer <token>'."
MALFORMED_HEADER_MESSAGE = "The Authorization header must look like 'Bearer <token>'."
INVALID_TOKEN_MESSAGE = "The token is not valid."


def check_bearer_token(header: str | None, expected_token: str) -> None:
    """Raise Unauthorized unless the header is "Bearer <expected_token>". The scheme is case-insensitive (RFC 7235)."""
    if header is None or not header.strip():
        raise Unauthorized(MISSING_TOKEN_MESSAGE)
    scheme, _, token = header.strip().partition(" ")
    token = token.strip()
    if scheme.lower() != "bearer" or not token:
        raise Unauthorized(MALFORMED_HEADER_MESSAGE)
    # Compared as bytes: compare_digest raises TypeError for non-ASCII strings, which would be a 500.
    if not hmac.compare_digest(token.encode(), expected_token.encode()):
        raise Unauthorized(INVALID_TOKEN_MESSAGE)


async def require_bearer_token(request: Request, call_next: RequestResponseEndpoint) -> Response:
    if request.url.path not in PUBLIC_PATHS:
        expected = request.app.state.settings.api_token.get_secret_value()
        try:
            check_bearer_token(request.headers.get("Authorization"), expected)
        except Unauthorized as exc:
            logger.info("auth_rejected path=%s reason=%r", request.url.path, exc.message)
            return error_response(
                request, exc.status_code, exc.error, exc.message, headers={"WWW-Authenticate": "Bearer"}
            )
    return await call_next(request)

"""What the interactive docs show: the overview, tag order, Swagger UI settings, and error examples.

Swagger UI is served at /docs and ReDoc at /redoc.
"""

from typing import Any

from fastapi import FastAPI
from fastapi.routing import APIRoute

from app.config import Settings
from app.models import ErrorResponse

OPENAPI_TAGS = [
    {
        "name": "portfolios",
        "description": "**Task 1.** Portfolio metadata, read live from the legacy CRM and mapped into a clean schema.",
    },
    {"name": "history", "description": "**Task 3.** Daily total market value for the performance chart."},
    {"name": "health", "description": "Liveness and readiness checks for monitoring."},
]

SWAGGER_UI_PARAMETERS = {"tryItOutEnabled": True, "displayRequestDuration": True}

EXAMPLE_REQUEST_ID = "7c9e6679f4e14a4bb5b2c0a1d8e3f2a1"

# Swagger UI renders every newline as a line break, so each paragraph, bullet and table row is one line.
DESCRIPTION = """\
Backend for a wealth management portfolio dashboard. Portfolio metadata is read live from a legacy CRM and \
mapped into a clean schema, and daily performance history feeds the dashboard's line chart.

**Try it:** every operation below is already in "Try it out" mode. Pick an example from a parameter's dropdown, \
then press **Execute**.

### Conventions
- JSON fields are camelCase. Money is in CAD unless a response says otherwise.
- Percentages are decimals: `0.0032` means 0.32%.
- Dates are `YYYY-MM-DD`. Timestamps are ISO 8601 in UTC and end in `Z`.
- Every response has an `X-Request-ID` header. Send your own (up to 128 letters, digits, `.`, `_` or `-`) to \
trace a request through our logs and the CRM.

### Errors
Every error body has `error` (a stable code), `message`, `requestId` (the same value as the `X-Request-ID` \
header) and sometimes `details`.

| Status | `error` | Meaning |
| --- | --- | --- |
| 400 | `invalid_portfolio_id`, `invalid_range` | Bad input. An invalid id never reaches the CRM. |
| 404 | `portfolio_not_found` | No portfolio has this id. |
| 502 | `crm_bad_response` | The CRM sent data we can't interpret safely. |
| 503 | `crm_unavailable`, `history_unavailable` | The CRM is down (a `Retry-After` header says when to try \
again), or the history data file is missing. |
| 504 | `crm_timeout` | The CRM didn't answer in time. |
| 500 | `internal_error` | Something unexpected failed. No internal details are exposed. |

### When the CRM misbehaves
- Each CRM attempt times out after **{timeout:g} s**, and a request never spends more than **{budget:g} s** on \
the CRM in total, so nothing hangs.
- A CRM `503` or a refused connection {retries}. Timeouts aren't retried, because that would double the wait.
- Values the CRM leaves out or sends in an unusable form come back as `null`, with an explanation in \
`warnings`. A real `0` stays `0`.
"""


def api_description(settings: Settings) -> str:
    retries = {0: "isn't retried", 1: "is retried once"}.get(
        settings.crm_max_retries, f"is retried up to {settings.crm_max_retries} times"
    )
    return DESCRIPTION.format(
        timeout=settings.crm_timeout_seconds, budget=settings.crm_total_budget_seconds, retries=retries
    )


def operation_id(route: APIRoute) -> str:
    """The endpoint function's name, which keeps links such as /docs#/portfolios/get_portfolio short."""
    return route.name


def error_example(error: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    body = ErrorResponse(error=error, message=message, request_id=EXAMPLE_REQUEST_ID, details=details)
    return body.model_dump(by_alias=True, exclude_none=True)


def error_doc(description: str, *examples: dict[str, Any]) -> dict[str, Any]:
    """A `responses=` entry: the shared error schema, with one example body per error code it covers."""
    if len(examples) == 1:
        media: dict[str, Any] = {"example": examples[0]}
    else:
        media = {"examples": {body["error"]: {"value": body} for body in examples}}
    return {"model": ErrorResponse, "description": description, "content": {"application/json": media}}


def hide_validation_error_docs(app: FastAPI) -> None:
    """FastAPI documents a 422 for every route with parameters, but our handler answers 400 bad_request instead."""
    generate = app.openapi

    def openapi() -> dict[str, Any]:
        if app.openapi_schema is None:
            schema = generate()
            for path_item in schema.get("paths", {}).values():
                for operation in path_item.values():
                    operation.get("responses", {}).pop("422", None)
            for name in ("HTTPValidationError", "ValidationError"):
                schema.get("components", {}).get("schemas", {}).pop(name, None)
        return app.openapi_schema

    app.openapi = openapi

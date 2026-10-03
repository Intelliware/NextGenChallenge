import asyncio
import logging
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote

import httpx

from app.config import Settings
from app.crm.errors import CrmBadResponse, CrmError, CrmNotFound, CrmTimeout, CrmUnavailable
from app.request_context import REQUEST_ID_HEADER, request_id_var

logger = logging.getLogger("app.crm")

# Only failures that are quick and likely transient are retried. A timeout is never retried:
# it has already consumed most of the time budget, and retrying would double the caller's wait.
RETRYABLE_STATUSES = frozenset({503})
MIN_ATTEMPT_SECONDS = 0.5
PING_TIMEOUT_SECONDS = 1.0


@dataclass
class _Attempt:
    payload: dict[str, Any] | None = None
    error: CrmError | None = None
    status: int | None = None
    retryable: bool = False


class CrmClient:
    def __init__(
        self,
        http: httpx.AsyncClient,
        settings: Settings,
        *,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
        clock: Callable[[], float] = time.monotonic,
    ):
        self._http = http
        self._timeout = settings.crm_timeout_seconds
        self._max_retries = settings.crm_max_retries
        self._backoff = settings.crm_retry_backoff_seconds
        self._budget = settings.crm_total_budget_seconds
        self._sleep = sleep
        self._clock = clock

    async def fetch_portfolio(self, portfolio_id: str) -> dict[str, Any]:
        """Return the raw CRM payload for a portfolio, or raise a CrmError subclass."""
        path = f"/crm/portfolios/{quote(portfolio_id, safe='')}"
        deadline = self._clock() + self._budget
        attempt_number = 0
        while True:
            attempt_number += 1
            started = self._clock()
            result = await self._attempt(path, portfolio_id, timeout=min(self._timeout, deadline - started))
            outcome = "ok" if result.error is None else type(result.error).__name__
            self._log(portfolio_id, attempt_number, started, outcome, result.status)
            if result.error is None:
                assert result.payload is not None
                return result.payload
            remaining = deadline - self._clock()
            can_retry = attempt_number <= self._max_retries and remaining > self._backoff + MIN_ATTEMPT_SECONDS
            if result.retryable and can_retry:
                await self._sleep(self._backoff)
                continue
            raise result.error

    async def ping(self) -> bool:
        try:
            response = await self._http.get("/health", timeout=PING_TIMEOUT_SECONDS)
        except httpx.HTTPError:
            return False
        return response.status_code == 200

    async def _attempt(self, path: str, portfolio_id: str, *, timeout: float) -> _Attempt:
        if timeout <= 0:
            return _Attempt(error=CrmTimeout("CRM time budget exhausted", portfolio_id=portfolio_id, timeout_seconds=self._budget))
        headers = {}
        request_id = request_id_var.get()
        if request_id != "-":
            headers[REQUEST_ID_HEADER] = request_id
        try:
            response = await self._http.get(path, timeout=timeout, headers=headers)
        except httpx.TimeoutException:
            message = f"CRM did not respond within {timeout:g}s"
            return _Attempt(error=CrmTimeout(message, portfolio_id=portfolio_id, timeout_seconds=self._timeout))
        except httpx.TransportError as exc:
            message = f"Could not connect to CRM ({type(exc).__name__})"
            return _Attempt(error=CrmUnavailable(message, portfolio_id=portfolio_id), retryable=True)

        status = response.status_code
        if status == 200:
            try:
                return _Attempt(payload=self._parse_json(response, portfolio_id), status=status)
            except CrmBadResponse as error:
                return _Attempt(error=error, status=status)
        if status == 404:
            return _Attempt(error=CrmNotFound("CRM has no account with this reference", portfolio_id=portfolio_id), status=status)
        if status == 504:
            error = CrmTimeout("CRM reported a gateway timeout", portfolio_id=portfolio_id, timeout_seconds=self._timeout)
            return _Attempt(error=error, status=status)
        if status >= 500 or status == 429:
            error = CrmUnavailable(f"CRM returned HTTP {status}", portfolio_id=portfolio_id, upstream_status=status)
            return _Attempt(error=error, status=status, retryable=status in RETRYABLE_STATUSES)
        return _Attempt(error=CrmBadResponse(f"CRM returned unexpected HTTP {status}", portfolio_id=portfolio_id), status=status)

    @staticmethod
    def _parse_json(response: httpx.Response, portfolio_id: str) -> dict[str, Any]:
        try:
            payload = response.json()
        except ValueError as exc:
            content_type = response.headers.get("content-type", "unknown")
            raise CrmBadResponse(
                f"CRM response was not valid JSON (content-type: {content_type})", portfolio_id=portfolio_id
            ) from exc
        if not isinstance(payload, dict):
            raise CrmBadResponse("CRM response body was not a JSON object", portfolio_id=portfolio_id)
        return payload

    def _log(self, portfolio_id: str, attempt: int, started: float, outcome: str, status: int | None) -> None:
        logger.info(
            "crm_call portfolio=%s attempt=%d outcome=%s status=%s latency_ms=%.1f",
            portfolio_id,
            attempt,
            outcome,
            status if status is not None else "-",
            (self._clock() - started) * 1000,
        )

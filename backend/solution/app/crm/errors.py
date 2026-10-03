class CrmError(Exception):
    """Base class for every way a CRM lookup can fail. Translated to HTTP in app/errors.py."""

    def __init__(self, message: str, *, portfolio_id: str | None = None):
        super().__init__(message)
        self.message = message
        self.portfolio_id = portfolio_id


class CrmNotFound(CrmError):
    """The CRM has no account with the requested reference."""


class CrmTimeout(CrmError):
    """The CRM did not answer within our time limit (or reported its own gateway timeout)."""

    def __init__(self, message: str, *, portfolio_id: str | None = None, timeout_seconds: float | None = None):
        super().__init__(message, portfolio_id=portfolio_id)
        self.timeout_seconds = timeout_seconds


class CrmUnavailable(CrmError):
    """The CRM could not be reached or answered with a server error."""

    def __init__(self, message: str, *, portfolio_id: str | None = None, upstream_status: int | None = None):
        super().__init__(message, portfolio_id=portfolio_id)
        self.upstream_status = upstream_status


class CrmBadResponse(CrmError):
    """The CRM answered, but with something we cannot safely interpret."""

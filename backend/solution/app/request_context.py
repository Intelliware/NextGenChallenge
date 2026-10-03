import logging
import re
import uuid
from contextvars import ContextVar

REQUEST_ID_HEADER = "X-Request-ID"
_VALID_INCOMING_ID = re.compile(r"^[A-Za-z0-9._-]{1,128}$")

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")


def resolve_request_id(incoming: str | None) -> str:
    """Reuse a caller-supplied request id when it is safe to echo, otherwise mint a new one."""
    if incoming and _VALID_INCOMING_ID.fullmatch(incoming):
        return incoming
    return uuid.uuid4().hex


class RequestIdLogFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


def configure_logging(level: str) -> None:
    logger = logging.getLogger("app")
    logger.setLevel(level.upper())
    if not any(getattr(h, "_app_handler", False) for h in logger.handlers):
        handler = logging.StreamHandler()
        handler._app_handler = True  # type: ignore[attr-defined]
        handler.addFilter(RequestIdLogFilter())
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s %(name)s request_id=%(request_id)s %(message)s")
        )
        logger.addHandler(handler)

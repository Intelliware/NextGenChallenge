"""Translate the legacy CRM payload into our PortfolioMetadata schema.

Pure functions only: no I/O, so every quirk can be unit-tested from a fixture file.

Rules:
- Identity fields (client_id, acct_ref) are required. Without them the payload is unusable -> CrmBadResponse.
- Every other field is optional. A missing/invalid value becomes null plus a human-readable warning,
  so partial data is still served but never silently wrong. 0 is a real value and is kept as 0.
"""

import math
import re
from datetime import datetime, timezone
from typing import Any

from app.crm.errors import CrmBadResponse, CrmNotFound
from app.models import PortfolioMetadata

BASE_CURRENCY = "CAD"
ACCOUNT_LOCATIONS: tuple[tuple[str, ...], ...] = (("accounts",), ("relationships", "accounts"))

_PLAIN_NUMBER = re.compile(r"^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$")
_GROUPED_NUMBER = re.compile(r"^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$")
_CURRENCY_CODE = re.compile(r"^[A-Z]{3}$")


def map_portfolio(payload: Any, requested_id: str) -> PortfolioMetadata:
    if not isinstance(payload, dict):
        raise CrmBadResponse("CRM response body was not a JSON object", portfolio_id=requested_id)
    record = payload.get("client_record")
    if not isinstance(record, dict):
        raise CrmBadResponse("CRM response is missing client_record", portfolio_id=requested_id)

    client_id = _required_id(record.get("client_id"))
    if client_id is None:
        raise CrmBadResponse("CRM client_record has no usable client_id", portfolio_id=requested_id)

    account = find_account(record, requested_id)
    warnings: list[str] = []

    amount_raw, currency_raw = _split_current_value(account.get("curr_val"))
    change = account.get("chg_1d")
    if change is not None and not isinstance(change, dict):
        warnings.append("chg_1d from CRM was not an object; day change fields set to null")
        change = None
    change = change or {}

    label = _label(account.get("acct_nickname"), warnings)
    currency = _currency(currency_raw, warnings)
    total_market_value = _number(amount_raw, "totalMarketValue", warnings)
    day_change_amount = _number(change.get("amt"), "dayChangeAmount", warnings)
    day_change_percent = _number(change.get("pct"), "dayChangePercent", warnings)
    since_inception = _number(account.get("since_inception_pct"), "totalReturnSinceInception", warnings)
    as_of = _as_of(payload.get("meta"), warnings)
    if day_change_percent == 0 and day_change_amount not in (None, 0):
        warnings.append(
            "dayChangePercent is 0 but dayChangeAmount is not; the CRM reports 0% when the previous value "
            "was zero, so the percentage is not meaningful"
        )

    return PortfolioMetadata(
        portfolio_id=requested_id,
        client_id=client_id,
        label=label,
        currency=currency,
        total_market_value=total_market_value,
        day_change_amount=day_change_amount,
        day_change_percent=day_change_percent,
        total_return_since_inception=since_inception,
        as_of=as_of,
        warnings=warnings,
    )


def find_account(record: dict[str, Any], requested_id: str) -> dict[str, Any]:
    """Locate the requested account by acct_ref, searching every known nesting location."""
    lists_found = 0
    accounts: list[Any] = []
    for location in ACCOUNT_LOCATIONS:
        value: Any = record
        for key in location:
            value = value.get(key) if isinstance(value, dict) else None
        if value is None:
            continue
        if not isinstance(value, list):
            raise CrmBadResponse(f"CRM field {'.'.join(location)} is not a list", portfolio_id=requested_id)
        lists_found += 1
        accounts.extend(value)

    if lists_found == 0:
        raise CrmBadResponse("CRM client_record has no accounts list", portfolio_id=requested_id)

    matches: list[dict[str, Any]] = []
    has_unidentified = False
    for account in accounts:
        if not isinstance(account, dict) or not isinstance(account.get("acct_ref"), str):
            has_unidentified = True
            continue
        if account["acct_ref"] == requested_id and account not in matches:
            matches.append(account)

    if len(matches) > 1:
        raise CrmBadResponse(
            f"CRM returned {len(matches)} conflicting accounts with acct_ref {requested_id}",
            portfolio_id=requested_id,
        )
    if matches:
        return matches[0]
    if has_unidentified:
        raise CrmBadResponse(
            "CRM returned an account without an acct_ref, so the requested account cannot be identified",
            portfolio_id=requested_id,
        )
    raise CrmNotFound("CRM has no account with this reference", portfolio_id=requested_id)


def parse_number(raw: Any) -> float | None:
    """Return a finite float for numbers and numeric strings, else None. Booleans are not numbers."""
    if isinstance(raw, bool):
        return None
    if isinstance(raw, (int, float)):
        value = float(raw)
    elif isinstance(raw, str):
        text = raw.strip()
        if _GROUPED_NUMBER.fullmatch(text):
            text = text.replace(",", "")
        elif not _PLAIN_NUMBER.fullmatch(text):
            return None
        value = float(text)
    else:
        return None
    return value if math.isfinite(value) else None


def _required_id(raw: Any) -> str | None:
    if isinstance(raw, bool):
        return None
    if isinstance(raw, int):
        return str(raw)
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return None


def _split_current_value(curr_val: Any) -> tuple[Any, Any]:
    """curr_val is normally {amt, ccy}; some legacy records send a bare number instead."""
    if isinstance(curr_val, dict):
        return curr_val.get("amt"), curr_val.get("ccy")
    return curr_val, None


def _number(raw: Any, field: str, warnings: list[str]) -> float | None:
    if raw is None:
        warnings.append(f"{field} missing from CRM")
        return None
    value = parse_number(raw)
    if value is None:
        warnings.append(f"{field} from CRM was not a valid number ({raw!r}); set to null")
    return value


def _label(raw: Any, warnings: list[str]) -> str | None:
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    warnings.append("label missing from CRM (acct_nickname)")
    return None


def _currency(raw: Any, warnings: list[str]) -> str:
    if raw is None:
        warnings.append(f"currency missing from CRM; assumed base currency {BASE_CURRENCY}")
        return BASE_CURRENCY
    code = raw.strip().upper() if isinstance(raw, str) else ""
    if _CURRENCY_CODE.fullmatch(code):
        return code
    warnings.append(f"currency from CRM was not a valid code ({raw!r}); assumed base currency {BASE_CURRENCY}")
    return BASE_CURRENCY


def _as_of(meta: Any, warnings: list[str]) -> str | None:
    raw = meta.get("retrieved_at") if isinstance(meta, dict) else None
    if raw is None:
        warnings.append("asOf missing from CRM (meta.retrieved_at)")
        return None
    if not isinstance(raw, str):
        warnings.append(f"asOf from CRM was not a valid timestamp ({raw!r}); set to null")
        return None
    try:
        parsed = datetime.fromisoformat(raw.strip())
    except ValueError:
        warnings.append(f"asOf from CRM was not a valid timestamp ({raw!r}); set to null")
        return None
    if parsed.tzinfo is None:
        warnings.append("asOf from CRM had no timezone; assumed UTC")
        parsed = parsed.replace(tzinfo=timezone.utc)
    return format_utc(parsed)


def format_utc(value: datetime) -> str:
    utc = value.astimezone(timezone.utc)
    timespec = "milliseconds" if utc.microsecond else "seconds"
    return utc.isoformat(timespec=timespec).replace("+00:00", "Z")

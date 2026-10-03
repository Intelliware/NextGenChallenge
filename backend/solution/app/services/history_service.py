"""Daily performance history, filtered to a date range.

Rules:
- Every range ends today (UTC, matching the history generator) and includes both ends.
- The window is chosen by date, not by counting points, so gaps in the data still give the right window.
- Less history than the range covers is returned as-is, never padded. Snapshots dated after today are dropped.
"""

import calendar
import json
import logging
from collections.abc import Callable, Collection, Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from enum import StrEnum
from functools import lru_cache
from pathlib import Path

from app.errors import HistoryUnavailable, InvalidRange, PortfolioNotFound
from app.models import PerformanceSnapshot

logger = logging.getLogger("app.history")

GENERATOR_COMMAND = "node backend/fixtures/generate-history.mjs"


class HistoryRange(StrEnum):
    ONE_DAY = "1D"
    ONE_MONTH = "1M"
    YEAR_TO_DATE = "YTD"
    ONE_YEAR = "1Y"
    ALL = "All"


@dataclass(frozen=True)
class Snapshot:
    day: date
    market_value: float


def utc_today() -> date:
    return datetime.now(timezone.utc).date()


def parse_range(raw: str | None) -> HistoryRange:
    """None means the parameter was omitted. Matching is exact, so "all" or "" is rejected, not defaulted."""
    if raw is None:
        return HistoryRange.ALL
    try:
        return HistoryRange(raw)
    except ValueError:
        allowed = [history_range.value for history_range in HistoryRange]
        raise InvalidRange(
            f"range must be one of {', '.join(allowed)}.",
            details={"range": raw[:100], "allowed": allowed},
        ) from None


def range_start(history_range: HistoryRange, today: date) -> date | None:
    """First date inside the window, or None when there is no lower bound."""
    match history_range:
        case HistoryRange.ONE_DAY:
            return today - timedelta(days=1)
        case HistoryRange.ONE_MONTH:
            return _months_before(today, 1)
        case HistoryRange.YEAR_TO_DATE:
            return date(today.year, 1, 1)
        case HistoryRange.ONE_YEAR:
            return _months_before(today, 12)
        case HistoryRange.ALL:
            return None


def filter_snapshots(snapshots: Iterable[Snapshot], history_range: HistoryRange, today: date) -> list[Snapshot]:
    """Snapshots inside the window, oldest first."""
    start = range_start(history_range, today)
    inside = (s for s in snapshots if s.day <= today and (start is None or s.day >= start))
    return sorted(inside, key=lambda snapshot: snapshot.day)


@lru_cache
def load_history_file(path: Path) -> dict[str, tuple[Snapshot, ...]]:
    """Parse the generator's output, {portfolioId: [{date, marketValue}, ...]}. Cached after the first success."""
    try:
        raw = json.loads(path.read_text())
        return {
            portfolio_id: tuple(
                Snapshot(date.fromisoformat(entry["date"]), float(entry["marketValue"])) for entry in entries
            )
            for portfolio_id, entries in raw.items()
        }
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as exc:
        logger.error("history_unavailable path=%s reason=%s fix=%r", path, exc, f"run {GENERATOR_COMMAND}")
        raise HistoryUnavailable("Performance history data is not available.") from exc


@lru_cache
def load_portfolio_ids(path: Path) -> frozenset[str]:
    """Every portfolio in seed.json. A known id with no history gets [], an unknown id gets 404."""
    seed = json.loads(path.read_text())
    return frozenset(portfolio["portfolioId"] for portfolio in seed["portfolios"])


class HistoryService:
    def __init__(
        self,
        history: Mapping[str, Sequence[Snapshot]],
        portfolio_ids: Collection[str],
        *,
        today: Callable[[], date] = utc_today,
    ):
        self._history = history
        self._portfolio_ids = portfolio_ids
        self._today = today

    def get_history(self, portfolio_id: str, history_range: HistoryRange) -> list[PerformanceSnapshot]:
        if portfolio_id not in self._portfolio_ids:
            raise PortfolioNotFound(f"No portfolio found with id '{portfolio_id}'.")
        snapshots = filter_snapshots(self._history.get(portfolio_id, ()), history_range, self._today())
        return [_to_response(snapshot) for snapshot in snapshots]


def _months_before(day: date, months: int) -> date:
    """Same day of the month, `months` earlier, clamped to that month's last day (Mar 31 -> Feb 28)."""
    year, month_index = divmod(day.year * 12 + day.month - 1 - months, 12)
    month = month_index + 1
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


def _to_response(snapshot: Snapshot) -> PerformanceSnapshot:
    return PerformanceSnapshot(date=snapshot.day.isoformat(), market_value=snapshot.market_value)

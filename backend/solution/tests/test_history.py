"""Task 3: GET /portfolios/{id}/performance-history.

Tests pin today to TODAY and build their own snapshots, so none of them depends on the real clock
or on the generated performance-history.json.
"""

import json
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_history_service
from app.errors import HistoryUnavailable, InvalidRange
from app.main import create_app
from app.services.history_service import (
    HistoryRange,
    HistoryService,
    Snapshot,
    filter_snapshots,
    load_history_file,
    load_portfolio_ids,
    parse_range,
    range_start,
    utc_today,
)
from tests.conftest import make_settings
from tests.test_portfolios_api import assert_error

TODAY = date(2026, 10, 3)
ALLOWED = ["1D", "1M", "YTD", "1Y", "All"]
HISTORY_URL = "/portfolios/{}/performance-history"

# range -> (first date kept, number of points) for 401 days of data ending TODAY
WINDOWS = {
    "1D": (date(2026, 10, 2), 2),
    "1M": (date(2026, 9, 3), 31),
    "YTD": (date(2026, 1, 1), 276),
    "1Y": (date(2025, 10, 3), 366),
    "All": (date(2025, 8, 29), 401),
}


def daily(count: int, end: date = TODAY) -> list[Snapshot]:
    """`count` consecutive days ending on `end`, valued 100, 101, 102, ..."""
    return [Snapshot(end - timedelta(days=count - 1 - i), 100.0 + i) for i in range(count)]


def days(snapshots: list[Snapshot]) -> list[date]:
    return [snapshot.day for snapshot in snapshots]


# --- Pure functions ---


@pytest.mark.parametrize("raw_range", WINDOWS)
def test_each_range_keeps_its_window(raw_range):
    first_day, count = WINDOWS[raw_range]
    result = filter_snapshots(daily(401), HistoryRange(raw_range), TODAY)
    assert (len(result), result[0].day, result[-1].day) == (count, first_day, TODAY)


@pytest.mark.parametrize(
    ("today", "history_range", "expected"),
    [
        (date(2026, 3, 31), HistoryRange.ONE_MONTH, date(2026, 2, 28)),
        (date(2028, 3, 31), HistoryRange.ONE_MONTH, date(2028, 2, 29)),
        (date(2026, 5, 31), HistoryRange.ONE_MONTH, date(2026, 4, 30)),
        (date(2026, 1, 15), HistoryRange.ONE_MONTH, date(2025, 12, 15)),
        (date(2028, 2, 29), HistoryRange.ONE_YEAR, date(2027, 2, 28)),
        (date(2026, 1, 1), HistoryRange.ONE_DAY, date(2025, 12, 31)),
        (date(2026, 1, 1), HistoryRange.YEAR_TO_DATE, date(2026, 1, 1)),
    ],
    ids=["mar31_to_feb28", "leap_year_mar31_to_feb29", "may31_to_apr30", "across_new_year", "feb29_to_feb28",
         "1d_across_new_year", "ytd_on_jan1"],
)
def test_range_start_at_month_and_year_edges(today, history_range, expected):
    assert range_start(history_range, today) == expected


def test_all_has_no_start():
    assert range_start(HistoryRange.ALL, TODAY) is None


def test_ytd_starts_on_january_first_not_at_the_first_data_point():
    result = filter_snapshots(daily(401), HistoryRange.YEAR_TO_DATE, TODAY)
    assert result[0].day == date(2026, 1, 1)
    assert date(2025, 12, 31) not in days(result)


@pytest.mark.parametrize("history_range", [HistoryRange.YEAR_TO_DATE, HistoryRange.ONE_YEAR, HistoryRange.ALL])
def test_less_history_than_the_range_returns_what_exists_without_padding(history_range):
    three_months = daily(92)
    assert filter_snapshots(three_months, history_range, TODAY) == three_months


def test_window_is_chosen_by_date_so_gaps_do_not_shift_it():
    weekdays_only = [snapshot for snapshot in daily(60) if snapshot.day.weekday() < 5]
    one_month = filter_snapshots(weekdays_only, HistoryRange.ONE_MONTH, TODAY)
    assert (one_month[0].day, one_month[-1].day) == (date(2026, 9, 3), date(2026, 10, 2))
    # TODAY is a Saturday: 1D covers Friday and Saturday, and only Friday has data.
    assert days(filter_snapshots(weekdays_only, HistoryRange.ONE_DAY, TODAY)) == [date(2026, 10, 2)]


@pytest.mark.parametrize("history_range", list(HistoryRange))
def test_no_history_gives_an_empty_list(history_range):
    assert filter_snapshots([], history_range, TODAY) == []


@pytest.mark.parametrize("history_range", list(HistoryRange))
def test_snapshots_dated_after_today_are_dropped(history_range):
    tomorrow = TODAY + timedelta(days=1)
    result = filter_snapshots(daily(3) + [Snapshot(tomorrow, 999.0)], history_range, TODAY)
    assert tomorrow not in days(result)


def test_results_are_oldest_first_even_if_the_source_is_not():
    data = daily(5)
    assert filter_snapshots(list(reversed(data)), HistoryRange.ALL, TODAY) == data


@pytest.mark.parametrize("raw", ALLOWED)
def test_parse_range_accepts_each_allowed_value(raw):
    assert parse_range(raw).value == raw


def test_omitted_range_defaults_to_all():
    assert parse_range(None) is HistoryRange.ALL


@pytest.mark.parametrize("raw", ["invalid", "1W", "all", "ytd", "1d", " 1D", ""])
def test_parse_range_rejects_anything_else_instead_of_defaulting(raw):
    with pytest.raises(InvalidRange) as caught:
        parse_range(raw)
    assert caught.value.details == {"range": raw, "allowed": ALLOWED}


# --- Loading the data files ---


def test_loader_reads_the_generator_format(tmp_path):
    path = tmp_path / "history.json"
    path.write_text(json.dumps({
        "P-9001": [{"date": "2026-10-02", "marketValue": 48917.8}, {"date": "2026-10-03", "marketValue": 48930}],
        "P-EMPTY": [],
    }))
    assert load_history_file(path) == {
        "P-9001": (Snapshot(date(2026, 10, 2), 48917.8), Snapshot(date(2026, 10, 3), 48930.0)),
        "P-EMPTY": (),
    }


def test_missing_history_file_raises_and_logs_how_to_generate_it(tmp_path, caplog):
    with pytest.raises(HistoryUnavailable):
        load_history_file(tmp_path / "missing.json")
    assert "node backend/fixtures/generate-history.mjs" in caplog.text


@pytest.mark.parametrize(
    "content",
    ["not json", "[]", '{"P-9001": [{"date": "yesterday", "marketValue": 1}]}', '{"P-9001": [{"marketValue": 1}]}'],
    ids=["not_json", "not_an_object", "bad_date", "missing_date"],
)
def test_unreadable_history_file_raises_history_unavailable(tmp_path, content):
    path = tmp_path / "history.json"
    path.write_text(content)
    with pytest.raises(HistoryUnavailable):
        load_history_file(path)


def test_portfolio_ids_come_from_seed_json():
    assert load_portfolio_ids(make_settings().seed_file) == {"P-9001", "P-9002", "P-EMPTY", "P-SINGLE"}


# --- HTTP ---


@pytest.fixture
def client():
    app = create_app(make_settings())
    service = HistoryService(
        {"P-9001": daily(401), "P-9002": daily(60)}, {"P-9001", "P-9002", "P-EMPTY"}, today=lambda: TODAY
    )
    app.dependency_overrides[get_history_service] = lambda: service
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


@pytest.mark.parametrize("raw_range", WINDOWS)
def test_endpoint_returns_each_window(client, raw_range):
    first_day, count = WINDOWS[raw_range]
    response = client.get(HISTORY_URL.format("P-9001"), params={"range": raw_range})
    assert response.status_code == 200
    body = response.json()
    assert (len(body), body[0]["date"], body[-1]["date"]) == (count, first_day.isoformat(), TODAY.isoformat())


def test_snapshots_have_the_documented_shape(client):
    response = client.get(HISTORY_URL.format("P-9001"), params={"range": "1D"})
    assert response.json() == [{"date": "2026-10-02", "marketValue": 499.0}, {"date": "2026-10-03", "marketValue": 500.0}]


def test_omitted_range_returns_all_history(client):
    body = client.get(HISTORY_URL.format("P-9001")).json()
    assert len(body) == 401
    assert body == client.get(HISTORY_URL.format("P-9001"), params={"range": "All"}).json()


def test_short_history_with_1y_returns_all_of_it(client):
    body = client.get(HISTORY_URL.format("P-9002"), params={"range": "1Y"}).json()
    assert len(body) == 60


@pytest.mark.parametrize("bad_range", ["invalid", "1W", "all", ""])
def test_invalid_range_returns_400(client, bad_range):
    response = client.get(HISTORY_URL.format("P-9001"), params={"range": bad_range})
    body = assert_error(response, 400, "invalid_range")
    assert body["details"] == {"range": bad_range, "allowed": ALLOWED}


def test_unknown_portfolio_returns_404(client):
    body = assert_error(client.get(HISTORY_URL.format("P-0000")), 404, "portfolio_not_found")
    assert "P-0000" in body["message"]


def test_portfolio_without_history_returns_empty_list(client):
    response = client.get(HISTORY_URL.format("P-EMPTY"))
    assert response.status_code == 200
    assert response.json() == []


def test_invalid_portfolio_id_returns_400(client):
    assert_error(client.get(HISTORY_URL.format("bad%20id")), 400, "invalid_portfolio_id")


def test_bad_range_is_reported_before_unknown_id(client):
    response = client.get(HISTORY_URL.format("P-0000"), params={"range": "1W"})
    assert_error(response, 400, "invalid_range")


def test_missing_history_file_returns_503(tmp_path):
    app = create_app(make_settings(history_file=tmp_path / "missing.json"))
    with TestClient(app, raise_server_exceptions=False) as test_client:
        response = test_client.get(HISTORY_URL.format("P-9001"))
    assert_error(response, 503, "history_unavailable")


def test_configured_files_are_read_by_the_real_provider(tmp_path):
    today = utc_today()
    dates = [(today - timedelta(days=n)).isoformat() for n in (2, 1, 0)]
    path = tmp_path / "history.json"
    path.write_text(json.dumps({"P-9001": [{"date": d, "marketValue": 1.0} for d in dates]}))
    with TestClient(create_app(make_settings(history_file=path))) as test_client:
        assert [point["date"] for point in test_client.get(HISTORY_URL.format("P-9001")).json()] == dates
        assert test_client.get(HISTORY_URL.format("P-SINGLE")).json() == []
        assert test_client.get(HISTORY_URL.format("UNKNOWN")).status_code == 404


def test_openapi_documents_the_range_parameter_and_every_error_status(client):
    operation = client.get("/openapi.json").json()["paths"]["/portfolios/{portfolio_id}/performance-history"]["get"]
    assert [parameter["name"] for parameter in operation["parameters"]] == ["portfolio_id", "range"]
    assert {"200", "400", "404", "503"} <= set(operation["responses"])

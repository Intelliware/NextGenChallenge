import pytest

from app.crm.errors import CrmBadResponse, CrmNotFound
from app.crm.mapper import map_portfolio, parse_number
from tests.conftest import fixture_names, load_fixture

BASE = {
    "portfolioId": "P-9001",
    "clientId": "abc123",
    "label": "Taxable Brokerage",
    "currency": "CAD",
    "totalMarketValue": 48930.0,
    "dayChangeAmount": 30.0,
    "dayChangePercent": 0.0006134969325153375,
    "totalReturnSinceInception": 0.187,
    "asOf": "2026-10-03T16:00:00Z",
    "warnings": [],
}
CURRENCY_DEFAULTED = "currency missing from CRM; assumed base currency CAD"

# fixture name -> (overrides applied to BASE, expected warning prefixes in order)
SUCCESS_CASES: dict[str, tuple[dict, list[str]]] = {
    "ok_p9001": ({}, []),
    "ok_target_not_first": ({}, []),
    "extra_unknown_fields": ({}, []),
    "nested_relationships": ({}, []),
    "accounts_in_both_locations": ({}, []),
    "lowercase_ccy": ({}, []),
    "offset_timestamp": ({}, []),
    "zero_values": (
        {"totalMarketValue": 0.0, "dayChangeAmount": 0.0, "dayChangePercent": 0.0, "totalReturnSinceInception": 0.0},
        [],
    ),
    "negative_day_change": (
        {
            "totalMarketValue": 482350.12,
            "dayChangeAmount": -1520.44,
            "dayChangePercent": -0.0031,
            "totalReturnSinceInception": -0.042,
        },
        [],
    ),
    "usd_account": (
        {
            "label": "US Dollar Account",
            "currency": "USD",
            "totalMarketValue": 12000.5,
            "dayChangeAmount": 45.25,
            "dayChangePercent": 0.003785,
            "totalReturnSinceInception": 0.091,
        },
        [],
    ),
    "large_values": (
        {
            "label": "Family Office",
            "totalMarketValue": 98765432109.87,
            "dayChangeAmount": 1234567.89,
            "dayChangePercent": 0.0000125,
            "totalReturnSinceInception": 12.5,
        },
        [],
    ),
    "numeric_strings": (
        {"totalMarketValue": 1248930.5, "dayChangeAmount": -30.0, "dayChangePercent": 0.0006},
        [],
    ),
    "curr_val_flat_number": ({}, [CURRENCY_DEFAULTED]),
    "missing_ccy": ({}, [CURRENCY_DEFAULTED]),
    "chg_1d_missing": (
        {"dayChangeAmount": None, "dayChangePercent": None},
        ["dayChangeAmount missing from CRM", "dayChangePercent missing from CRM"],
    ),
    "missing_amount_and_nickname": (
        {"label": None, "totalMarketValue": None},
        ["label missing from CRM (acct_nickname)", "totalMarketValue missing from CRM"],
    ),
    "all_numbers_null": (
        {
            "totalMarketValue": None,
            "dayChangeAmount": None,
            "dayChangePercent": None,
            "totalReturnSinceInception": None,
        },
        [
            "totalMarketValue missing from CRM",
            "dayChangeAmount missing from CRM",
            "dayChangePercent missing from CRM",
            "totalReturnSinceInception missing from CRM",
        ],
    ),
    "invalid_number_types": (
        {
            "totalMarketValue": None,
            "dayChangeAmount": None,
            "dayChangePercent": None,
            "totalReturnSinceInception": None,
        },
        [
            "totalMarketValue from CRM was not a valid number ('N/A')",
            "dayChangeAmount from CRM was not a valid number (True)",
            "dayChangePercent from CRM was not a valid number ('NaN')",
            "totalReturnSinceInception from CRM was not a valid number ({'value': 0.187})",
        ],
    ),
    "missing_meta": ({"asOf": None}, ["asOf missing from CRM (meta.retrieved_at)"]),
    "bad_timestamp": ({"asOf": None}, ["asOf from CRM was not a valid timestamp ('yesterday at noon')"]),
    "day_change_pct_zero_with_amount": (
        {
            "label": "Newly Funded Account",
            "totalMarketValue": 500.0,
            "dayChangeAmount": 500.0,
            "dayChangePercent": 0.0,
            "totalReturnSinceInception": 0.25,
        },
        ["dayChangePercent is 0 but dayChangeAmount is not"],
    ),
}

ERROR_CASES: dict[str, type[Exception]] = {
    "empty_accounts": CrmNotFound,
    "no_client_record": CrmBadResponse,
    "missing_client_id": CrmBadResponse,
    "missing_acct_ref": CrmBadResponse,
    "duplicate_acct_ref": CrmBadResponse,
}

# Not JSON, so it never reaches the mapper; covered by the client and end-to-end tests.
CLIENT_LEVEL_FIXTURES = {"html_error_page"}


def test_every_fixture_has_an_expectation():
    covered = set(SUCCESS_CASES) | set(ERROR_CASES) | CLIENT_LEVEL_FIXTURES
    assert fixture_names() == covered


@pytest.mark.parametrize("name", sorted(SUCCESS_CASES))
def test_maps_fixture(name):
    overrides, warning_prefixes = SUCCESS_CASES[name]
    body = map_portfolio(load_fixture(name), "P-9001").model_dump(by_alias=True)

    warnings = body.pop("warnings")
    expected = {**BASE, **overrides}
    expected.pop("warnings")
    assert body == expected
    assert len(warnings) == len(warning_prefixes), warnings
    for actual, prefix in zip(warnings, warning_prefixes):
        assert actual.startswith(prefix), (actual, prefix)


@pytest.mark.parametrize("name", sorted(ERROR_CASES))
def test_rejects_fixture(name):
    with pytest.raises(ERROR_CASES[name]) as info:
        map_portfolio(load_fixture(name), "P-9001")
    assert info.value.portfolio_id == "P-9001"


def test_selects_each_account_by_acct_ref_not_position():
    payload = load_fixture("ok_p9001")
    assert map_portfolio(payload, "P-9002").label == "Retirement Account"
    assert map_portfolio(payload, "P-EMPTY").label == "Empty Account"


def test_acct_ref_match_is_case_sensitive():
    with pytest.raises(CrmNotFound):
        map_portfolio(load_fixture("ok_p9001"), "p-9001")


def test_unknown_id_in_valid_payload_is_not_found():
    with pytest.raises(CrmNotFound):
        map_portfolio(load_fixture("ok_p9001"), "P-0000")


def test_unidentified_sibling_account_does_not_block_a_found_target():
    payload = load_fixture("ok_p9001")
    payload["client_record"]["accounts"].append({"acct_nickname": "Mystery"})
    assert map_portfolio(payload, "P-9001").portfolio_id == "P-9001"


@pytest.mark.parametrize(
    "payload",
    [None, [], "text", {"client_record": None}, {"client_record": []}],
    ids=["null", "list", "string", "null_record", "list_record"],
)
def test_rejects_non_object_shapes(payload):
    with pytest.raises(CrmBadResponse):
        map_portfolio(payload, "P-9001")


def test_rejects_accounts_that_is_not_a_list():
    payload = load_fixture("ok_p9001")
    payload["client_record"]["accounts"] = {"P-9001": {}}
    with pytest.raises(CrmBadResponse, match="not a list"):
        map_portfolio(payload, "P-9001")


def test_rejects_record_with_no_accounts_list_anywhere():
    payload = load_fixture("ok_p9001")
    del payload["client_record"]["accounts"]
    with pytest.raises(CrmBadResponse, match="no accounts list"):
        map_portfolio(payload, "P-9001")


def test_numeric_client_id_is_stringified():
    payload = load_fixture("ok_p9001")
    payload["client_record"]["client_id"] = 12345
    assert map_portfolio(payload, "P-9001").client_id == "12345"


def test_invalid_currency_code_defaults_with_warning():
    payload = load_fixture("ok_p9001")
    payload["client_record"]["accounts"][0]["curr_val"]["ccy"] = "dollars"
    result = map_portfolio(payload, "P-9001")
    assert result.currency == "CAD"
    assert result.warnings[0].startswith("currency from CRM was not a valid code ('dollars')")


def test_non_object_chg_1d_nulls_both_day_change_fields():
    payload = load_fixture("ok_p9001")
    payload["client_record"]["accounts"][0]["chg_1d"] = 30
    result = map_portfolio(payload, "P-9001")
    assert (result.day_change_amount, result.day_change_percent) == (None, None)
    assert result.warnings[0].startswith("chg_1d from CRM was not an object")


def test_naive_timestamp_assumed_utc_with_warning():
    payload = load_fixture("ok_p9001")
    payload["meta"]["retrieved_at"] = "2026-10-03T16:00:00"
    result = map_portfolio(payload, "P-9001")
    assert result.as_of == "2026-10-03T16:00:00Z"
    assert result.warnings == ["asOf from CRM had no timezone; assumed UTC"]


def test_sub_second_timestamp_keeps_milliseconds():
    payload = load_fixture("ok_p9001")
    payload["meta"]["retrieved_at"] = "2026-10-03T16:00:00.250Z"
    assert map_portfolio(payload, "P-9001").as_of == "2026-10-03T16:00:00.250Z"


def test_mapper_does_not_mutate_its_input():
    payload = load_fixture("missing_amount_and_nickname")
    snapshot = load_fixture("missing_amount_and_nickname")
    map_portfolio(payload, "P-9001")
    assert payload == snapshot


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (0, 0.0),
        (0.0, 0.0),
        (-12.5, -12.5),
        ("42", 42.0),
        (" 0.187 ", 0.187),
        ("-30", -30.0),
        ("1,248,930.50", 1248930.5),
        ("1e3", 1000.0),
        (".5", 0.5),
        (True, None),
        (False, None),
        ("N/A", None),
        ("", None),
        ("NaN", None),
        ("inf", None),
        (float("nan"), None),
        (float("inf"), None),
        ("1,2,3", None),
        ("12,34", None),
        ([1], None),
        ({"amt": 1}, None),
        (None, None),
    ],
)
def test_parse_number(raw, expected):
    assert parse_number(raw) == expected

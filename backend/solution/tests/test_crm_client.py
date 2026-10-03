import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import httpx
import pytest
import respx

from app.crm.client import CrmClient
from app.crm.errors import CrmBadResponse, CrmNotFound, CrmTimeout, CrmUnavailable
from app.request_context import request_id_var
from tests.conftest import FIXTURE_DIR, load_fixture, make_settings

BASE_URL = "http://crm.test"
PATH = "/crm/portfolios/P-9001"


class RecordingSleep:
    def __init__(self):
        self.calls: list[float] = []

    async def __call__(self, seconds: float) -> None:
        self.calls.append(seconds)


@pytest.fixture
def sleep():
    return RecordingSleep()


@pytest.fixture
async def make_client(sleep):
    clients: list[httpx.AsyncClient] = []

    def factory(base_url: str = BASE_URL, **overrides) -> CrmClient:
        settings = make_settings(crm_base_url=base_url, **overrides)
        http = httpx.AsyncClient(base_url=base_url, timeout=settings.crm_timeout_seconds)
        clients.append(http)
        return CrmClient(http, settings, sleep=sleep)

    yield factory
    for http in clients:
        await http.aclose()


@pytest.fixture
def crm():
    with respx.mock(base_url=BASE_URL, assert_all_called=False) as router:
        yield router


async def test_returns_payload_on_success(make_client, crm):
    crm.get(PATH).respond(200, json=load_fixture("ok_p9001"))
    payload = await make_client().fetch_portfolio("P-9001")
    assert payload["client_record"]["client_id"] == "abc123"


async def test_404_is_not_found_and_not_retried(make_client, crm):
    route = crm.get(PATH).respond(404, json={"error": "unknown_account"})
    with pytest.raises(CrmNotFound):
        await make_client().fetch_portfolio("P-9001")
    assert route.call_count == 1


async def test_503_is_retried_exactly_once_then_unavailable(make_client, crm, sleep):
    route = crm.get(PATH).respond(503, json={"error": "legacy_unavailable"})
    with pytest.raises(CrmUnavailable) as info:
        await make_client(crm_retry_backoff_seconds=0.2).fetch_portfolio("P-9001")
    assert route.call_count == 2
    assert sleep.calls == [0.2]
    assert info.value.upstream_status == 503


async def test_503_then_success_recovers(make_client, crm):
    route = crm.get(PATH)
    route.side_effect = [httpx.Response(503), httpx.Response(200, json=load_fixture("ok_p9001"))]
    payload = await make_client().fetch_portfolio("P-9001")
    assert payload["meta"]["source"] == "legacy-crm-v2"
    assert route.call_count == 2


async def test_connection_refused_is_retried_then_succeeds(make_client, crm):
    route = crm.get(PATH)
    route.side_effect = [httpx.ConnectError("refused"), httpx.Response(200, json=load_fixture("ok_p9001"))]
    await make_client().fetch_portfolio("P-9001")
    assert route.call_count == 2


async def test_timeout_is_never_retried(make_client, crm, sleep):
    route = crm.get(PATH).mock(side_effect=httpx.ReadTimeout("slow"))
    with pytest.raises(CrmTimeout) as info:
        await make_client().fetch_portfolio("P-9001")
    assert route.call_count == 1
    assert sleep.calls == []
    assert info.value.timeout_seconds == 3.0


async def test_upstream_504_is_a_timeout(make_client, crm):
    route = crm.get(PATH).respond(504, json={"error": "legacy_timeout"})
    with pytest.raises(CrmTimeout):
        await make_client().fetch_portfolio("P-9001")
    assert route.call_count == 1


@pytest.mark.parametrize("status", [500, 502, 429])
async def test_other_server_errors_are_unavailable_without_retry(make_client, crm, status):
    route = crm.get(PATH).respond(status)
    with pytest.raises(CrmUnavailable) as info:
        await make_client().fetch_portfolio("P-9001")
    assert route.call_count == 1
    assert info.value.upstream_status == status


@pytest.mark.parametrize("status", [400, 401, 403, 302])
async def test_unexpected_client_statuses_are_bad_responses(make_client, crm, status):
    crm.get(PATH).respond(status)
    with pytest.raises(CrmBadResponse, match=f"HTTP {status}"):
        await make_client().fetch_portfolio("P-9001")


async def test_retries_disabled_by_config(make_client, crm):
    route = crm.get(PATH).respond(503)
    with pytest.raises(CrmUnavailable):
        await make_client(crm_max_retries=0).fetch_portfolio("P-9001")
    assert route.call_count == 1


async def test_retry_skipped_when_time_budget_too_small(make_client, crm):
    route = crm.get(PATH).respond(503)
    with pytest.raises(CrmUnavailable):
        await make_client(crm_total_budget_seconds=0.4, crm_retry_backoff_seconds=0.2).fetch_portfolio("P-9001")
    assert route.call_count == 1


async def test_html_body_with_200_is_bad_response(make_client, crm):
    html = (FIXTURE_DIR / "html_error_page.txt").read_text()
    crm.get(PATH).respond(200, text=html, headers={"content-type": "text/html"})
    with pytest.raises(CrmBadResponse, match="not valid JSON"):
        await make_client().fetch_portfolio("P-9001")


@pytest.mark.parametrize("body", ["[1, 2]", '"text"', "null"])
async def test_json_that_is_not_an_object_is_bad_response(make_client, crm, body):
    crm.get(PATH).respond(200, text=body, headers={"content-type": "application/json"})
    with pytest.raises(CrmBadResponse, match="not a JSON object"):
        await make_client().fetch_portfolio("P-9001")


async def test_portfolio_id_is_url_encoded(make_client, crm):
    route = crm.route(method="GET").respond(404)
    with pytest.raises(CrmNotFound):
        await make_client().fetch_portfolio("P 9001/../x?y=1")
    assert route.calls.last.request.url.raw_path == b"/crm/portfolios/P%209001%2F..%2Fx%3Fy%3D1"


async def test_forwards_request_id_header(make_client, crm):
    route = crm.get(PATH).respond(200, json=load_fixture("ok_p9001"))
    token = request_id_var.set("req-123")
    try:
        await make_client().fetch_portfolio("P-9001")
    finally:
        request_id_var.reset(token)
    assert route.calls.last.request.headers["X-Request-ID"] == "req-123"


async def test_ping(make_client, crm):
    crm.get("/health").respond(200, json={"status": "ok"})
    assert await make_client().ping() is True


async def test_ping_false_when_unreachable(make_client, crm):
    crm.get("/health").mock(side_effect=httpx.ConnectError("refused"))
    assert await make_client().ping() is False


# --- Real sockets: prove the timeout is actually enforced, not just simulated. ---


class _SlowHandler(BaseHTTPRequestHandler):
    delay_seconds = 2.0

    def do_GET(self):
        time.sleep(self.delay_seconds)
        try:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b"{}")
        except (BrokenPipeError, ConnectionResetError):
            pass

    def log_message(self, *args):
        pass


@pytest.fixture
def slow_server():
    server = ThreadingHTTPServer(("127.0.0.1", 0), _SlowHandler)
    server.daemon_threads = True
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_address[1]}"
    server.shutdown()
    server.server_close()


async def test_real_slow_server_is_cut_off_at_the_timeout(make_client, slow_server):
    client = make_client(base_url=slow_server, crm_timeout_seconds=0.3)
    started = time.monotonic()
    with pytest.raises(CrmTimeout):
        await client.fetch_portfolio("P-9001")
    elapsed = time.monotonic() - started
    assert elapsed < 1.0, f"took {elapsed:.2f}s; the 0.3s timeout was not enforced"


def _unused_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


async def test_real_connection_refused_is_unavailable_after_retry(make_client, sleep):
    client = make_client(base_url=f"http://127.0.0.1:{_unused_port()}")
    with pytest.raises(CrmUnavailable, match="Could not connect"):
        await client.fetch_portfolio("P-9001")
    assert len(sleep.calls) == 1

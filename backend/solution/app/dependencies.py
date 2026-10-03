from fastapi import Depends, Request

from app.crm.client import CrmClient
from app.services.allocation_service import AllocationService
from app.services.history_service import HistoryService, load_history_file, load_portfolio_ids
from app.services.holdings_service import HoldingsService
from app.services.portfolio_service import PortfolioService


def get_crm_client(request: Request) -> CrmClient:
    return request.app.state.crm_client


def get_portfolio_service(crm: CrmClient = Depends(get_crm_client)) -> PortfolioService:
    return PortfolioService(crm)


def get_holdings_service() -> HoldingsService:
    return HoldingsService()


def get_allocation_service() -> AllocationService:
    return AllocationService()


def get_history_service(request: Request) -> HistoryService:
    settings = request.app.state.settings
    return HistoryService(load_history_file(settings.history_file), load_portfolio_ids(settings.seed_file))

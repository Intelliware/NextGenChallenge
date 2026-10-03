from fastapi import Depends, Request

from app.crm.client import CrmClient
from app.services.portfolio_service import PortfolioService


def get_crm_client(request: Request) -> CrmClient:
    return request.app.state.crm_client


def get_portfolio_service(crm: CrmClient = Depends(get_crm_client)) -> PortfolioService:
    return PortfolioService(crm)

from app.crm.client import CrmClient
from app.crm.mapper import map_portfolio
from app.models import PortfolioMetadata


class PortfolioService:
    def __init__(self, crm: CrmClient):
        self._crm = crm

    async def get_metadata(self, portfolio_id: str) -> PortfolioMetadata:
        payload = await self._crm.fetch_portfolio(portfolio_id)
        return map_portfolio(payload, portfolio_id)

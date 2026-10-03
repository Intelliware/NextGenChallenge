from app.calculations.holdings import compute_holdings
from app.data import seed
from app.errors import PortfolioNotFound
from app.models import Holding


class HoldingsService:
    def get_holdings(self, portfolio_id: str) -> list[Holding]:
        if seed.get_portfolio(portfolio_id) is None:
            raise PortfolioNotFound(f"No portfolio found with id '{portfolio_id}'.")
        return [Holding(**row) for row in compute_holdings(seed.holdings_for(portfolio_id))]

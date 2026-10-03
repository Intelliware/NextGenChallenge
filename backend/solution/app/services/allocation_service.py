from app.calculations.allocation import compute_allocation
from app.data import seed
from app.errors import PortfolioNotFound
from app.models import AllocationEntry


class AllocationService:
    def get_allocation(self, portfolio_id: str) -> list[AllocationEntry]:
        if seed.get_portfolio(portfolio_id) is None:
            raise PortfolioNotFound(f"No portfolio found with id '{portfolio_id}'.")
        return [AllocationEntry(**row) for row in compute_allocation(seed.holdings_for(portfolio_id))]

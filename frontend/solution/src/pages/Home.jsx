import HoldingsTable from '../components/HoldingsTable'
import SummaryCard from '../components/SummaryCard'
import PortfolioProvider from '../portfolio/PortfolioProvider'

// No account selector yet: default to the first mock account
const DEFAULT_ACCOUNT_ID = 'P-9001'

export default function Home() {
  return (
    <PortfolioProvider accountId={DEFAULT_ACCOUNT_ID}>
      <h1>Portfolio Overview</h1>
      <SummaryCard />
      <HoldingsTable />
    </PortfolioProvider>
  )
}

import { useContext } from 'react'
import { Navigate } from 'react-router-dom'
import HoldingsTable from '../components/HoldingsTable'
import OverviewPanel from '../components/OverviewPanel'
import { PortfolioContext } from '../portfolio/PortfolioContext'

export default function Home() {
  const { accountId } = useContext(PortfolioContext)

  // The dashboard needs an account: send the user to pick one first
  if (!accountId) return <Navigate to="/accounts" replace />

  return (
    <>
      <h1>Portfolio Overview</h1>
      <OverviewPanel />
      <HoldingsTable />
    </>
  )
}

import { useContext } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { PortfolioContext } from '../portfolio/PortfolioContext'

// Top bar with the app name and navigation; the Home link appears once an account is selected.
// Links keep the URL's query string so a mock ?scenario= stays applied across pages.
export default function Navbar() {
  const { accountId } = useContext(PortfolioContext)
  const { search } = useLocation()

  return (
    <header className="navbar">
      <span className="navbar-brand">Portfolio Dashboard</span>
      <nav>
        {/* Dashboard is unreachable until an account is selected */}
        {accountId && (
          <NavLink to={{ pathname: '/', search }} end>
            Home
          </NavLink>
        )}
        <NavLink to={{ pathname: '/accounts', search }}>Accounts</NavLink>
      </nav>
    </header>
  )
}

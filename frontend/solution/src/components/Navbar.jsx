import { useContext } from 'react'
import { NavLink } from 'react-router-dom'
import { PortfolioContext } from '../portfolio/PortfolioContext'

export default function Navbar() {
  const { accountId } = useContext(PortfolioContext)

  return (
    <header className="navbar">
      <span className="navbar-brand">Portfolio Dashboard</span>
      <nav>
        {/* Dashboard is unreachable until an account is selected */}
        {accountId && (
          <NavLink to="/" end>
            Home
          </NavLink>
        )}
        <NavLink to="/accounts">Accounts</NavLink>
      </nav>
    </header>
  )
}

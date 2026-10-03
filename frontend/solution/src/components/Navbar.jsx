import { NavLink, useLocation } from 'react-router-dom'

// Top bar with the app name and a Home link. The link keeps the URL's query string so a
// mock ?scenario= (or delayMs/fail) stays applied across pages.
export default function Navbar() {
  const { search } = useLocation()

  return (
    <header className="navbar">
      <span className="navbar-brand">Portfolio Dashboard</span>
      <nav>
        <NavLink to={{ pathname: '/', search }} end>
          Home
        </NavLink>
      </nav>
    </header>
  )
}

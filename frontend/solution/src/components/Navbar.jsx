import { NavLink } from 'react-router-dom'

export default function Navbar() {
  return (
    <header className="navbar">
      <span className="navbar-brand">Portfolio Dashboard</span>
      <nav>
        <NavLink to="/" end>
          Home
        </NavLink>
        <NavLink to="/accounts">Accounts</NavLink>
      </nav>
    </header>
  )
}

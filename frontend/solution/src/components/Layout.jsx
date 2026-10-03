import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import CurrencyToggle from '../currency/CurrencyToggle'

// Page shell shared by every route: navbar, the routed page (<Outlet />), footer and the
// floating currency toggle
export default function Layout() {
  return (
    <div className="layout">
      <Navbar />
      <main className="main">
        <Outlet />
      </main>
      <Footer />
      <CurrencyToggle />
    </div>
  )
}

import { Navigate, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import AccountDetail from './pages/AccountDetail'
import HoldingDetail from './pages/HoldingDetail'
import PortfolioProvider from './portfolio/PortfolioProvider'

export default function App() {
  return (
    <PortfolioProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          {/* Account list now lives on the dashboard */}
          <Route path="accounts" element={<Navigate to="/" replace />} />
          <Route path="accounts/:accountId" element={<AccountDetail />} />
          <Route path="accounts/:accountId/holdings/:ticker" element={<HoldingDetail />} />
        </Route>
      </Routes>
    </PortfolioProvider>
  )
}

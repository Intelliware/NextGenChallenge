import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Accounts from './pages/Accounts'
import PortfolioProvider from './portfolio/PortfolioProvider'

export default function App() {
  return (
    <PortfolioProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="accounts" element={<Accounts />} />
        </Route>
      </Routes>
    </PortfolioProvider>
  )
}

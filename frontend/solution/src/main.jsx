import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import CurrencyProvider from './currency/CurrencyProvider'

// Entry point: mounts the app with routing and the currency provider at the root, so the
// CAD/USD choice and exchange rate are shared by every page
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <CurrencyProvider>
        <App />
      </CurrencyProvider>
    </BrowserRouter>
  </StrictMode>,
)

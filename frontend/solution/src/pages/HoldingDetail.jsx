import { useContext, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import HistoryChart from '../components/HistoryChart'
import useCurrency from '../currency/useCurrency'
import { fetchHoldingDetail } from '../portfolio/api'
import { NOT_FOUND, formatNumber, formatPercent, isNumber, toPercent, trend } from '../portfolio/format'
import { fromPriceHistory } from '../portfolio/history'
import { PortfolioContext } from '../portfolio/PortfolioContext'

// Optional fields (no purchase date, sector, ...) render as "Not found" instead of "undefined"
const orMissing = (value, format) => (value === null || value === undefined ? NOT_FOUND : format(value))

// 'YYYY-MM-DD' => "Mar 14, 2022" (same en-CA locale as money)
function formatDate(date) {
  // Date-only strings are UTC; format them in UTC so the day doesn't shift
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

// One labelled figure; `tone` (positive/negative/neutral) colours it like the summary card
function Stat({ label, value, tone }) {
  return (
    <div className={tone ? `summary-card__stat summary-card__stat--${tone}` : 'summary-card__stat'}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

// Where the current price sits between the 52-week low and high
function RangeBar({ low, high, price, formatMoney }) {
  if (!isNumber(low) || !isNumber(high) || high <= low) return null
  const position = isNumber(price) ? Math.min(100, Math.max(0, ((price - low) / (high - low)) * 100)) : null

  return (
    <div className="range-bar">
      <div className="range-bar__labels">
        <span>52-week low {formatMoney(low)}</span>
        <span>52-week high {formatMoney(high)}</span>
      </div>
      <div className="range-bar__track">
        {position !== null && (
          <span
            className="range-bar__marker"
            style={{ left: `${position}%` }}
            role="img"
            aria-label={`Current price ${formatMoney(price)}`}
          />
        )}
      </div>
    </div>
  )
}

// One position: account-specific figures from the portfolio, security details from /holdings/:ticker/detail
export default function HoldingDetail() {
  const { accountId, ticker } = useParams()
  const { search } = useLocation()
  const { accountId: selectedId, selectAccount, status: portfolioStatus, data } = useContext(PortfolioContext)
  const { formatMoney, formatSignedMoney } = useCurrency()
  const [detail, setDetail] = useState({ status: 'loading', ticker, data: null, error: null })

  // Deep links land here directly, so make sure the account's portfolio is loaded too
  useEffect(() => {
    selectAccount(accountId)
  }, [accountId, selectAccount])

  useEffect(() => {
    const controller = new AbortController()
    fetchHoldingDetail(ticker, { signal: controller.signal })
      .then((result) => setDetail({ status: 'success', ticker, data: result, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') setDetail({ status: 'error', ticker, data: null, error })
      })
    return () => controller.abort()
  }, [ticker])

  const isPortfolioCurrent = selectedId === accountId && portfolioStatus === 'success'
  const holding = isPortfolioCurrent ? data.holdings?.find((h) => h.ticker === ticker) : null
  const histories = useMemo(() => [fromPriceHistory(detail.data?.priceHistory ?? [])], [detail.data])

  const backLink = (
    <Link to={`/accounts/${encodeURIComponent(accountId)}${search}`} className="back-link">
      ← Back to {isPortfolioCurrent ? (data.portfolio?.label ?? accountId) : 'account'}
    </Link>
  )

  if (detail.status === 'loading' || detail.ticker !== ticker) {
    return (
      <>
        {backLink}
        <p>Loading {ticker}…</p>
      </>
    )
  }

  if (detail.status === 'error') {
    return (
      <>
        {backLink}
        <p role="alert">{detail.error.message}</p>
      </>
    )
  }

  const security = detail.data
  const price = holding?.price ?? security.price
  const costBasis = holding?.costBasisPerShare ?? security.costBasisPerShare
  const quantity = holding?.quantity
  const totalCost = isNumber(costBasis) && isNumber(quantity) ? costBasis * quantity : null
  const gainLoss =
    holding?.gainLoss ??
    (isNumber(price) && isNumber(totalCost) ? price * quantity - totalCost : null)
  const returnPercent = isNumber(gainLoss) && isNumber(totalCost) && totalCost !== 0 ? (gainLoss / totalCost) * 100 : null

  return (
    <>
      {backLink}
      <header className="holding-detail__header">
        <h1>
          {security.ticker}
          <span className="holding-detail__name">{security.name}</span>
        </h1>
        <p className="holding-detail__price">{formatMoney(price)}</p>
      </header>

      <div className="holding-detail__cards">
        <section className="summary-card" aria-label="Your position">
          <h2 className="summary-card__title">Your position</h2>
          {isPortfolioCurrent && !holding ? (
            <p>This account doesn't hold {ticker}.</p>
          ) : (
            <dl className="summary-card__stats">
              <Stat label="Shares" value={orMissing(quantity, formatNumber)} />
              <Stat label="Cost basis / share" value={formatMoney(costBasis)} />
              <Stat label="Total cost" value={formatMoney(totalCost)} />
              <Stat
                label="Unrealized gain/loss"
                value={
                  isNumber(returnPercent)
                    ? `${formatSignedMoney(gainLoss)} (${formatPercent(returnPercent)})`
                    : formatSignedMoney(gainLoss)
                }
                tone={trend(gainLoss)}
              />
              <Stat label="Purchased" value={orMissing(security.purchaseDate, formatDate)} />
            </dl>
          )}
        </section>

        <section className="summary-card" aria-label="Security details">
          <h2 className="summary-card__title">Security details</h2>
          <dl className="summary-card__stats">
            <Stat label="Sector" value={security.sector ?? NOT_FOUND} />
            <Stat label="Asset class" value={security.assetClass ?? NOT_FOUND} />
            <Stat
              label="Dividend yield"
              value={isNumber(security.dividendYield) ? formatPercent(toPercent(security.dividendYield)) : 'None'}
            />
            <Stat label="52-week low" value={formatMoney(security.fiftyTwoWeekLow)} />
            <Stat label="52-week high" value={formatMoney(security.fiftyTwoWeekHigh)} />
          </dl>
          <RangeBar
            low={security.fiftyTwoWeekLow}
            high={security.fiftyTwoWeekHigh}
            price={price}
            formatMoney={formatMoney}
          />
        </section>
      </div>

      <HistoryChart histories={histories} title="Price history" />
    </>
  )
}

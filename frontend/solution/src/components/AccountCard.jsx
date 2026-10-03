import { useState } from 'react'
import { formatMoney } from '../currency/format'

export default function AccountCard({ account }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <section className="account-card">
      <button
        type="button"
        className="account-card-header"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>{account.label}</span>
        <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && (
        <dl className="account-card-body">
          <div className="account-card-row">
            <dt>Account ID</dt>
            <dd>{account.accountId}</dd>
          </div>
          <div className="account-card-row">
            <dt>Total market value</dt>
            <dd>{formatMoney(account.totalMarketValue)}</dd>
          </div>
        </dl>
      )}
    </section>
  )
}

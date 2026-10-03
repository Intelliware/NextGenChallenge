import { useState } from 'react'
import Money from '../currency/Money'

export default function AccountCard({ account, isSelected, onSelect }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <section className={isSelected ? 'account-card account-card--selected' : 'account-card'}>
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
            <dd>
              <Money amount={account.totalMarketValue} />
            </dd>
          </div>
        </dl>
      )}
      <div className="account-card-footer">
        <button type="button" onClick={onSelect} disabled={isSelected} aria-pressed={isSelected}>
          {isSelected ? 'Selected' : 'Select account'}
        </button>
      </div>
    </section>
  )
}

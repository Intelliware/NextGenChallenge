import { useState } from 'react'

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
          {Object.entries(account).map(([key, value]) => (
            <div key={key} className="account-card-row">
              <dt>{key}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}

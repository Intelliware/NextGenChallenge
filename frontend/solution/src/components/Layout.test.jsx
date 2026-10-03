import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import { makePortfolio, renderWithContext } from '../test/utils'
import Footer from './Footer'
import Layout from './Layout'
import Navbar from './Navbar'

describe('Navbar', () => {
  test('hides Home until an account is selected', () => {
    renderWithContext(<Navbar />, { portfolio: makePortfolio({ accountId: null }) })
    expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Accounts' })).toHaveAttribute('href', '/accounts')
  })

  test('shows Home once an account is selected', () => {
    renderWithContext(<Navbar />)
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
  })

  test('keeps the mock query string on its links', () => {
    renderWithContext(<Navbar />, { route: '/accounts?scenario=empty' })
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/?scenario=empty')
    expect(screen.getByRole('link', { name: 'Accounts' })).toHaveAttribute('href', '/accounts?scenario=empty')
  })
})

describe('Footer', () => {
  test('shows the current year', () => {
    renderWithContext(<Footer />)
    expect(screen.getByRole('contentinfo')).toHaveTextContent(`© ${new Date().getFullYear()} Portfolio Dashboard`)
  })
})

describe('Layout', () => {
  test('wraps the page with the navbar, footer and currency toggle', () => {
    renderWithContext(
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<p>Page body</p>} />
        </Route>
      </Routes>,
    )
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('Page body')
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /Display currency/ })).toBeInTheDocument()
  })
})

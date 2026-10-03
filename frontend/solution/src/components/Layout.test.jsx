import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import { renderWithContext } from '../test/utils'
import Footer from './Footer'
import Layout from './Layout'
import Navbar from './Navbar'

describe('Navbar', () => {
  test('always links Home to the dashboard', () => {
    renderWithContext(<Navbar />)
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
  })

  test('keeps the mock query string on its link', () => {
    renderWithContext(<Navbar />, { route: '/accounts/P-9001?scenario=empty' })
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/?scenario=empty')
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

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App.tsx'

// Placeholder smoke test: proves the Vitest + jsdom + Testing Library setup.
// The integration tests replace it once App is wired to the calculator.
describe('App', () => {
  it('renders the calculator heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Calculator' })).toBeInTheDocument()
  })
})

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, calculate, NETWORK_ERROR, NETWORK_ERROR_MESSAGE } from './api/client.ts'
import App from './App.tsx'

// Only calculate is replaced; ApiError and the constants stay real.
vi.mock('./api/client.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api/client.ts')>()),
  calculate: vi.fn(),
}))

const calculateMock = vi.mocked(calculate)

beforeEach(() => {
  calculateMock.mockReset()
})

/** Renders App the way main.tsx does, inside StrictMode. */
function renderApp() {
  const user = userEvent.setup()
  const view = render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  return { user, ...view }
}

function expectKeypadEnabled() {
  expect(screen.getByRole('button', { name: 'clear' })).toHaveAttribute('aria-disabled', 'false')
}

/**
 * Clicks the keys by accessible name. Like a real user, it waits for the
 * keypad to be enabled again before each key, since a request disables it.
 */
async function press(user: ReturnType<typeof userEvent.setup>, ...names: string[]) {
  for (const name of names) {
    await waitFor(expectKeypadEnabled)
    await user.click(screen.getByRole('button', { name }))
  }
  await waitFor(expectKeypadEnabled)
}

function mainLine(): HTMLElement {
  return document.querySelector<HTMLElement>('.display__main')!
}

function secondaryLine(): HTMLElement {
  return document.querySelector<HTMLElement>('.display__secondary')!
}

/** The operation and operands of every calculate call, without the signal. */
function calls() {
  return calculateMock.mock.calls.map(([operation, operands]) => [operation, operands])
}

/** A promise the test resolves later, to hold a request in flight. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('App', () => {
  it('starts with 0 and the full keypad', () => {
    renderApp()

    expect(screen.getByRole('heading', { name: 'Calculator' })).toBeInTheDocument()
    expect(mainLine()).toHaveTextContent('0')
    expect(screen.getAllByRole('button')).toHaveLength(22)
  })

  it('sends 2 + 3 = as one request and shows the result', async () => {
    calculateMock.mockResolvedValueOnce(5)
    const { user } = renderApp()

    await press(user, '2', 'add', '3', 'equals')

    expect(calls()).toEqual([['add', [2, 3]]])
    expect(mainLine()).toHaveTextContent('5')
    expect(secondaryLine()).toBeEmptyDOMElement()
  })

  it('chains 2 + 3 × 4 = into two requests and shows 20', async () => {
    calculateMock.mockResolvedValueOnce(5).mockResolvedValueOnce(20)
    const { user } = renderApp()

    await press(user, '2', 'add', '3', 'multiply', '4', 'equals')

    expect(calls()).toEqual([
      ['add', [2, 3]],
      ['multiply', [5, 4]],
    ])
    expect(mainLine()).toHaveTextContent('20')
  })

  it('keeps the pending operation across √: 9 + √16 = shows 13', async () => {
    calculateMock.mockResolvedValueOnce(4).mockResolvedValueOnce(13)
    const { user } = renderApp()

    await press(user, '9', 'add', '1', '6', 'square root')
    expect(mainLine()).toHaveTextContent('4')
    expect(secondaryLine()).toHaveTextContent('9 +')

    await press(user, 'equals')
    expect(calls()).toEqual([
      ['sqrt', [16]],
      ['add', [9, 4]],
    ])
    expect(mainLine()).toHaveTextContent('13')
  })

  it('shows the pending operation on the secondary line', async () => {
    const { user } = renderApp()

    await press(user, '2', '0', 'add')

    expect(secondaryLine()).toHaveTextContent('20 +')
    expect(mainLine()).toHaveTextContent('20')
    expect(calculateMock).not.toHaveBeenCalled()
  })

  it('rounds the result for display only', async () => {
    calculateMock.mockResolvedValueOnce(0.30000000000000004).mockResolvedValueOnce(1.3)
    const { user } = renderApp()

    await press(user, '0', 'decimal point', '1', 'add', '0', 'decimal point', '2', 'equals')
    expect(mainLine()).toHaveTextContent(/^0\.3$/)

    await press(user, 'add', '1', 'equals')
    expect(calls()[1]).toEqual(['add', [0.30000000000000004, 1]])
  })

  it('shows the backend error message and clears it on the next digit', async () => {
    calculateMock.mockRejectedValueOnce(new ApiError('DIVISION_BY_ZERO', 'cannot divide by zero', 422))
    const { user } = renderApp()

    await press(user, '1', 'divide', '0', 'equals')
    expect(mainLine()).toHaveTextContent('cannot divide by zero')
    expect(mainLine()).toHaveClass('display__main--error')

    await press(user, '7')
    expect(mainLine()).toHaveTextContent('7')
    expect(mainLine()).not.toHaveClass('display__main--error')
  })

  it('shows the network error message', async () => {
    calculateMock.mockRejectedValueOnce(new ApiError(NETWORK_ERROR, NETWORK_ERROR_MESSAGE, 0))
    const { user } = renderApp()

    await press(user, '2', 'add', '3', 'equals')

    expect(mainLine()).toHaveTextContent("Can't reach the calculator service")
    expect(mainLine()).toHaveClass('display__main--error')
  })

  it('shows the network error message for an unexpected error', async () => {
    calculateMock.mockRejectedValueOnce(new Error('something else'))
    const { user } = renderApp()

    await press(user, '2', 'add', '3', 'equals')

    expect(mainLine()).toHaveTextContent(NETWORK_ERROR_MESSAGE)
  })

  it('disables the keypad while a request is in flight', async () => {
    const answer = deferred<number>()
    calculateMock.mockReturnValueOnce(answer.promise)
    const { user } = renderApp()

    await press(user, '2', 'add', '3')
    await user.click(screen.getByRole('button', { name: 'equals' }))

    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveAttribute('aria-disabled', 'true')
    }
    await user.click(screen.getByRole('button', { name: '5' }))
    await user.click(screen.getByRole('button', { name: 'clear' }))
    expect(calculateMock).toHaveBeenCalledTimes(1)
    expect(mainLine()).toHaveTextContent('3')
    expect(secondaryLine()).toHaveTextContent('2 +')

    answer.resolve(5)

    await waitFor(() => expect(mainLine()).toHaveTextContent('5'))
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveAttribute('aria-disabled', 'false')
    }
  })

  it('keeps focus on = through a request made with the keyboard', async () => {
    const answer = deferred<number>()
    calculateMock.mockReturnValueOnce(answer.promise)
    const { user } = renderApp()
    await press(user, '2', 'add', '3')

    const equals = screen.getByRole('button', { name: 'equals' })
    equals.focus()
    await user.keyboard('{Enter}')

    expect(calculateMock).toHaveBeenCalledTimes(1)
    expect(equals).toHaveAttribute('aria-disabled', 'true')
    // jsdom keeps focus on a natively disabled button, but browsers drop it,
    // so the key must not get the disabled attribute.
    expect(equals).toBeEnabled()
    expect(equals).toHaveFocus()

    answer.resolve(5)

    await waitFor(() => expect(mainLine()).toHaveTextContent('5'))
    expect(equals).toHaveAttribute('aria-disabled', 'false')
    expect(equals).toHaveFocus()
  })

  it('aborts the request in flight on unmount', async () => {
    calculateMock.mockReturnValueOnce(new Promise(() => {}))
    const { user, unmount } = renderApp()

    await press(user, '2', 'add', '3')
    await user.click(screen.getByRole('button', { name: 'equals' }))
    const signal = calculateMock.mock.calls[0][2]
    expect(signal?.aborted).toBe(false)

    unmount()

    expect(signal?.aborted).toBe(true)
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Action } from '../calculator/reducer.ts'
import { Button } from './Button.tsx'
import { Display } from './Display.tsx'
import { Keypad } from './Keypad.tsx'

describe('Display', () => {
  it('renders both lines inside a polite live region', () => {
    render(<Display main="5" secondary="20 +" isError={false} />)

    const main = screen.getByText('5')
    expect(screen.getByText('20 +')).toBeInTheDocument()
    expect(main.closest('.display')).toHaveAttribute('aria-live', 'polite')
    expect(main).not.toHaveClass('display__main--error')
  })

  it('styles an error message', () => {
    render(<Display main="cannot divide by zero" secondary="" isError />)

    expect(screen.getByText('cannot divide by zero')).toHaveClass('display__main--error')
  })

  it.each([
    ['1234567890', []],
    ['12345678901', ['display__main--small']],
    ['-123456789012.34', ['display__main--small']],
    ['-1234567890.12345', ['display__main--tiny']],
  ])('sizes %j with %j', (main, sizeClasses) => {
    render(<Display main={main} secondary="" isError={false} />)

    const classes = [...screen.getByText(main).classList].filter((name) => name !== 'display__main')
    expect(classes).toEqual(sizeClasses)
  })
})

describe('Button', () => {
  it('calls onPress when clicked', async () => {
    const onPress = vi.fn()
    render(<Button label="7" variant="digit" disabled={false} onPress={onPress} />)

    await userEvent.click(screen.getByRole('button', { name: '7' }))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('is named by its aria-label and shows its label', () => {
    render(<Button label="×" ariaLabel="multiply" variant="operator" disabled={false} onPress={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'multiply' })).toHaveTextContent('×')
  })

  it('has the classes for its variant and width', () => {
    render(<Button label="√" ariaLabel="square root" variant="operator" wide disabled={false} onPress={vi.fn()} />)

    expect(screen.getByRole('button')).toHaveClass('button', 'button--operator', 'button--wide')
  })

  it('is not marked disabled when enabled', () => {
    render(<Button label="7" variant="digit" disabled={false} onPress={vi.fn()} />)

    expect(screen.getByRole('button', { name: '7' })).toHaveAttribute('aria-disabled', 'false')
  })

  it('is marked with aria-disabled and ignores clicks when disabled', async () => {
    const onPress = vi.fn()
    render(<Button label="7" variant="digit" disabled onPress={onPress} />)

    const button = screen.getByRole('button', { name: '7' })
    await userEvent.click(button)

    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).not.toHaveAttribute('disabled')
    expect(onPress).not.toHaveBeenCalled()
  })

  it('keeps focus and ignores Enter and Space when disabled', async () => {
    const user = userEvent.setup()
    const onPress = vi.fn()
    render(<Button label="7" variant="digit" disabled onPress={onPress} />)

    await user.tab()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')

    expect(screen.getByRole('button', { name: '7' })).toHaveFocus()
    expect(onPress).not.toHaveBeenCalled()
  })
})

describe('Keypad', () => {
  const keys: [string, Action][] = [
    ['clear', { type: 'clear' }],
    ['backspace', { type: 'backspace' }],
    ['percent', { type: 'operator', operator: 'percentage' }],
    ['divide', { type: 'operator', operator: 'divide' }],
    ['multiply', { type: 'operator', operator: 'multiply' }],
    ['subtract', { type: 'operator', operator: 'subtract' }],
    ['add', { type: 'operator', operator: 'add' }],
    ['power', { type: 'operator', operator: 'power' }],
    ['toggle sign', { type: 'toggleSign' }],
    ['decimal point', { type: 'decimal' }],
    ['equals', { type: 'equals' }],
    ['square root', { type: 'sqrt' }],
    ...(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const).map(
      (digit): [string, Action] => [digit, { type: 'digit', digit }],
    ),
  ]

  it('renders 22 buttons', () => {
    render(<Keypad onPress={vi.fn()} disabled={false} />)

    expect(screen.getAllByRole('button')).toHaveLength(22)
  })

  it.each(keys)('sends the right action for %s', async (name, action) => {
    const onPress = vi.fn()
    render(<Keypad onPress={onPress} disabled={false} />)

    await userEvent.click(screen.getByRole('button', { name }))

    expect(onPress).toHaveBeenCalledTimes(1)
    expect(onPress).toHaveBeenCalledWith(action)
  })

  it('makes square root and power two columns wide', () => {
    render(<Keypad onPress={vi.fn()} disabled={false} />)

    const wide = screen.getAllByRole('button').filter((button) => button.classList.contains('button--wide'))
    expect(wide.map((button) => button.getAttribute('aria-label'))).toEqual(['square root', 'power'])
  })

  it('marks every button aria-disabled and sends nothing while disabled', async () => {
    const onPress = vi.fn()
    render(<Keypad onPress={onPress} disabled />)

    const buttons = screen.getAllByRole('button')
    for (const button of buttons) {
      expect(button).toHaveAttribute('aria-disabled', 'true')
    }
    for (const button of buttons) {
      await userEvent.click(button)
    }
    expect(onPress).not.toHaveBeenCalled()
  })
})

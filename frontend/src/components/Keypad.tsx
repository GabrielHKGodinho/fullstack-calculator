import type { Action } from '../calculator/reducer.ts'
import type { BinaryOperator, Digit } from '../calculator/types.ts'
import { Button, type ButtonVariant } from './Button.tsx'

interface Key {
  label: string
  ariaLabel?: string
  variant: ButtonVariant
  wide?: boolean
  action: Action
}

function digit(label: Digit): Key {
  return { label, variant: 'digit', action: { type: 'digit', digit: label } }
}

function operator(label: string, ariaLabel: string, op: BinaryOperator, wide = false): Key {
  return { label, ariaLabel, variant: 'operator', wide, action: { type: 'operator', operator: op } }
}

// The keys in grid order, four per row (SPEC 5.3). √ and xʸ are two columns wide.
const KEYS: readonly Key[] = [
  { label: 'C', ariaLabel: 'clear', variant: 'function', action: { type: 'clear' } },
  { label: '⌫', ariaLabel: 'backspace', variant: 'function', action: { type: 'backspace' } },
  operator('%', 'percent', 'percentage'),
  operator('÷', 'divide', 'divide'),

  digit('7'),
  digit('8'),
  digit('9'),
  operator('×', 'multiply', 'multiply'),

  digit('4'),
  digit('5'),
  digit('6'),
  operator('−', 'subtract', 'subtract'),

  digit('1'),
  digit('2'),
  digit('3'),
  operator('+', 'add', 'add'),

  { label: '±', ariaLabel: 'toggle sign', variant: 'digit', action: { type: 'toggleSign' } },
  digit('0'),
  { label: '.', ariaLabel: 'decimal point', variant: 'digit', action: { type: 'decimal' } },
  { label: '=', ariaLabel: 'equals', variant: 'equals', action: { type: 'equals' } },

  { label: '√', ariaLabel: 'square root', variant: 'operator', wide: true, action: { type: 'sqrt' } },
  operator('xʸ', 'power', 'power', true),
]

interface KeypadProps {
  onPress: (action: Action) => void
  /** True while a request is in flight. */
  disabled: boolean
}

export function Keypad({ onPress, disabled }: KeypadProps) {
  return (
    <div className="keypad">
      {KEYS.map((key) => (
        <Button
          key={key.label}
          label={key.label}
          ariaLabel={key.ariaLabel}
          variant={key.variant}
          wide={key.wide}
          disabled={disabled}
          onPress={() => onPress(key.action)}
        />
      ))}
    </div>
  )
}

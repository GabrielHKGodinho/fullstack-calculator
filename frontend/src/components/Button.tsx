export type ButtonVariant = 'digit' | 'operator' | 'function' | 'equals'

interface ButtonProps {
  label: string
  /** Spoken name for symbol keys, such as "multiply" for ×. Digits are named by their label. */
  ariaLabel?: string
  variant: ButtonVariant
  /** Spans two keypad columns. */
  wide?: boolean
  disabled: boolean
  onPress: () => void
}

export function Button({ label, ariaLabel, variant, wide = false, disabled, onPress }: ButtonProps) {
  const className = `button button--${variant}${wide ? ' button--wide' : ''}`
  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onPress}
    >
      {label}
    </button>
  )
}

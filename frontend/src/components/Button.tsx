export type ButtonVariant = 'digit' | 'operator' | 'function' | 'equals'

interface ButtonProps {
  label: string
  /** Spoken name for symbol keys, such as "multiply" for ×. Digits are named by their label. */
  ariaLabel?: string
  variant: ButtonVariant
  /** Spans two keypad columns. */
  wide?: boolean
  /**
   * Marks the key unavailable with aria-disabled and ignores presses. The
   * native disabled attribute is not used because the browser drops focus
   * from a button when it becomes disabled, which loses a keyboard user's
   * place on every request.
   */
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
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onPress()
        }
      }}
    >
      {label}
    </button>
  )
}

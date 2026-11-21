// Display formatting only. The unrounded value stays in state and is what
// gets sent to the backend; this is just how it looks on screen.

const DISPLAY_DIGITS = 12

/**
 * Formats a backend result for the display: rounded to 12 significant digits,
 * trailing zeros trimmed, exponent notation for very large or very small
 * magnitudes, and -0 shown as 0.
 *
 * formatNumber(0.30000000000000004) → '0.3'; formatNumber(1e21) → '1e+21'
 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return String(value) // never sent by the backend; shown as-is just in case
  }
  if (value === 0) {
    return '0' // also -0
  }

  const magnitude = Math.abs(value)
  if (magnitude >= 1e12 || magnitude < 1e-6) {
    return exponential(value)
  }
  const plain = value.toPrecision(DISPLAY_DIGITS)
  // Rounding can carry into a 13th digit (999999999999.9 → 1.00000000000e+12).
  return plain.includes('e') ? exponential(value) : trimZeros(plain)
}

function exponential(value: number): string {
  const [mantissa, exponent] = value.toExponential(DISPLAY_DIGITS - 1).split('e')
  return `${trimZeros(mantissa)}e${exponent}`
}

/** Removes trailing zeros after the decimal point, and the point if nothing is left. */
function trimZeros(text: string): string {
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text
}

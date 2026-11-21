// Editing the number being typed. An entry is the text the user has typed
// so far, such as '12', '-0' or '3.'. These functions only edit that text;
// they never do arithmetic. The entry becomes a number (entryToNumber) only
// when it is sent to the backend.
//
// Every entry starts from EMPTY_ENTRY, so '.' first gives '0.', '±' first
// gives '-0', and deleting the last digit leaves '0'. An incomplete entry
// such as '-' or '.' therefore never exists.

import type { Digit } from './types.ts'

/** The most digits that always round-trip through a float64. */
export const MAX_SIGNIFICANT_DIGITS = 15

export const EMPTY_ENTRY = '0'

/**
 * Appends a digit. A lone leading zero is replaced ('0' + '7' → '7'), and
 * the entry is returned unchanged if it would exceed MAX_SIGNIFICANT_DIGITS.
 */
export function appendDigit(entry: string, digit: Digit): string {
  const sign = entry.startsWith('-') ? '-' : ''
  if (entry.slice(sign.length) === '0') {
    return sign + digit
  }
  const next = entry + digit
  return significantDigits(next) > MAX_SIGNIFICANT_DIGITS ? entry : next
}

/** Appends a decimal point, unless the entry already has one. */
export function appendDecimal(entry: string): string {
  return entry.includes('.') ? entry : entry + '.'
}

/** Adds or removes the leading minus sign. */
export function toggleSign(entry: string): string {
  return entry.startsWith('-') ? entry.slice(1) : '-' + entry
}

/** Deletes the last character; an entry left without digits becomes '0'. */
export function deleteLast(entry: string): string {
  const next = entry.slice(0, -1)
  return hasDigit(next) ? next : EMPTY_ENTRY
}

/** Counts the digits after leading zeros: '0.0012' → 2, '-12.50' → 4. */
export function significantDigits(entry: string): number {
  return entry.replace(/\D/g, '').replace(/^0+/, '').length
}

/**
 * Converts the entry to the number sent to the backend, or returns null if
 * it is incomplete (no digit) and must not be sent.
 */
export function entryToNumber(entry: string): number | null {
  if (!hasDigit(entry)) {
    return null
  }
  const value = Number(entry)
  return Number.isNaN(value) ? null : value
}

function hasDigit(text: string): boolean {
  return /\d/.test(text)
}

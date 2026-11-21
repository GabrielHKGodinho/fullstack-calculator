import { describe, expect, it } from 'vitest'
import {
  appendDecimal,
  appendDigit,
  deleteLast,
  entryToNumber,
  MAX_SIGNIFICANT_DIGITS,
  significantDigits,
  toggleSign,
} from './entry.ts'
import type { Digit } from './types.ts'

describe('appendDigit', () => {
  it.each<[string, Digit, string]>([
    ['0', '0', '0'],
    ['0', '7', '7'],
    ['12', '3', '123'],
    ['-0', '5', '-5'],
    ['-0', '0', '-0'],
    ['0.', '0', '0.0'],
    ['1.5', '0', '1.50'],
  ])('%j + %j → %j', (entry, digit, want) => {
    expect(appendDigit(entry, digit)).toBe(want)
  })

  it(`accepts ${MAX_SIGNIFICANT_DIGITS} significant digits and ignores more`, () => {
    const fifteen = '123456789012345'
    expect(appendDigit('12345678901234', '5')).toBe(fifteen)
    expect(appendDigit(fifteen, '6')).toBe(fifteen)
    expect(appendDigit(fifteen, '0')).toBe(fifteen)
    expect(appendDigit('-1234567890.12345', '6')).toBe('-1234567890.12345')
  })

  it('does not count leading zeros toward the limit', () => {
    let entry = '0.000'
    for (const digit of '123456789012345') {
      entry = appendDigit(entry, digit as Digit)
    }
    expect(entry).toBe('0.000123456789012345')
    expect(appendDigit(entry, '6')).toBe(entry)
  })
})

describe('appendDecimal', () => {
  it.each([
    ['0', '0.'],
    ['12', '12.'],
    ['1.5', '1.5'],
    ['3.', '3.'],
    ['-0', '-0.'],
  ])('%j → %j', (entry, want) => {
    expect(appendDecimal(entry)).toBe(want)
  })
})

describe('toggleSign', () => {
  it.each([
    ['5', '-5'],
    ['-5', '5'],
    ['0', '-0'],
    ['-0', '0'],
    ['0.5', '-0.5'],
    ['-12.', '12.'],
  ])('%j → %j', (entry, want) => {
    expect(toggleSign(entry)).toBe(want)
  })
})

describe('deleteLast', () => {
  it.each([
    ['123', '12'],
    ['5', '0'],
    ['-5', '0'],
    ['0.5', '0.'],
    ['1.', '1'],
    ['-0.', '-0'],
    ['0', '0'],
  ])('%j → %j', (entry, want) => {
    expect(deleteLast(entry)).toBe(want)
  })
})

describe('significantDigits', () => {
  it.each([
    ['0', 0],
    ['100', 3],
    ['0.0012', 2],
    ['-12.50', 4],
    ['0.000', 0],
  ])('%j → %i', (entry, want) => {
    expect(significantDigits(entry)).toBe(want)
  })
})

describe('entryToNumber', () => {
  it.each([
    ['12', 12],
    ['12.', 12],
    ['0.', 0],
    ['-3.5', -3.5],
    ['123456789012345', 123456789012345],
    ['0.000123456789012345', 0.000123456789012345],
  ])('%j → %d', (entry, want) => {
    expect(entryToNumber(entry)).toBe(want)
  })

  it('keeps the sign of -0', () => {
    expect(Object.is(entryToNumber('-0'), -0)).toBe(true)
  })

  it.each(['-', '', '.'])('returns null for the incomplete entry %j', (entry) => {
    expect(entryToNumber(entry)).toBeNull()
  })
})

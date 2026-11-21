import { describe, expect, it } from 'vitest'
import { formatNumber } from './format.ts'

describe('formatNumber', () => {
  it.each([
    [0, '0'],

    // plain values: trailing zeros trimmed, integers stay integers
    [12, '12'],
    [-8, '-8'],
    [2.5, '2.5'],
    [100, '100'],
    [1000000, '1000000'],

    // rounded to 12 significant digits
    [0.30000000000000004, '0.3'],
    [1 / 3, '0.333333333333'],
    [2 / 3, '0.666666666667'],
    [1.4142135623730951, '1.41421356237'],
    [-0.000123, '-0.000123'],

    // large magnitudes
    [123456789012, '123456789012'],
    [1e12, '1e+12'],
    [1234567890123, '1.23456789012e+12'],
    [999999999999.9, '1e+12'],
    [-1.5e20, '-1.5e+20'],
    [1.7976931348623157e308, '1.79769313486e+308'],

    // small magnitudes
    [0.000001, '0.000001'],
    [1e-7, '1e-7'],
    [1.23e-10, '1.23e-10'],
  ])('%d → %j', (value, want) => {
    expect(formatNumber(value)).toBe(want)
  })

  it('shows -0 as 0', () => {
    expect(formatNumber(-0)).toBe('0')
  })

  it.each([
    [Infinity, 'Infinity'],
    [NaN, 'NaN'],
  ])('shows the non-finite value %d as-is', (value, want) => {
    expect(formatNumber(value)).toBe(want)
  })
})

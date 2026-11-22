import { describe, expect, it } from 'vitest'
import {
  calculatorReducer,
  initialState,
  selectDisplay,
  type Action,
  type CalculatorState,
} from './reducer.ts'
import type { Digit } from './types.ts'

const KEYS: Record<string, Action> = {
  '.': { type: 'decimal' },
  '±': { type: 'toggleSign' },
  '⌫': { type: 'backspace' },
  C: { type: 'clear' },
  '+': { type: 'operator', operator: 'add' },
  '−': { type: 'operator', operator: 'subtract' },
  '×': { type: 'operator', operator: 'multiply' },
  '÷': { type: 'operator', operator: 'divide' },
  '^': { type: 'operator', operator: 'power' },
  '%': { type: 'operator', operator: 'percentage' },
  '=': { type: 'equals' },
  '√': { type: 'sqrt' },
}

/** Turns '9 + 16 √' into actions. A run of digits such as '16' is one press per digit. */
function keys(sequence: string): Action[] {
  return sequence.split(' ').flatMap((key): Action[] => {
    if (/^\d+$/.test(key)) {
      return [...key].map((digit) => ({ type: 'digit', digit: digit as Digit }))
    }
    if (!(key in KEYS)) {
      throw new Error(`unknown key ${JSON.stringify(key)}`)
    }
    return [KEYS[key]]
  })
}

/** Presses the keys in sequence, starting from state. */
function run(sequence: string, state: CalculatorState = initialState): CalculatorState {
  return keys(sequence).reduce(calculatorReducer, state)
}

function succeed(state: CalculatorState, result: number): CalculatorState {
  return calculatorReducer(state, { type: 'calculationSucceeded', result })
}

function fail(state: CalculatorState, message: string): CalculatorState {
  return calculatorReducer(state, { type: 'calculationFailed', message })
}

function main(state: CalculatorState): string {
  return selectDisplay(state).main
}

function secondary(state: CalculatorState): string {
  return selectDisplay(state).secondary
}

/** The state after 2 + 3 = and a result of 5. */
const resultFive = succeed(run('2 + 3 ='), 5)

describe('typing a number', () => {
  it('starts at 0', () => {
    expect(selectDisplay(initialState)).toEqual({ main: '0', secondary: '', isError: false })
  })

  it.each([
    ['1 2', '12'],
    ['0 0 7', '7'],
    ['. 5', '0.5'],
    ['1 . . 5', '1.5'],
    ['1234567890123456', '123456789012345'],
  ])('%s shows %s', (sequence, want) => {
    expect(main(run(sequence))).toBe(want)
  })

  it('ignores a key that does not change the entry', () => {
    const fifteen = run('123456789012345')
    expect(run('6', fifteen)).toBe(fifteen)
    const withPoint = run('1 .')
    expect(run('.', withPoint)).toBe(withPoint)
    expect(run('0', initialState)).toBe(initialState)
  })
})

describe('backspace', () => {
  it.each([
    ['1 2 3 ⌫', '12'],
    ['5 ⌫', '0'],
    ['1 . ⌫', '1'],
  ])('%s shows %s', (sequence, want) => {
    expect(main(run(sequence))).toBe(want)
  })

  it('is ignored on 0', () => {
    expect(run('⌫')).toBe(initialState)
  })

  it('is ignored on a result', () => {
    expect(run('⌫', resultFive)).toBe(resultFive)
  })

  it('is ignored right after an operator', () => {
    const afterOperator = run('2 +')
    expect(run('⌫', afterOperator)).toBe(afterOperator)
  })
})

describe('toggle sign', () => {
  it.each([
    ['5 ±', '-5'],
    ['5 ± ±', '5'],
    ['±', '-0'],
    ['± 3', '-3'],
    ['2 + ±', '-0'],
  ])('%s shows %s', (sequence, want) => {
    expect(main(run(sequence))).toBe(want)
  })

  it('starts a negative second operand after an operator', () => {
    expect(run('2 + ± 3 =').request).toEqual({
      operation: 'add',
      operands: [2, -3],
      then: { kind: 'equals' },
    })
  })

  it('negates a result and keeps it a result', () => {
    const state = run('±', succeed(run('16 √'), 4))
    expect(state.input).toEqual({ kind: 'result', value: -4 })
    expect(main(state)).toBe('-4')
  })
})

describe('operators', () => {
  it('stores the first operand without sending a request', () => {
    const state = run('2 +')
    expect(state.pending).toEqual({ operand: 2, operator: 'add' })
    expect(state.request).toBeNull()
    expect(selectDisplay(state)).toEqual({ main: '2', secondary: '2 +', isError: false })
  })

  it('replaces the operator when another one is pressed before the second operand', () => {
    const state = run('2 + ×')
    expect(state.pending).toEqual({ operand: 2, operator: 'multiply' })
    expect(state.request).toBeNull()
    expect(secondary(state)).toBe('2 ×')
  })

  it('ignores the same operator pressed twice', () => {
    const afterOperator = run('2 +')
    expect(run('+', afterOperator)).toBe(afterOperator)
  })

  it.each([
    ['+', 'add', '+'],
    ['−', 'subtract', '−'],
    ['×', 'multiply', '×'],
    ['÷', 'divide', '÷'],
    ['^', 'power', '^'],
    ['%', 'percentage', '%'],
  ])('%s sends %s and shows %s', (key, operation, symbol) => {
    expect(secondary(run(`8 ${key}`))).toBe(`8 ${symbol}`)
    expect(run(`8 ${key} 2 =`).request).toEqual({
      operation,
      operands: [8, 2],
      then: { kind: 'equals' },
    })
  })

  it('starts the second operand after an operator', () => {
    expect(selectDisplay(run('2 + 7'))).toEqual({ main: '7', secondary: '2 +', isError: false })
    expect(main(run('2 + .'))).toBe('0.')
  })

  it('chains operations one request at a time: 2 + 3 × 4 = gives 20', () => {
    let state = run('2 + 3 ×')
    expect(state.request).toEqual({
      operation: 'add',
      operands: [2, 3],
      then: { kind: 'operator', operator: 'multiply' },
    })
    // The display keeps the current number while the request is in flight.
    expect(selectDisplay(state)).toEqual({ main: '3', secondary: '2 +', isError: false })

    state = succeed(state, 5)
    expect(state.request).toBeNull()
    expect(state.pending).toEqual({ operand: 5, operator: 'multiply' })
    expect(state.input).toEqual({ kind: 'none' })
    expect(selectDisplay(state)).toEqual({ main: '5', secondary: '5 ×', isError: false })

    state = run('4 =', state)
    expect(state.request).toEqual({
      operation: 'multiply',
      operands: [5, 4],
      then: { kind: 'equals' },
    })

    state = succeed(state, 20)
    expect(state.pending).toBeNull()
    expect(selectDisplay(state)).toEqual({ main: '20', secondary: '', isError: false })
  })

  it('sends percentage with the operands in order: 20 % 50 =', () => {
    expect(run('20 % 50 =').request).toEqual({
      operation: 'percentage',
      operands: [20, 50],
      then: { kind: 'equals' },
    })
  })
})

describe('after a result', () => {
  it('starts a new entry on a digit', () => {
    const state = run('7', resultFive)
    expect(state.input).toEqual({ kind: 'entry', text: '7' })
    expect(selectDisplay(state)).toEqual({ main: '7', secondary: '', isError: false })
  })

  it('starts a new entry 0. on a decimal point', () => {
    expect(main(run('.', resultFive))).toBe('0.')
  })

  it('uses the result as the first operand of an operator', () => {
    const state = run('×', resultFive)
    expect(state.pending).toEqual({ operand: 5, operator: 'multiply' })
    expect(state.request).toBeNull()
  })
})

describe('equals', () => {
  it('is ignored with nothing pending', () => {
    expect(run('=')).toBe(initialState)
    const five = run('5')
    expect(run('=', five)).toBe(five)
  })

  it('is ignored right after an operator', () => {
    const afterOperator = run('5 +')
    expect(run('=', afterOperator)).toBe(afterOperator)
  })

  it('does not repeat the last operation after a result', () => {
    expect(run('=', resultFive)).toBe(resultFive)
  })
})

describe('square root', () => {
  it('sends the entry and shows the result', () => {
    let state = run('16 √')
    expect(state.request).toEqual({ operation: 'sqrt', operands: [16], then: { kind: 'sqrt' } })

    state = succeed(state, 4)
    expect(selectDisplay(state)).toEqual({ main: '4', secondary: '', isError: false })
  })

  it('keeps the pending operation: 9 + √16 = gives 13', () => {
    let state = run('9 + 16 √')
    expect(state.request).toEqual({ operation: 'sqrt', operands: [16], then: { kind: 'sqrt' } })
    expect(state.pending).toEqual({ operand: 9, operator: 'add' })

    state = succeed(state, 4)
    expect(selectDisplay(state)).toEqual({ main: '4', secondary: '9 +', isError: false })

    state = run('=', state)
    expect(state.request).toEqual({ operation: 'add', operands: [9, 4], then: { kind: 'equals' } })

    state = succeed(state, 13)
    expect(selectDisplay(state)).toEqual({ main: '13', secondary: '', isError: false })
  })

  it('chains a square root result into the next operator', () => {
    const state = run('×', succeed(run('9 + 16 √'), 4))
    expect(state.request).toEqual({
      operation: 'add',
      operands: [9, 4],
      then: { kind: 'operator', operator: 'multiply' },
    })
  })

  it('is ignored right after an operator', () => {
    const afterOperator = run('9 +')
    expect(run('√', afterOperator)).toBe(afterOperator)
  })

  it('sends a result', () => {
    expect(run('√', resultFive).request).toEqual({
      operation: 'sqrt',
      operands: [5],
      then: { kind: 'sqrt' },
    })
  })
})

describe('precision', () => {
  it('shows a rounded result but sends the unrounded value', () => {
    let state = succeed(run('0 . 1 + 0 . 2 ='), 0.30000000000000004)
    expect(main(state)).toBe('0.3')

    state = run('+ 1 =', state)
    expect(state.request?.operands).toEqual([0.30000000000000004, 1])
  })

  it('stores a 15-digit entry exactly', () => {
    expect(run('123456789012345 +').pending?.operand).toBe(123456789012345)
  })
})

// SPEC 5.4. No key sequence can create these entries (see entry.ts), so the
// states are built directly to check that the reducer still ignores them.
describe('incomplete entries', () => {
  function withEntry(text: string, pending: CalculatorState['pending'] = null): CalculatorState {
    return { ...initialState, input: { kind: 'entry', text }, pending }
  }

  it.each(['-', '.', '-.', ''])('ignores an operator, = and √ on the entry %j', (text) => {
    const alone = withEntry(text)
    const withPending = withEntry(text, { operand: 2, operator: 'add' })
    for (const state of [alone, withPending]) {
      for (const key of ['+', '=', '√']) {
        expect(run(key, state)).toBe(state)
      }
    }
  })
})

describe('requests', () => {
  const inFlight = run('2 + 3 =')

  it.each(['5', '.', '±', '⌫', 'C', '+', '=', '√'])('ignores %s while one is in flight', (key) => {
    expect(run(key, inFlight)).toBe(inFlight)
  })

  it('ignores a result when none is in flight', () => {
    expect(succeed(initialState, 1)).toBe(initialState)
    expect(fail(initialState, 'boom')).toBe(initialState)
  })
})

describe('errors', () => {
  const errored = fail(run('1 ÷ 0 ='), 'cannot divide by zero')

  it('shows the message and clears the pending operation', () => {
    expect(selectDisplay(errored)).toEqual({
      main: 'cannot divide by zero',
      secondary: '',
      isError: true,
    })
    expect(errored.pending).toBeNull()
    expect(errored.request).toBeNull()
  })

  it('clears a chain that fails halfway', () => {
    const state = fail(run('2 + 3 ×'), 'the result is too large')
    expect(state).toEqual({ ...initialState, error: 'the result is too large' })
  })

  it.each(['+', '=', '⌫', '±', '√'])('ignores %s', (key) => {
    expect(run(key, errored)).toBe(errored)
  })

  it.each([
    ['5', '5'],
    ['.', '0.'],
  ])('starts over on %s', (key, want) => {
    const state = run(key, errored)
    expect(state.error).toBeNull()
    expect(selectDisplay(state)).toEqual({ main: want, secondary: '', isError: false })
  })

  it('returns to the initial state on C', () => {
    expect(run('C', errored)).toEqual(initialState)
  })
})

describe('clear', () => {
  it.each([
    ['an entry', run('1 2')],
    ['a pending operation', run('2 +')],
    ['a second operand', run('2 + 3')],
    ['a result', resultFive],
  ])('returns to the initial state from %s', (_, state) => {
    expect(run('C', state)).toEqual(initialState)
  })
})

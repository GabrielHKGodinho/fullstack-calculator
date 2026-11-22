// The calculator's state machine. It is pure: it never calls the backend and
// never does arithmetic. When an operation must run, it puts a CalcRequest in
// state; useCalculator sends it and dispatches calculationSucceeded or
// calculationFailed with the answer.
//
// An action that changes nothing returns the same state object.

import {
  appendDecimal,
  appendDigit,
  deleteLast,
  EMPTY_ENTRY,
  entryToNumber,
  toggleSign,
} from './entry.ts'
import { formatNumber } from './format.ts'
import type { BinaryOperator, Digit, Operation } from './types.ts'

/** What the main display line holds. */
export type Input =
  | { kind: 'entry'; text: string } // a number being typed, shown as typed
  | { kind: 'result'; value: number } // a backend result, kept unrounded
  | { kind: 'none' } // right after an operator; the display shows pending.operand

/** The first operand and the operator waiting for a second operand. */
export interface Pending {
  operand: number
  operator: BinaryOperator
}

/** What to do with a request's result once it arrives. */
export type AfterResult =
  | { kind: 'equals' } // show the result and clear pending
  | { kind: 'sqrt' } // show the result and keep pending
  | { kind: 'operator'; operator: BinaryOperator } // chaining: the result becomes the new first operand

export interface CalcRequest {
  operation: Operation
  operands: number[]
  then: AfterResult
}

export interface CalculatorState {
  input: Input
  pending: Pending | null
  /** Non-null while a request is in flight; every key is ignored until it settles. */
  request: CalcRequest | null
  /** Non-null in the error state; this is the message shown. */
  error: string | null
}

export const initialState: CalculatorState = {
  input: { kind: 'entry', text: EMPTY_ENTRY },
  pending: null,
  request: null,
  error: null,
}

export type Action =
  | { type: 'digit'; digit: Digit }
  | { type: 'decimal' }
  | { type: 'toggleSign' }
  | { type: 'backspace' }
  | { type: 'clear' }
  | { type: 'operator'; operator: BinaryOperator }
  | { type: 'equals' }
  | { type: 'sqrt' }
  | { type: 'calculationSucceeded'; result: number }
  | { type: 'calculationFailed'; message: string }

const NO_INPUT: Input = { kind: 'none' }

export function calculatorReducer(state: CalculatorState, action: Action): CalculatorState {
  if (state.request !== null) {
    return settle(state, state.request, action)
  }
  if (action.type === 'calculationSucceeded' || action.type === 'calculationFailed') {
    return state // no request in flight, so there is nothing to settle
  }
  if (state.error !== null) {
    return recoverFromError(state, action)
  }

  switch (action.type) {
    case 'digit':
      return editEntry(state, (text) => appendDigit(text, action.digit))
    case 'decimal':
      return editEntry(state, appendDecimal)
    case 'toggleSign':
      return pressToggleSign(state)
    case 'backspace':
      return state.input.kind === 'entry' ? editEntry(state, deleteLast) : state
    case 'clear':
      return initialState
    case 'operator':
      return pressOperator(state, action.operator)
    case 'equals':
      return pressEquals(state)
    case 'sqrt':
      return pressSqrt(state)
  }
}

/** While a request is in flight, only its result is accepted. */
function settle(state: CalculatorState, request: CalcRequest, action: Action): CalculatorState {
  switch (action.type) {
    case 'calculationSucceeded':
      return applyResult(state, request.then, action.result)
    case 'calculationFailed':
      return { ...initialState, error: action.message }
    default:
      return state
  }
}

function applyResult(state: CalculatorState, then: AfterResult, result: number): CalculatorState {
  switch (then.kind) {
    case 'equals':
      return { ...state, input: { kind: 'result', value: result }, pending: null, request: null }
    case 'sqrt':
      return { ...state, input: { kind: 'result', value: result }, request: null }
    case 'operator':
      return {
        ...state,
        input: NO_INPUT,
        pending: { operand: result, operator: then.operator },
        request: null,
      }
  }
}

/** In the error state, C clears, a digit or '.' starts over, and everything else is ignored. */
function recoverFromError(state: CalculatorState, action: Action): CalculatorState {
  switch (action.type) {
    case 'clear':
      return initialState
    case 'digit':
    case 'decimal':
      return calculatorReducer(initialState, action)
    default:
      return state
  }
}

/**
 * Applies an edit to the entry being typed. After a result or an operator
 * there is no entry yet, so the edit starts from EMPTY_ENTRY: a digit gives
 * that digit, '.' gives '0.' and '±' gives '-0'.
 */
function editEntry(state: CalculatorState, edit: (text: string) => string): CalculatorState {
  const text = state.input.kind === 'entry' ? state.input.text : EMPTY_ENTRY
  const next = edit(text)
  if (state.input.kind === 'entry' && next === text) {
    return state
  }
  return { ...state, input: { kind: 'entry', text: next } }
}

function pressToggleSign(state: CalculatorState): CalculatorState {
  if (state.input.kind === 'result') {
    // Flipping the sign is editing, not arithmetic; the value stays unrounded.
    return { ...state, input: { kind: 'result', value: -state.input.value } }
  }
  return editEntry(state, toggleSign)
}

function pressOperator(state: CalculatorState, operator: BinaryOperator): CalculatorState {
  if (state.input.kind === 'none') {
    // Pressing another operator before the second operand replaces the first.
    if (state.pending === null || state.pending.operator === operator) {
      return state
    }
    return { ...state, pending: { ...state.pending, operator } }
  }

  const value = currentNumber(state.input)
  if (value === null) {
    return state
  }
  if (state.pending === null) {
    return { ...state, input: NO_INPUT, pending: { operand: value, operator } }
  }
  return withRequest(state, state.pending.operator, [state.pending.operand, value], {
    kind: 'operator',
    operator,
  })
}

function pressEquals(state: CalculatorState): CalculatorState {
  const value = currentNumber(state.input)
  if (state.pending === null || value === null) {
    return state // nothing to complete, or no second operand yet
  }
  return withRequest(state, state.pending.operator, [state.pending.operand, value], {
    kind: 'equals',
  })
}

function pressSqrt(state: CalculatorState): CalculatorState {
  const value = currentNumber(state.input)
  if (value === null) {
    return state
  }
  return withRequest(state, 'sqrt', [value], { kind: 'sqrt' })
}

/** The number on the main line, or null when there is none (right after an operator). */
function currentNumber(input: Input): number | null {
  switch (input.kind) {
    case 'entry':
      return entryToNumber(input.text)
    case 'result':
      return input.value
    case 'none':
      return null
  }
}

function withRequest(
  state: CalculatorState,
  operation: Operation,
  operands: number[],
  then: AfterResult,
): CalculatorState {
  return { ...state, request: { operation, operands, then } }
}

export interface DisplayView {
  main: string
  secondary: string
  isError: boolean
}

const OPERATOR_SYMBOLS: Record<BinaryOperator, string> = {
  add: '+',
  subtract: '−',
  multiply: '×',
  divide: '÷',
  power: '^',
  percentage: '%',
}

/** What the display shows: the main line, the pending operation above it, and the error flag. */
export function selectDisplay(state: CalculatorState): DisplayView {
  if (state.error !== null) {
    return { main: state.error, secondary: '', isError: true }
  }
  const { input, pending } = state
  const secondary =
    pending === null ? '' : `${formatNumber(pending.operand)} ${OPERATOR_SYMBOLS[pending.operator]}`
  return { main: mainText(input, pending), secondary, isError: false }
}

function mainText(input: Input, pending: Pending | null): string {
  switch (input.kind) {
    case 'entry':
      return input.text
    case 'result':
      return formatNumber(input.value)
    case 'none':
      return pending === null ? EMPTY_ENTRY : formatNumber(pending.operand)
  }
}

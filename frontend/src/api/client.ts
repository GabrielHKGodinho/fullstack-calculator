import type { Operation } from '../calculator/types.ts'

/** Code used when the backend could not be reached or gave no usable answer. */
export const NETWORK_ERROR = 'NETWORK_ERROR'
export const NETWORK_ERROR_MESSAGE = "Can't reach the calculator service"

/** How long a request may take before it is abandoned as NETWORK_ERROR. */
export const REQUEST_TIMEOUT_MS = 10_000

/** A failed calculation: the backend's error, or NETWORK_ERROR. */
export class ApiError extends Error {
  /** The backend's error code (e.g. DIVISION_BY_ZERO), or NETWORK_ERROR. */
  readonly code: string
  /** The HTTP status, or 0 when no response was received. */
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

/**
 * Asks the backend to run one operation and returns its result.
 *
 * Rejects with an ApiError carrying the backend's code and message, or with
 * NETWORK_ERROR when the request fails, takes longer than REQUEST_TIMEOUT_MS
 * or the response is not the API's JSON. If `signal` aborts the request, the
 * abort error is rethrown as is.
 */
export async function calculate(
  operation: Operation,
  operands: number[],
  signal?: AbortSignal,
): Promise<number> {
  // A backend that never answers would otherwise keep the keypad disabled
  // until a reload, since every key is ignored while a request is in flight.
  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS)
  const requestSignal = signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal
  try {
    return await send(operation, operands, requestSignal, signal)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Sends the request with requestSignal, which aborts on the caller's signal
 * or on the timeout. Only the caller's abort is rethrown; a timeout becomes
 * NETWORK_ERROR like any other failed request.
 */
async function send(
  operation: Operation,
  operands: number[],
  requestSignal: AbortSignal,
  callerSignal: AbortSignal | undefined,
): Promise<number> {
  let response: Response
  let body: unknown
  try {
    // Relative URL: the Vite proxy (dev) or the Go server (Docker) serves it.
    response = await fetch(`/api/v1/${operation}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operands }),
      signal: requestSignal,
    })
  } catch (error) {
    if (callerSignal?.aborted) throw error
    throw networkError(0)
  }

  try {
    body = await response.json()
  } catch (error) {
    if (callerSignal?.aborted) throw error
    throw networkError(response.status)
  }

  if (response.ok && isResultBody(body)) {
    return body.result
  }
  if (!response.ok && isErrorBody(body)) {
    throw new ApiError(body.error.code, body.error.message, response.status)
  }
  // JSON, but not the API's shape (e.g. something other than the Go server
  // answered), so treat it like an unreachable service.
  throw networkError(response.status)
}

function networkError(status: number): ApiError {
  return new ApiError(NETWORK_ERROR, NETWORK_ERROR_MESSAGE, status)
}

function isResultBody(body: unknown): body is { result: number } {
  return isObject(body) && typeof body.result === 'number'
}

function isErrorBody(body: unknown): body is { error: { code: string; message: string } } {
  return (
    isObject(body) &&
    isObject(body.error) &&
    typeof body.error.code === 'string' &&
    typeof body.error.message === 'string'
  )
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

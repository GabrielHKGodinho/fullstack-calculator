import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { ApiError, calculate, NETWORK_ERROR_MESSAGE } from './client.ts'

let fetchMock: Mock<typeof fetch>

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Runs promise, which must reject, and returns the rejection reason. */
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('expected the promise to reject')
}

function expectApiError(error: unknown, code: string, message: string, status: number) {
  expect(error).toBeInstanceOf(ApiError)
  const apiError = error as ApiError
  expect(apiError.code).toBe(code)
  expect(apiError.message).toBe(message)
  expect(apiError.status).toBe(status)
}

describe('calculate', () => {
  it('posts the operands as JSON and returns the result', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { result: 12 }))

    await expect(calculate('add', [10, 2])).resolves.toBe(12)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/add')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init?.body as string)).toEqual({ operands: [10, 2] })
  })

  it('sends a single operand for sqrt', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { result: 4 }))

    await expect(calculate('sqrt', [16])).resolves.toBe(4)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/sqrt')
    expect(JSON.parse(init?.body as string)).toEqual({ operands: [16] })
  })

  it.each([
    { status: 400, code: 'NULL_OPERAND', message: 'operands must not be null' },
    { status: 404, code: 'UNKNOWN_OPERATION', message: 'unknown operation "modulo"' },
    { status: 413, code: 'BODY_TOO_LARGE', message: 'request body must not exceed 1MB' },
    { status: 422, code: 'DIVISION_BY_ZERO', message: 'cannot divide by zero' },
  ])('rejects with the backend error $code ($status)', async ({ status, code, message }) => {
    fetchMock.mockResolvedValue(jsonResponse(status, { error: { code, message } }))

    const error = await rejection(calculate('divide', [1, 0]))

    expectApiError(error, code, message, status)
  })

  it('rejects with NETWORK_ERROR when the request fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = await rejection(calculate('add', [1, 2]))

    expectApiError(error, 'NETWORK_ERROR', NETWORK_ERROR_MESSAGE, 0)
  })

  it('rejects with NETWORK_ERROR when the response is not JSON', async () => {
    fetchMock.mockResolvedValue(
      new Response('Internal Server Error', { status: 500, headers: { 'Content-Type': 'text/plain' } }),
    )

    const error = await rejection(calculate('add', [1, 2]))

    expectApiError(error, 'NETWORK_ERROR', NETWORK_ERROR_MESSAGE, 500)
  })

  it.each([
    { name: 'success without result', status: 200, body: {} },
    { name: 'result that is not a number', status: 200, body: { result: '12' } },
    { name: 'error that is not an object', status: 400, body: { error: 'x' } },
    { name: 'error body with a success status', status: 200, body: { error: { code: 'X', message: 'x' } } },
    { name: 'result body with an error status', status: 500, body: { result: 1 } },
  ])('rejects with NETWORK_ERROR for an unexpected JSON shape: $name', async ({ status, body }) => {
    fetchMock.mockResolvedValue(jsonResponse(status, body))

    const error = await rejection(calculate('add', [1, 2]))

    expectApiError(error, 'NETWORK_ERROR', NETWORK_ERROR_MESSAGE, status)
  })

  it('passes the signal to fetch and rethrows the abort error as is', async () => {
    const controller = new AbortController()
    const abortError = new DOMException('This operation was aborted', 'AbortError')
    fetchMock.mockImplementation(() => {
      controller.abort()
      return Promise.reject(abortError)
    })

    const error = await rejection(calculate('add', [1, 2], controller.signal))

    expect(error).toBe(abortError)
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal)
  })
})

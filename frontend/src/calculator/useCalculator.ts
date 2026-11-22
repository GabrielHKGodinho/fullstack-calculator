import { useEffect, useReducer } from 'react'
import { ApiError, calculate, NETWORK_ERROR_MESSAGE } from '../api/client.ts'
import {
  calculatorReducer,
  initialState,
  selectDisplay,
  type Action,
  type DisplayView,
} from './reducer.ts'

export interface Calculator {
  display: DisplayView
  /** True while a request is in flight; the keypad is disabled. */
  busy: boolean
  press: (action: Action) => void
}

/**
 * Runs the calculator reducer and sends the request it asks for. All the
 * logic is in the reducer; this hook only carries out state.request and
 * reports the answer back as calculationSucceeded or calculationFailed.
 */
export function useCalculator(): Calculator {
  const [state, dispatch] = useReducer(calculatorReducer, initialState)
  const { request } = state

  // Depends on the request object only, so each request is sent exactly once.
  // Cleanup aborts it if the component unmounts before it settles.
  useEffect(() => {
    if (request === null) {
      return
    }
    const controller = new AbortController()
    calculate(request.operation, request.operands, controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) {
          dispatch({ type: 'calculationSucceeded', result })
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          const message = error instanceof ApiError ? error.message : NETWORK_ERROR_MESSAGE
          dispatch({ type: 'calculationFailed', message })
        }
      },
    )
    return () => controller.abort()
  }, [request])

  return { display: selectDisplay(state), busy: request !== null, press: dispatch }
}

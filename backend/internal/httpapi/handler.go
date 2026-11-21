// Package httpapi exposes the calculator as a JSON REST API. It owns
// everything HTTP: routing, the method check, body decoding and validation,
// mapping calculator errors to status codes, and writing JSON responses.
package httpapi

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/GabrielHKGodinho/fullstack-calculator/backend/internal/calculator"
)

// New returns the API handler. It serves POST /api/v1/{operation} and answers
// every other path under /api/ with a JSON 404. logger is used only for
// unexpected errors and must not be nil.
func New(logger *slog.Logger) http.Handler {
	h := handler{logger: logger}
	mux := http.NewServeMux()
	// The patterns have no method on purpose: handleOperation checks the
	// method itself so that the 405 response has a JSON body.
	mux.HandleFunc("/api/v1/{operation}", h.handleOperation)
	mux.HandleFunc("/api/", h.handleNotFound)
	return mux
}

type handler struct {
	logger *slog.Logger
}

// handleOperation runs the checks of SPEC §4.4 in order; the first failure
// wins.
func (h handler) handleOperation(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("operation")
	op, err := calculator.Lookup(name)
	if err != nil {
		writeError(w, &apiError{
			status:  http.StatusNotFound,
			code:    codeUnknownOperation,
			message: fmt.Sprintf("unknown operation %q", name),
		})
		return
	}

	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		writeError(w, &apiError{
			status:  http.StatusMethodNotAllowed,
			code:    codeMethodNotAllowed,
			message: fmt.Sprintf("method %s not allowed, use POST", r.Method),
		})
		return
	}

	req, apiErr := decodeRequest(r)
	if apiErr != nil {
		writeError(w, apiErr)
		return
	}

	operands, apiErr := operandValues(req.Operands)
	if apiErr != nil {
		writeError(w, apiErr)
		return
	}

	result, err := op.Apply(operands)
	if err != nil {
		writeError(w, h.calculatorError(op, len(operands), err))
		return
	}

	writeJSON(w, http.StatusOK, resultResponse{Result: result})
}

func (h handler) handleNotFound(w http.ResponseWriter, r *http.Request) {
	writeError(w, &apiError{
		status:  http.StatusNotFound,
		code:    codeNotFound,
		message: "not found",
	})
}

// calculatorError maps an error from op.Apply, called with n operands, to an
// API error. An error it does not know is a bug: it is logged and becomes a
// 500.
func (h handler) calculatorError(op calculator.Operation, n int, err error) *apiError {
	switch {
	case errors.Is(err, calculator.ErrWrongOperandCount):
		noun := "operands"
		if op.Arity == 1 {
			noun = "operand"
		}
		return &apiError{
			status:  http.StatusBadRequest,
			code:    codeWrongOperandCount,
			message: fmt.Sprintf("%s takes %d %s, got %d", op.Name, op.Arity, noun, n),
		}
	case errors.Is(err, calculator.ErrDivisionByZero):
		return &apiError{
			status:  http.StatusUnprocessableEntity,
			code:    codeDivisionByZero,
			message: "cannot divide by zero",
		}
	case errors.Is(err, calculator.ErrSqrtOfNegative):
		return &apiError{
			status:  http.StatusUnprocessableEntity,
			code:    codeSqrtOfNegative,
			message: "cannot take the square root of a negative number",
		}
	case errors.Is(err, calculator.ErrResultNotFinite):
		return &apiError{
			status:  http.StatusUnprocessableEntity,
			code:    codeResultNotFinite,
			message: "result is too large or undefined",
		}
	default:
		h.logger.Error("unexpected calculator error", "operation", op.Name, "error", err)
		return &apiError{
			status:  http.StatusInternalServerError,
			code:    codeInternalError,
			message: "internal server error",
		}
	}
}

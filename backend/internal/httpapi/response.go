package httpapi

import (
	"encoding/json"
	"net/http"
)

// Error codes are the stable API contract; messages are for humans and may
// change.
const (
	codeInvalidJSON       = "INVALID_JSON"
	codeUnknownField      = "UNKNOWN_FIELD"
	codeMissingOperands   = "MISSING_OPERANDS"
	codeNullOperand       = "NULL_OPERAND"
	codeWrongOperandCount = "WRONG_OPERAND_COUNT"
	codeUnknownOperation  = "UNKNOWN_OPERATION"
	codeNotFound          = "NOT_FOUND"
	codeMethodNotAllowed  = "METHOD_NOT_ALLOWED"
	codeBodyTooLarge      = "BODY_TOO_LARGE"
	codeDivisionByZero    = "DIVISION_BY_ZERO"
	codeSqrtOfNegative    = "SQRT_OF_NEGATIVE"
	codeResultNotFinite   = "RESULT_NOT_FINITE"
	codeInternalError     = "INTERNAL_ERROR"
)

// resultResponse is the body of a successful calculation.
type resultResponse struct {
	Result float64 `json:"result"`
}

// errorResponse is the body of every error response.
type errorResponse struct {
	Error errorBody `json:"error"`
}

type errorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// apiError is a failed request: the HTTP status plus the code and message
// that go into the error body.
type apiError struct {
	status  int
	code    string
	message string
}

// writeJSON writes v as a JSON response with the given status.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	// The values written here are strings and finite floats, so encoding
	// can only fail if the client has gone away. There is nothing useful
	// to do about that, so the error is ignored.
	_ = json.NewEncoder(w).Encode(v)
}

// writeError writes e as a JSON error response.
func writeError(w http.ResponseWriter, e *apiError) {
	writeJSON(w, e.status, errorResponse{Error: errorBody{Code: e.code, Message: e.message}})
}

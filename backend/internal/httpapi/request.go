package httpapi

import (
	"encoding/json"
	"net/http"
)

// calculateRequest is the body of POST /api/v1/{operation}.
type calculateRequest struct {
	// Pointers keep a JSON null element distinguishable from 0.
	Operands []*float64 `json:"operands"`
}

// decodeRequest decodes the request body. Any decoding failure (empty body,
// invalid syntax, wrong types, numbers outside the float64 range) is
// INVALID_JSON.
func decodeRequest(r *http.Request) (calculateRequest, *apiError) {
	var req calculateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return calculateRequest{}, &apiError{
			status:  http.StatusBadRequest,
			code:    codeInvalidJSON,
			message: "request body must be valid JSON",
		}
	}
	return req, nil
}

// operandValues checks that operands is present and has no null elements,
// and returns its values. The operand count is checked by calculator.
func operandValues(raw []*float64) ([]float64, *apiError) {
	if raw == nil {
		return nil, &apiError{
			status:  http.StatusBadRequest,
			code:    codeMissingOperands,
			message: `"operands" is required`,
		}
	}
	values := make([]float64, len(raw))
	for i, p := range raw {
		if p == nil {
			return nil, &apiError{
				status:  http.StatusBadRequest,
				code:    codeNullOperand,
				message: "operands must not be null",
			}
		}
		values[i] = *p
	}
	return values, nil
}

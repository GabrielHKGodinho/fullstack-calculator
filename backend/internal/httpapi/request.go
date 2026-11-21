package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// maxBodyBytes is the largest request body accepted (1 MB).
const maxBodyBytes = 1 << 20

// calculateRequest is the body of POST /api/v1/{operation}.
type calculateRequest struct {
	// Pointers keep a JSON null element distinguishable from 0.
	Operands []*float64 `json:"operands"`
}

// decodeRequest decodes the request body, which must be a single JSON object
// of at most maxBodyBytes with no field other than "operands". Only
// whitespace may follow the object.
//
// Errors: BODY_TOO_LARGE (413), UNKNOWN_FIELD (400), and INVALID_JSON (400)
// for everything else (empty body, invalid syntax, wrong types, numbers
// outside the float64 range, trailing data).
func decodeRequest(w http.ResponseWriter, r *http.Request) (calculateRequest, *apiError) {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes))
	dec.DisallowUnknownFields()

	var req calculateRequest
	if err := dec.Decode(&req); err != nil {
		if e := bodyTooLarge(err); e != nil {
			return calculateRequest{}, e
		}
		if e := unknownField(err); e != nil {
			return calculateRequest{}, e
		}
		return calculateRequest{}, invalidJSON()
	}

	// Anything but whitespace after the object is trailing data. A
	// RawMessage accepts any value, so a second object counts as trailing
	// data rather than as an unknown field.
	var extra json.RawMessage
	if err := dec.Decode(&extra); !errors.Is(err, io.EOF) {
		if e := bodyTooLarge(err); e != nil {
			return calculateRequest{}, e
		}
		return calculateRequest{}, invalidJSON()
	}

	return req, nil
}

// bodyTooLarge returns a BODY_TOO_LARGE error if err comes from the
// http.MaxBytesReader limit, and nil otherwise.
func bodyTooLarge(err error) *apiError {
	var maxBytesErr *http.MaxBytesError
	if !errors.As(err, &maxBytesErr) {
		return nil
	}
	return &apiError{
		status:  http.StatusRequestEntityTooLarge,
		code:    codeBodyTooLarge,
		message: "request body must not exceed 1MB",
	}
}

// unknownField returns an UNKNOWN_FIELD error if err comes from
// DisallowUnknownFields, and nil otherwise. encoding/json has no typed error
// for this case, so its message is the only way to tell it apart.
func unknownField(err error) *apiError {
	field, ok := strings.CutPrefix(err.Error(), "json: unknown field ")
	if !ok {
		return nil
	}
	return &apiError{
		status:  http.StatusBadRequest,
		code:    codeUnknownField,
		message: fmt.Sprintf("unknown field %s", field), // field is already quoted
	}
}

func invalidJSON() *apiError {
	return &apiError{
		status:  http.StatusBadRequest,
		code:    codeInvalidJSON,
		message: "request body must be valid JSON",
	}
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

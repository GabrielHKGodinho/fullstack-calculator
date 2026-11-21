package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/GabrielHKGodinho/fullstack-calculator/backend/internal/calculator"
)

// The tests use literal codes and paths, not the package constants, so that a
// change to the API contract shows up as a failing test.

// apiCase is one request to the API handler and the response it must get.
type apiCase struct {
	name        string
	method      string
	path        string
	body        string
	contentType string

	wantStatus  int
	wantResult  float64 // checked when wantCode is ""
	wantCode    string
	wantMessage string // checked when not ""
	wantAllow   string
}

func TestHandler(t *testing.T) {
	runCases(t, []apiCase{
		// Success, one per operation.
		{name: "add", method: "POST", path: "/api/v1/add", body: `{"operands": [10, 2]}`, wantStatus: 200, wantResult: 12},
		{name: "subtract", method: "POST", path: "/api/v1/subtract", body: `{"operands": [10, 2]}`, wantStatus: 200, wantResult: 8},
		{name: "multiply", method: "POST", path: "/api/v1/multiply", body: `{"operands": [10, 2]}`, wantStatus: 200, wantResult: 20},
		{name: "divide", method: "POST", path: "/api/v1/divide", body: `{"operands": [10, 2]}`, wantStatus: 200, wantResult: 5},
		{name: "power", method: "POST", path: "/api/v1/power", body: `{"operands": [2, 10]}`, wantStatus: 200, wantResult: 1024},
		{name: "sqrt", method: "POST", path: "/api/v1/sqrt", body: `{"operands": [16]}`, wantStatus: 200, wantResult: 4},
		{name: "percentage", method: "POST", path: "/api/v1/percentage", body: `{"operands": [20, 50]}`, wantStatus: 200, wantResult: 10},
		{name: "full float64 is returned", method: "POST", path: "/api/v1/add", body: `{"operands": [0.1, 0.2]}`, wantStatus: 200, wantResult: 0.30000000000000004},
		{name: "negative result", method: "POST", path: "/api/v1/subtract", body: `{"operands": [2, 10]}`, wantStatus: 200, wantResult: -8},
		{name: "Content-Type is not enforced", method: "POST", path: "/api/v1/add", body: `{"operands": [1, 2]}`, contentType: "text/plain", wantStatus: 200, wantResult: 3},

		// 404 UNKNOWN_OPERATION
		{name: "unknown operation", method: "POST", path: "/api/v1/modulo", body: `{"operands": [1, 2]}`,
			wantStatus: 404, wantCode: "UNKNOWN_OPERATION", wantMessage: `unknown operation "modulo"`},
		{name: "unknown operation is checked before method", method: "GET", path: "/api/v1/modulo",
			wantStatus: 404, wantCode: "UNKNOWN_OPERATION"},
		{name: "operation names are case-sensitive", method: "POST", path: "/api/v1/ADD", body: `{"operands": [1, 2]}`,
			wantStatus: 404, wantCode: "UNKNOWN_OPERATION"},

		// 404 NOT_FOUND
		{name: "api root", method: "POST", path: "/api/", wantStatus: 404, wantCode: "NOT_FOUND"},
		{name: "unknown version", method: "POST", path: "/api/v2/add", body: `{"operands": [1, 2]}`, wantStatus: 404, wantCode: "NOT_FOUND"},
		{name: "extra path segment", method: "POST", path: "/api/v1/add/extra", body: `{"operands": [1, 2]}`, wantStatus: 404, wantCode: "NOT_FOUND"},
		{name: "empty operation", method: "POST", path: "/api/v1/", wantStatus: 404, wantCode: "NOT_FOUND"},

		// 405 METHOD_NOT_ALLOWED
		{name: "GET", method: "GET", path: "/api/v1/add",
			wantStatus: 405, wantCode: "METHOD_NOT_ALLOWED", wantMessage: "method GET not allowed, use POST", wantAllow: "POST"},
		{name: "PUT", method: "PUT", path: "/api/v1/add", body: `{"operands": [1, 2]}`, wantStatus: 405, wantCode: "METHOD_NOT_ALLOWED", wantAllow: "POST"},
		{name: "DELETE", method: "DELETE", path: "/api/v1/add", wantStatus: 405, wantCode: "METHOD_NOT_ALLOWED", wantAllow: "POST"},
		{name: "PATCH", method: "PATCH", path: "/api/v1/add", body: `{"operands": [1, 2]}`, wantStatus: 405, wantCode: "METHOD_NOT_ALLOWED", wantAllow: "POST"},

		// Body size and decoding errors are in request_test.go.

		// 400 MISSING_OPERANDS
		{name: "empty object", method: "POST", path: "/api/v1/add", body: `{}`,
			wantStatus: 400, wantCode: "MISSING_OPERANDS", wantMessage: `"operands" is required`},
		{name: "operands null", method: "POST", path: "/api/v1/add", body: `{"operands": null}`, wantStatus: 400, wantCode: "MISSING_OPERANDS"},
		{name: "body null", method: "POST", path: "/api/v1/add", body: `null`, wantStatus: 400, wantCode: "MISSING_OPERANDS"},

		// 400 NULL_OPERAND, and null is not 0
		{name: "null operand", method: "POST", path: "/api/v1/add", body: `{"operands": [1, null]}`,
			wantStatus: 400, wantCode: "NULL_OPERAND", wantMessage: "operands must not be null"},
		{name: "only operand null", method: "POST", path: "/api/v1/add", body: `{"operands": [null]}`, wantStatus: 400, wantCode: "NULL_OPERAND"},
		{name: "zero operands are not null", method: "POST", path: "/api/v1/add", body: `{"operands": [0, 0]}`, wantStatus: 200, wantResult: 0},

		// 400 WRONG_OPERAND_COUNT
		{name: "no operands", method: "POST", path: "/api/v1/add", body: `{"operands": []}`,
			wantStatus: 400, wantCode: "WRONG_OPERAND_COUNT", wantMessage: "add takes 2 operands, got 0"},
		{name: "too few operands", method: "POST", path: "/api/v1/add", body: `{"operands": [1]}`,
			wantStatus: 400, wantCode: "WRONG_OPERAND_COUNT", wantMessage: "add takes 2 operands, got 1"},
		{name: "too many operands", method: "POST", path: "/api/v1/add", body: `{"operands": [1, 2, 3]}`, wantStatus: 400, wantCode: "WRONG_OPERAND_COUNT"},
		{name: "sqrt with two operands", method: "POST", path: "/api/v1/sqrt", body: `{"operands": [1, 2]}`,
			wantStatus: 400, wantCode: "WRONG_OPERAND_COUNT", wantMessage: "sqrt takes 1 operand, got 2"},

		// 422
		{name: "division by zero", method: "POST", path: "/api/v1/divide", body: `{"operands": [1, 0]}`,
			wantStatus: 422, wantCode: "DIVISION_BY_ZERO", wantMessage: "cannot divide by zero"},
		{name: "division by negative zero", method: "POST", path: "/api/v1/divide", body: `{"operands": [1, -0]}`, wantStatus: 422, wantCode: "DIVISION_BY_ZERO"},
		{name: "sqrt of negative", method: "POST", path: "/api/v1/sqrt", body: `{"operands": [-1]}`,
			wantStatus: 422, wantCode: "SQRT_OF_NEGATIVE", wantMessage: "cannot take the square root of a negative number"},
		{name: "overflow", method: "POST", path: "/api/v1/multiply", body: `{"operands": [1e308, 10]}`,
			wantStatus: 422, wantCode: "RESULT_NOT_FINITE", wantMessage: "result is too large or undefined"},
		{name: "power to +Inf", method: "POST", path: "/api/v1/power", body: `{"operands": [0, -1]}`, wantStatus: 422, wantCode: "RESULT_NOT_FINITE"},
		{name: "power to NaN", method: "POST", path: "/api/v1/power", body: `{"operands": [-8, 0.5]}`, wantStatus: 422, wantCode: "RESULT_NOT_FINITE"},

		// The first failing check wins.
		{name: "method before body", method: "GET", path: "/api/v1/add", body: `{`, wantStatus: 405, wantCode: "METHOD_NOT_ALLOWED", wantAllow: "POST"},
		{name: "path before body", method: "POST", path: "/api/v1/modulo", body: `{`, wantStatus: 404, wantCode: "UNKNOWN_OPERATION"},
		{name: "method before body size", method: "PUT", path: "/api/v1/add", body: oversizedBody, wantStatus: 405, wantCode: "METHOD_NOT_ALLOWED", wantAllow: "POST"},
		{name: "unknown field before operands", method: "POST", path: "/api/v1/add", body: `{"operands": [1, null], "foo": 1}`, wantStatus: 400, wantCode: "UNKNOWN_FIELD"},
		{name: "null operand before count", method: "POST", path: "/api/v1/add", body: `{"operands": [null, 1, 2]}`, wantStatus: 400, wantCode: "NULL_OPERAND"},
		{name: "count before math", method: "POST", path: "/api/v1/divide", body: `{"operands": [1, 0, 0]}`, wantStatus: 400, wantCode: "WRONG_OPERAND_COUNT"},
	})
}

// runCases sends each case to a new API handler and checks the status, the
// Content-Type and Allow headers, and that the body is exactly a result or an
// error with the expected code.
func runCases(t *testing.T, cases []apiCase) {
	t.Helper()
	h := New(discardLogger())

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
			if tc.contentType != "" {
				req.Header.Set("Content-Type", tc.contentType)
			}
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)

			if rec.Code != tc.wantStatus {
				t.Errorf("status = %d, want %d (body %s)", rec.Code, tc.wantStatus, rec.Body)
			}
			if got := rec.Header().Get("Content-Type"); got != "application/json" {
				t.Errorf("Content-Type = %q, want %q", got, "application/json")
			}
			if got := rec.Header().Get("Allow"); got != tc.wantAllow {
				t.Errorf("Allow = %q, want %q", got, tc.wantAllow)
			}

			body := decodeBody(t, rec.Body)
			if tc.wantCode == "" {
				if body.Error != nil {
					t.Fatalf("got error %+v, want result %v", *body.Error, tc.wantResult)
				}
				if body.Result == nil || *body.Result != tc.wantResult {
					t.Errorf("result = %v, want %v", ptrString(body.Result), tc.wantResult)
				}
				return
			}
			if body.Result != nil {
				t.Fatalf("got result %v, want error %s", *body.Result, tc.wantCode)
			}
			if body.Error == nil {
				t.Fatalf("body has no error, want %s", tc.wantCode)
			}
			if body.Error.Code != tc.wantCode {
				t.Errorf("error.code = %q, want %q", body.Error.Code, tc.wantCode)
			}
			if body.Error.Message == "" {
				t.Error("error.message is empty")
			}
			if tc.wantMessage != "" && body.Error.Message != tc.wantMessage {
				t.Errorf("error.message = %q, want %q", body.Error.Message, tc.wantMessage)
			}
		})
	}
}

// An error that calculator is not expected to return is a bug: it must be
// logged and answered with a 500 that doesn't leak the error text.
func TestCalculatorErrorUnexpected(t *testing.T) {
	var logs bytes.Buffer
	h := handler{logger: slog.New(slog.NewTextHandler(&logs, nil))}
	op, err := calculator.Lookup("add")
	if err != nil {
		t.Fatal(err)
	}

	got := h.calculatorError(op, 2, errors.New("boom"))

	if got.status != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d", got.status, http.StatusInternalServerError)
	}
	if got.code != "INTERNAL_ERROR" {
		t.Errorf("code = %q, want %q", got.code, "INTERNAL_ERROR")
	}
	if strings.Contains(got.message, "boom") {
		t.Errorf("message %q leaks the internal error", got.message)
	}
	if !strings.Contains(logs.String(), "boom") {
		t.Errorf("log %q does not contain the error", logs.String())
	}
}

// testBody is the union of the success and error bodies. Decoding with
// DisallowUnknownFields makes sure nothing else is in the response.
type testBody struct {
	Result *float64   `json:"result"`
	Error  *errorBody `json:"error"`
}

func decodeBody(t *testing.T, r io.Reader) testBody {
	t.Helper()
	dec := json.NewDecoder(r)
	dec.DisallowUnknownFields()
	var b testBody
	if err := dec.Decode(&b); err != nil {
		t.Fatalf("response body is not the expected JSON: %v", err)
	}
	return b
}

func ptrString(p *float64) string {
	if p == nil {
		return "<missing>"
	}
	return fmt.Sprint(*p)
}

func discardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

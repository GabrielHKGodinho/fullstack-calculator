package httpapi

import (
	"strings"
	"testing"
)

// The body limit is 1 MB (1 << 20 bytes), written out here rather than taken
// from maxBodyBytes so the test pins the documented limit.
const testBodyLimit = 1 << 20

var (
	// exactLimitBody is a valid add [1, 2] body of exactly the limit.
	exactLimitBody = bodyOfSize(testBodyLimit)
	// oversizedBody is the same body, one byte over the limit.
	oversizedBody = bodyOfSize(testBodyLimit + 1)
	// oversizedTrailingWhitespace is a small valid object followed by
	// whitespace that takes the body past the limit.
	oversizedTrailingWhitespace = `{"operands": [1, 2]}` + strings.Repeat(" ", testBodyLimit)
)

// bodyOfSize returns a valid add [1, 2] body padded with spaces to n bytes.
func bodyOfSize(n int) string {
	const prefix, suffix = `{"operands": [`, `1, 2]}`
	return prefix + strings.Repeat(" ", n-len(prefix)-len(suffix)) + suffix
}

func TestDecodeRequest(t *testing.T) {
	cases := []apiCase{
		// Body size
		{name: "body of exactly 1MB", body: exactLimitBody, wantStatus: 200, wantResult: 3},
		{name: "body one byte over 1MB", body: oversizedBody,
			wantStatus: 413, wantCode: "BODY_TOO_LARGE", wantMessage: "request body must not exceed 1MB"},
		{name: "trailing whitespace over 1MB", body: oversizedTrailingWhitespace, wantStatus: 413, wantCode: "BODY_TOO_LARGE"},

		// 400 INVALID_JSON
		{name: "empty body", body: ``,
			wantStatus: 400, wantCode: "INVALID_JSON", wantMessage: "request body must be valid JSON"},
		{name: "truncated object", body: `{`, wantStatus: 400, wantCode: "INVALID_JSON"},
		{name: "not JSON", body: `not json`, wantStatus: 400, wantCode: "INVALID_JSON"},
		{name: "array instead of object", body: `[1, 2]`, wantStatus: 400, wantCode: "INVALID_JSON"},
		{name: "string instead of object", body: `"operands"`, wantStatus: 400, wantCode: "INVALID_JSON"},
		{name: "operands is a string", body: `{"operands": "1,2"}`, wantStatus: 400, wantCode: "INVALID_JSON"},
		{name: "operand is a string", body: `{"operands": ["1", 2]}`, wantStatus: 400, wantCode: "INVALID_JSON"},
		{name: "operand outside float64 range", body: `{"operands": [1e400, 1]}`, wantStatus: 400, wantCode: "INVALID_JSON"},
		{name: "trailing object", body: `{"operands": [1, 2]} {}`, wantStatus: 400, wantCode: "INVALID_JSON"},
		{name: "trailing object with unknown field", body: `{"operands": [1, 2]} {"foo": 1}`, wantStatus: 400, wantCode: "INVALID_JSON"},
		{name: "trailing garbage", body: `{"operands": [1, 2]}x`, wantStatus: 400, wantCode: "INVALID_JSON"},

		// Trailing whitespace is not trailing data.
		{name: "trailing newline", body: "{\"operands\": [1, 2]}\n", wantStatus: 200, wantResult: 3},
		{name: "trailing spaces and tabs", body: "{\"operands\": [1, 2]} \t \r\n", wantStatus: 200, wantResult: 3},

		// 400 UNKNOWN_FIELD
		{name: "unknown field after operands", body: `{"operands": [1, 2], "foo": 1}`,
			wantStatus: 400, wantCode: "UNKNOWN_FIELD", wantMessage: `unknown field "foo"`},
		{name: "unknown field before operands", body: `{"bar": true, "operands": [1, 2]}`,
			wantStatus: 400, wantCode: "UNKNOWN_FIELD", wantMessage: `unknown field "bar"`},

		// encoding/json behavior we keep on purpose (see README design notes):
		// keys match case-insensitively and the last duplicate key wins.
		{name: "key matching is case-insensitive", body: `{"Operands": [1, 2]}`, wantStatus: 200, wantResult: 3},
		{name: "last duplicate key wins", body: `{"operands": [1, 2], "operands": [3, 4]}`, wantStatus: 200, wantResult: 7},
	}

	for i := range cases {
		cases[i].method = "POST"
		cases[i].path = "/api/v1/add"
	}
	runCases(t, cases)
}

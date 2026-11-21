# Full-Stack Calculator — Specification

Status: approved for implementation. Anything not covered here gets asked
about before it is decided.

## 1. Overview

A calculator web app. The React + TypeScript frontend looks and behaves like a
pocket calculator; the Go backend is a small REST microservice that performs
every calculation. The frontend sends one request per operation and only
displays what the backend returns.

```
Browser ──(dev)── Vite dev server :5173 ──proxy /api──▶ Go :8080
Browser ──(docker)─────────────────────────────────▶ Go :8080 (API + static files)
```

## 2. Priorities

Within the 2–4 hour budget, build in this order and drop from the bottom if
time runs out:

1. Backend: `calculator` and `httpapi` with full validation and tests.
2. Frontend: button-driven calculator, API client, error handling,
   responsive layout, tests.
3. README (with plain commands), PROMPTS.md.
4. Coverage report, generated once right before submission.
5. Dockerfile.
6. **Lowest priority:** keyboard support (§4.3) and the Makefile (§5).

## 3. Repository layout

```
.
├── CLAUDE.md
├── SPEC.md
├── README.md               setup, running, API examples, design decisions
├── PROMPTS.md              prompts used while building (assignment deliverable)
├── Makefile                optional shortcuts (lowest priority)
├── Dockerfile
├── .dockerignore
├── docs/
│   └── coverage/           committed coverage reports (see §8)
├── backend/
│   ├── go.mod              module github.com/GabrielHKGodinho/fullstack-calculator/backend
│   ├── cmd/server/main.go  wiring: config, mux, http.Server
│   └── internal/
│       ├── calculator/     pure math + sentinel errors
│       └── httpapi/        handlers, request/response, error mapping
└── frontend/
    ├── package.json
    ├── vite.config.ts      dev proxy, Vitest config
    └── src/
        ├── api/            HTTP client for the backend
        ├── calculator/     pure state machine (reducer) + number formatting
        ├── components/     Display, Keypad, Button
        └── App.tsx
```

Exact file names inside packages are flexible.

## 4. Backend

### 4.1 Constraints

- Go standard library only (including tests). Go 1.22+ for `ServeMux`
  wildcard patterns; `go.mod` pins the installed version.
- Module path: `github.com/GabrielHKGodinho/fullstack-calculator/backend`.
- Listens on `:8080` by default; port overridable with the `PORT` env var.
- `http.Server` with explicit timeouts (read header, read, write, idle).
- Graceful shutdown on SIGINT/SIGTERM; `log/slog` for startup and unexpected
  errors only (no per-request access log).

### 4.2 Packages

**`internal/calculator`** — the math, no HTTP.

- Defines the seven operations, each with a name and an arity (1 or 2).
- Lets the caller look up an operation by name (unknown name →
  `ErrUnknownOperation`) and apply it to a `[]float64`.
- Returns sentinel errors, checkable with `errors.Is`:

  | Sentinel                 | When                                         |
  |--------------------------|----------------------------------------------|
  | `ErrUnknownOperation`    | name is not one of the seven operations      |
  | `ErrWrongOperandCount`   | `len(operands)` ≠ the operation's arity      |
  | `ErrDivisionByZero`      | divide with divisor `0` (incl. `-0`, `0/0`)  |
  | `ErrSqrtOfNegative`      | sqrt of a number `< 0`                       |
  | `ErrResultNotFinite`     | result is `±Inf` or `NaN`                    |

- Checks every result with `math.IsInf` / `math.IsNaN` so no non-finite value
  ever leaves the package (JSON can't encode them).

**`internal/httpapi`** — HTTP only.

- Routing, method check, body decoding and validation, calling `calculator`,
  mapping sentinel errors to status codes, writing JSON.
- Exposes a constructor that returns an `http.Handler`, so tests drive it
  with `httptest` without a real server.

**`cmd/server`** — reads config, builds the handler (plus the static file
handler when `STATIC_DIR` is set, see §7), starts the server.

### 4.3 Operations

Route: `POST /api/v1/{operation}`, body `{"operands": [...]}`.

| `{operation}` | Operands | Result                    | Operation-specific errors |
|---------------|----------|---------------------------|---------------------------|
| `add`         | `[a, b]` | `a + b`                   | —                         |
| `subtract`    | `[a, b]` | `a - b`                   | —                         |
| `multiply`    | `[a, b]` | `a × b`                   | —                         |
| `divide`      | `[a, b]` | `a ÷ b`                   | `DIVISION_BY_ZERO`        |
| `power`       | `[a, b]` | `a ^ b` (`math.Pow`)      | —                         |
| `sqrt`        | `[a]`    | `√a`                      | `SQRT_OF_NEGATIVE`        |
| `percentage`  | `[a, b]` | `a% of b` = `a × b / 100` | —                         |

Any operation can fail with `RESULT_NOT_FINITE`, e.g. `multiply [1e308, 10]`
(overflow), `power [0, -1]` (+Inf), `power [-8, 0.5]` (NaN).

### 4.4 Request handling

Checked in this order; the first failure wins.

1. **Path.** `/api/v1/{operation}` with an unknown name → 404
   `UNKNOWN_OPERATION`. Any other unmatched path under `/api/` → 404
   `NOT_FOUND`. This runs before the method check, so `GET /api/v1/foo` is 404.
2. **Method.** Anything other than `POST` on a known operation → 405
   `METHOD_NOT_ALLOWED` with an `Allow: POST` header. The handler checks the
   method itself (instead of a `POST ` mux pattern) so the 405 body is JSON.
3. **Body size.** `http.MaxBytesReader` with a 1 MB (1 << 20 bytes) limit.
   When decoding fails, `errors.As(err, &maxBytesErr)` with
   `var maxBytesErr *http.MaxBytesError` detects the limit → 413
   `BODY_TOO_LARGE`. This check runs before the other decode errors are
   classified.
4. **Decoding.** `json.Decoder` with `DisallowUnknownFields`.
   - Empty body, invalid syntax, wrong types (`"operands": "1,2"`,
     `["1", 2]`), numbers outside float64 range (`1e400`), or trailing data
     after the object → 400 `INVALID_JSON`.
   - Any field other than `operands` → 400 `UNKNOWN_FIELD`.
   - The request struct uses `Operands []*float64`, so a JSON `null` element
     stays distinguishable from `0`.
5. **Operands.**
   - `operands` missing or `null` → 400 `MISSING_OPERANDS`.
   - Any element `null` → 400 `NULL_OPERAND`.
   - Wrong count for the operation (including `[]`) → 400
     `WRONG_OPERAND_COUNT`.
6. **Math.** `calculator` errors → 422 (`DIVISION_BY_ZERO`,
   `SQRT_OF_NEGATIVE`, `RESULT_NOT_FINITE`).
7. **Success** → 200 `{"result": <number>}`.

Rule of thumb: **400** = the request is malformed; **413** = the body is over
1 MB; **422** = the request is well formed but has no finite real result;
**404/405** = wrong route/method.

`Content-Type` is not enforced (the body is parsed as JSON regardless), so
plain `curl -d` works without extra headers.

### 4.5 Responses

All responses are `Content-Type: application/json`.

Success:

```json
{ "result": 12 }
```

Error:

```json
{ "error": { "code": "DIVISION_BY_ZERO", "message": "cannot divide by zero" } }
```

| Status | `code`                | Example message (wording flexible)               |
|--------|-----------------------|--------------------------------------------------|
| 400    | `INVALID_JSON`        | request body must be valid JSON                 |
| 400    | `UNKNOWN_FIELD`       | unknown field "foo"                              |
| 400    | `MISSING_OPERANDS`    | "operands" is required                           |
| 400    | `NULL_OPERAND`        | operands must not be null                        |
| 400    | `WRONG_OPERAND_COUNT` | sqrt takes 1 operand, got 2                      |
| 404    | `UNKNOWN_OPERATION`   | unknown operation "modulo"                       |
| 404    | `NOT_FOUND`           | not found                                        |
| 405    | `METHOD_NOT_ALLOWED`  | method GET not allowed, use POST                 |
| 413    | `BODY_TOO_LARGE`      | request body must not exceed 1MB                 |
| 422    | `DIVISION_BY_ZERO`    | cannot divide by zero                            |
| 422    | `SQRT_OF_NEGATIVE`    | cannot take the square root of a negative number |
| 422    | `RESULT_NOT_FINITE`   | result is too large or undefined                 |
| 500    | `INTERNAL_ERROR`      | internal server error (should never happen)      |

Codes are the stable contract; messages are for humans and may change.

### 4.6 Examples

```bash
curl -s -X POST localhost:8080/api/v1/add -d '{"operands": [10, 2]}'
# 200 {"result":12}

curl -s -X POST localhost:8080/api/v1/percentage -d '{"operands": [20, 50]}'
# 200 {"result":10}

curl -s -X POST localhost:8080/api/v1/sqrt -d '{"operands": [16]}'
# 200 {"result":4}

curl -s -X POST localhost:8080/api/v1/divide -d '{"operands": [1, 0]}'
# 422 {"error":{"code":"DIVISION_BY_ZERO","message":"..."}}

curl -s -X POST localhost:8080/api/v1/add -d '{"operands": [1, null]}'
# 400 {"error":{"code":"NULL_OPERAND","message":"..."}}

curl -s localhost:8080/api/v1/add
# 405 {"error":{"code":"METHOD_NOT_ALLOWED","message":"..."}}
```

### 4.7 Backend tests

- `calculator`: table-driven tests per operation — normal values, negatives,
  decimals, `-0`, operand count errors, division by zero, sqrt of negative,
  overflow/NaN → `ErrResultNotFinite`, unknown operation.
- `httpapi`: table-driven `httptest` tests asserting status, `Content-Type`,
  and decoded JSON body for every row of the error table in §4.5, plus success
  for each operation, the `Allow` header on 405, the 1 MB limit (just under
  passes the size check, just over → 413), unknown fields, trailing data, and
  `null` vs `0`.
- `cmd/server` stays thin and is not a coverage target.

## 5. Frontend

### 5.1 Stack

- React + TypeScript, built with Vite.
- Plain CSS (no UI library). No state library — `useReducer` plus a small
  custom hook.
- Native `fetch` for HTTP.

### 5.2 Responsibilities

- **The frontend does no arithmetic and parses no expressions.** Every
  operation is a single request to the backend. Only one request is in flight
  at a time; input is ignored (and the keypad disabled) while it is pending.
- Building the entry string (digits, `.`, sign toggle, backspace) is input
  editing, not math. The entry is turned into a number with `Number()` only
  to send it.

### 5.3 Calculator behavior

Layout: a display (with a small secondary line showing the pending
`first operand + operator`, e.g. `20 +`) and a keypad:

```
 C    ⌫    %    ÷
 7    8    9    ×
 4    5    6    −
 1    2    3    +
 ±    0    .    =
 √    xʸ
```

(Exact arrangement is flexible; all buttons fit a 320 px wide screen.)

- **Binary operators** (`+ − × ÷ xʸ %`) — pocket-calculator chaining, left
  to right, no precedence. Pressing an operator while another is pending and
  a second operand has been entered sends the pending request first and uses
  its result as the new first operand. `2 + 3 × 4 =` → `(2 + 3) × 4` = `20`.
- Pressing an operator right after another operator (no new entry) just
  replaces the pending operator; no request.
- **`%`** is a binary operator: `20 % 50 =` → `10` (20% of 50).
- **`√`** acts immediately on the number on the display (one request with one
  operand). The result replaces the display and any pending operator is kept:
  `9 + √16 =` → `9 + 4` → `13`.
- **`=`** sends the pending operation. With nothing pending it does nothing.
  Repeated `=` does not repeat the last operation.
- After a result, typing a digit starts a new entry; pressing an operator uses
  the result as the first operand.
- **`C`** clears everything; **`⌫`** deletes the last character of the
  current entry (no effect on a result); **`±`** toggles the sign of the
  current entry/result.
- **Keyboard (lowest priority):** digits, `.`, `+ - * / ^ %`, `Enter`/`=`
  for equals, `Backspace`, `Escape` to clear. Keyboard and buttons dispatch
  the same actions, so adding it later doesn't touch the reducer.

### 5.4 Input validation

- At most one decimal point; no leading zeros (`007` → `7`, `.5` → `0.5`).
- Entry limited to **15 significant digits**, the most that always
  round-trips through float64 (16 doesn't always).
- Operators/equals/√ with an incomplete entry (e.g. just `-` or `.`) are
  ignored rather than sent.
- Backend validation stays authoritative; the frontend just avoids sending
  requests it knows are malformed.

### 5.5 Display formatting

- The API returns a full float64; the UI formats it **for display only** to
  ~12 significant digits, trimming trailing zeros, switching to exponent
  notation for very large/small magnitudes, and showing `-0` as `0`.
  `0.30000000000000004` displays as `0.3`.
- The unrounded value is kept in state and used as the operand for the next
  operation.

### 5.6 Error handling

- API error → the display shows the backend's `message` as-is, styled as an
  error; the calculator enters an error state where the next digit or `C`
  resets it.
- Network failure / non-JSON response → "Can't reach the calculator service".
- The display region is `aria-live="polite"` so results and errors are
  announced.

### 5.7 Responsive design and accessibility

- Keypad is a CSS grid that scales from 320 px phones to desktop; touch
  targets ≥ 44 px; display text shrinks for long numbers instead of
  overflowing.
- Symbol buttons have `aria-label`s (`×` → "multiply", `√` → "square root").
  Visible focus styles.

### 5.8 Structure

- `api/` — `calculate(operation, operands): Promise<number>`; throws a typed
  `ApiError { code, message, status }` (code `NETWORK_ERROR` for transport
  failures).
- `calculator/` — pure reducer (state + actions) describing the state
  machine in §5.3, plus `formatNumber`. A hook (`useCalculator`) runs the
  reducer, issues API calls for actions that need them, and dispatches the
  result or error.
- `components/` — presentational `Display`, `Keypad`, `Button`.

### 5.9 Dev server

`vite.config.ts` proxies `/api` → `http://localhost:8080`. The frontend
always calls relative URLs (`/api/v1/...`), so the same build works behind the
Go server in Docker.

### 5.10 Frontend tests

- Vitest + React Testing Library + `@testing-library/user-event`, jsdom.
- Reducer: chaining, operator replacement, √ with a pending operator, `=`
  with nothing pending, entry validation (incl. the 15-digit limit),
  backspace, sign toggle, error state.
- `formatNumber`: rounding, exponent notation, `-0`.
- API client (mocked `fetch`): success, each error shape, network failure.
- `App` integration (mocked client): click flows, error message shown,
  keypad disabled while a request is pending; keyboard flows once keyboard
  support exists.

## 6. Tooling

- Backend: `go test ./...`, `go vet ./...`, `gofmt`.
- Frontend: npm scripts `dev`, `build`, `test`, `coverage`, `lint`,
  `typecheck`. Linting with oxlint, as configured by the Vite React-TS
  template (react and typescript plugins, `react/rules-of-hooks` as an
  error).
- Root `Makefile` (**lowest priority**) with shortcuts such as `test`,
  `coverage`, `docker-build`, `docker-run`. It only wraps the plain commands;
  nothing requires `make`, because it isn't installed on Windows by default.

## 7. Docker

Single multi-stage `Dockerfile` at the repo root:

1. Node stage: `npm ci && npm run build` → `frontend/dist`.
2. Go stage: `CGO_ENABLED=0 go build` the server.
3. Minimal runtime image with the binary and the built frontend.

At runtime the Go server serves `/api/...` as usual and, when `STATIC_DIR` is
set, serves the built frontend from that directory for every other path
(stdlib `http.FileServer`). Same origin, so no CORS. Exposes `8080`.

```bash
docker build -t fullstack-calculator .
docker run --rm -p 8080:8080 fullstack-calculator
# open http://localhost:8080
```

## 8. Coverage report

- Generated **once, at the end, right before submission** — not on every
  change.
- `backend/coverage.out` stays git-ignored.
- Output goes to `docs/coverage/` and is committed; the README links to it:
  - `backend.html` (`go tool cover -html`) and `backend.txt`
    (`go tool cover -func`).
  - `frontend/` (Vitest `@vitest/coverage-v8` HTML report) and
    `frontend.txt` (text summary).
- The README lists the plain commands to regenerate it (and the Makefile
  target, if it exists).

## 9. Documentation deliverables

- **README.md:** what it is; prerequisites (Go, Node versions); how to run
  backend and frontend in dev; how to run tests and regenerate coverage;
  Docker usage; API reference with curl examples (from §4.5–4.6); design
  decisions and assumptions (package split, pointer operands, 400 vs 413 vs
  422, no math in the frontend, proxy instead of CORS, display rounding,
  15-digit entry limit). Every step is given as plain commands (`go`, `npm`,
  `docker`), with `make` shortcuts only as an optional extra.
- **PROMPTS.md:** the prompts used while building the project, as the
  assignment requires.

## 10. Out of scope

Expression parsing, operator precedence, memory keys, history persistence,
authentication, rate limiting, CORS, i18n, arbitrary-precision math.

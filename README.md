# Full-Stack Calculator

I built this with Claude Code. The prompts I used are in
[PROMPTS.md](PROMPTS.md).

A calculator web app with a **React + TypeScript** frontend that works like a
pocket calculator and a **Go** REST backend that does every calculation. The
frontend does no math. It sends one request per operation and shows what the
backend returns.

```
development:  browser ── Vite :5173 ── proxies /api ──▶ Go :8080
docker:       browser ─────────────────────────────────▶ Go :8080 (API + built frontend)
```

Operations: add, subtract, multiply, divide, power, square root and percentage.

## Prerequisites

- Go 1.25.5 or newer
- Node.js 22.13 or newer on 22, or Node.js 24, with npm. jsdom needs 22.13,
  and Vitest doesn't support Node 25.
- Docker (optional)

## Run in development

Start the backend and the frontend in two terminals.

```bash
cd backend
go run ./cmd/server
```

```bash
cd frontend
npm ci
npm run dev
```

Then open http://localhost:5173. Vite forwards `/api` to the Go server on
port 8080. The server also reads two optional environment variables: `PORT`
(default `8080`) and `STATIC_DIR` (a folder of built frontend files to serve).

## Run with Docker

```bash
docker build -t fullstack-calculator .
docker run --rm -p 8080:8080 fullstack-calculator
```

Then open http://localhost:8080. One Go process serves both the API and the
built frontend. If port 8080 is taken on your machine, use `-p 8081:8080` and
open port 8081.

## Tests

```bash
cd backend
go test ./...
go test -race ./...
go vet ./...
gofmt -l .
```

`gofmt -l .` prints nothing when the code is formatted.

```bash
cd frontend
npm test
npm run lint
npm run typecheck
npm run build
```

## Coverage

The committed report is in [`docs/coverage/`](docs/coverage/). The totals
were:

| Side | Report | Total |
|---|---|---|
| Backend | [backend.txt](docs/coverage/backend.txt), `backend.html` | 78.9% of statements. `calculator` and `httpapi` are at 100%; the gap is the server's start-up and shutdown code in `cmd/server`. |
| Frontend | [frontend.txt](docs/coverage/frontend.txt), `frontend/index.html` | 99.4% of statements, 96.3% of branches, 100% of lines and functions. |

GitHub shows the HTML files as source, so open them from a local clone. To
regenerate the report:

```bash
cd backend
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o ../docs/coverage/backend.html
go tool cover -func=coverage.out -o ../docs/coverage/backend.txt
```

```bash
cd frontend
npm run coverage -- --coverage.reportsDirectory=../docs/coverage/frontend
```

A plain `npm run coverage` writes to `frontend/coverage/` instead, which git
ignores.

## API

`POST /api/v1/{operation}` with a JSON body `{"operands": [...]}`.

| Operation | Operands | Result |
|---|---|---|
| `add`, `subtract`, `multiply`, `divide` | `[a, b]` | `a + b`, `a - b`, `a × b`, `a ÷ b` |
| `power` | `[a, b]` | `a` to the power `b` |
| `sqrt` | `[a]` | square root of `a` |
| `percentage` | `[a, b]` | `a`% of `b`, so `[20, 50]` gives `10` |

A success returns `200` and `{"result": <number>}`. An error returns
`{"error": {"code": "...", "message": "..."}}`. The `code` is the stable part;
the `message` is for people and may change.

| Status | Codes | Meaning |
|---|---|---|
| 400 | `INVALID_JSON`, `UNKNOWN_FIELD`, `MISSING_OPERANDS`, `NULL_OPERAND`, `WRONG_OPERAND_COUNT` | The request is malformed. |
| 404 | `UNKNOWN_OPERATION`, `NOT_FOUND` | Unknown operation or path under `/api/`. |
| 405 | `METHOD_NOT_ALLOWED` | Not a `POST`. The response has an `Allow: POST` header. |
| 413 | `BODY_TOO_LARGE` | The body is over 1 MB. |
| 422 | `DIVISION_BY_ZERO`, `SQRT_OF_NEGATIVE`, `RESULT_NOT_FINITE` | The request is valid but has no finite real result. |

Examples, with the backend running:

```bash
curl -s -X POST localhost:8080/api/v1/add -d '{"operands": [10, 2]}'
# 200 {"result":12}

curl -s -X POST localhost:8080/api/v1/percentage -d '{"operands": [20, 50]}'
# 200 {"result":10}

curl -s -X POST localhost:8080/api/v1/sqrt -d '{"operands": [16]}'
# 200 {"result":4}

curl -s -X POST localhost:8080/api/v1/divide -d '{"operands": [1, 0]}'
# 422 {"error":{"code":"DIVISION_BY_ZERO","message":"cannot divide by zero"}}

curl -s -X POST localhost:8080/api/v1/add -d '{"operands": [1, null]}'
# 400 {"error":{"code":"NULL_OPERAND","message":"operands must not be null"}}

curl -s -X POST localhost:8080/api/v1/sqrt -d '{"operands": [1, 2]}'
# 400 {"error":{"code":"WRONG_OPERAND_COUNT","message":"sqrt takes 1 operand, got 2"}}

curl -s localhost:8080/api/v1/add
# 405 {"error":{"code":"METHOD_NOT_ALLOWED","message":"method GET not allowed, use POST"}}
```

On Windows, run these in Git Bash or WSL. PowerShell and cmd quote JSON
differently.

## Design decisions

### Architecture

- **Go standard library only.** There are no dependencies to install or audit,
  and Go's `ServeMux` patterns, `encoding/json` and `testing` cover everything
  needed.
- **Two backend packages.** `calculator` does the math and returns sentinel
  errors; `httpapi` decodes and validates requests and maps those errors to
  status codes. The math is tested without HTTP, and every status code is
  decided in one place.
- **No math in the frontend.** Every operation is one request to the backend,
  and only one is in flight at a time. The backend is the single source of
  results, and answers can't arrive out of order.
- **A proxy instead of CORS.** In development Vite forwards `/api` to Go; in
  Docker one Go process serves the API and the frontend. The browser always
  sees one origin, so no CORS setup is needed.
- **One Docker image on distroless.** The final image is
  `distroless/static-debian13:nonroot`: only the server binary and the built
  frontend, with no shell or package manager, running as a non-root user. It is
  15 MB on disk.

### API

- **One route, `POST /api/v1/{operation}`.** All seven operations share one
  request shape, and the `v1` leaves room for changes.
- **The response is just `{"result": n}`.** The client already knows what it
  sent.
- **400 vs 413 vs 422.** 400 means the request is malformed, 413 that the
  body is over 1 MB, and 422 that the request is valid but the math has no
  finite real answer. A client can tell "fix your request" apart from "this
  has no answer".
- **413 is detected with `errors.As` on `*http.MaxBytesError`.** That is the
  error `http.MaxBytesReader` returns, so the check doesn't depend on message
  text.
- **Operands are `[]*float64`.** A JSON `null` stays different from `0`, so
  `[1, null]` is a 400 error instead of quietly becoming `1 + 0`.
- **Infinity and NaN become 422 `RESULT_NOT_FINITE`.** JSON can't encode them,
  so no non-finite value leaves the `calculator` package.
- **Unknown fields are rejected.** A typo like `"operand"` gets a clear
  `UNKNOWN_FIELD` instead of being ignored.
- **Key matching is case-insensitive, and the last duplicate key wins.** This
  is how Go's `encoding/json` works. Changing it would need custom decoding for
  little benefit, so a test pins the behavior instead.
- **Without `STATIC_DIR`, paths outside `/api/` get Go's plain-text 404.** The
  JSON error format covers the API only.
- **`cmd/server` has a small routing test.** It checks that `/api/` reaches
  the API and that `STATIC_DIR` serves the frontend, without opening a real
  port.

### Calculator behavior

- **Chaining works like a pocket calculator.** Operations run left to right
  with no precedence, so `2 + 3 × 4 =` gives `20`. Each step is a single
  request, and no expression parsing is needed.
- **`%` is a binary operator and `√` acts at once.** `20 % 50 =` gives `10`
  (20% of 50), and `√` replaces the number on the display, as on a pocket
  calculator. `9 + √16 =` gives `13`.
- **`=` or `√` right after an operator does nothing.** There is no second
  number yet, so nothing is sent and the display keeps waiting.
- **`±` with nothing typed starts `-0`.** The next digit gives `-5`, so
  `5 × ± 3 =` is `5 × -3`. An entry can never be a bare `-` or `.`, so nothing
  incomplete can be sent.
- **In the error state only a digit, `.` or `C` resets.** Every other key is
  ignored, so no operation runs on an error message. `.` starts a new entry
  just like a digit does.
- **Entries are limited to 15 significant digits.** That is the most that
  always survives the round trip through a float64; 16 digits sometimes
  don't.
- **Results are rounded for display only.** They show up to 12 significant
  digits, so `0.1 + 0.2` shows `0.3`. The next operation uses the exact value
  the backend returned.
- **Each request times out after 10 seconds** and shows "Can't reach the
  calculator service". Keys, including `C`, are ignored while a request is in
  flight, so without a timeout a backend that never answers would lock the
  keypad until a page reload.
- **The keypad is disabled with `aria-disabled`, not `disabled`.** Browsers
  take focus away from a button when it becomes disabled, so a keyboard user
  lost their place on every request. The keys stay focusable, screen readers
  still announce them as unavailable, and each button ignores presses itself.

### Tooling

- **Plain commands first.** Every step in this README is a `go`, `npm` or
  `docker` command, because `make` isn't installed on Windows by default.
- **oxlint instead of ESLint.** It is what the current Vite React + TypeScript
  template ships, with the react and typescript plugins and
  `react/rules-of-hooks` as an error. No extra packages are needed.
- **`@testing-library/jest-dom` for test assertions.** Matchers like
  `toHaveTextContent` and `toHaveFocus` make the component and App tests easier
  to read.
- **The coverage report is generated once and committed.** It is regenerated
  only right before submission, so it doesn't change with every commit.
  `backend/coverage.out` stays out of git.

## Assumptions and limitations

- Numbers are float64 on both sides; there is no arbitrary-precision math.
- `Content-Type` isn't enforced, so `curl -d` works without extra headers.
- Keyboard input and the Makefile were left out as the lowest priority.
- Out of scope: expression parsing, operator precedence, memory keys, history,
  authentication, rate limiting and internationalization.

## Project layout

```
backend/
  cmd/server/            starts the server (PORT, STATIC_DIR, graceful shutdown)
  internal/calculator/   the math and its sentinel errors
  internal/httpapi/      routing, request validation, JSON responses
frontend/src/
  api/                   HTTP client with typed errors and the timeout
  calculator/            reducer (state machine), entry editing, number formatting
  components/            Display, Keypad, Button
docs/coverage/           committed coverage report
SPEC.md                  full specification
PROMPTS.md               the prompts used to build this project
```

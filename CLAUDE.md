# CLAUDE.md

## What this repo is

A **take-home assessment for a job application**: a full-stack calculator with a
React + TypeScript frontend and a Go REST backend. Reviewers will read the code,
run the tests and follow the README, so clarity and correctness matter more than
features. The suggested time budget is 2–4 hours, so keep scope tight.

The full specification lives in [SPEC.md](SPEC.md). Treat it as the source of
truth; if code and spec disagree, ask before changing either.

## The assignment (summary)

- Operations: add, subtract, multiply, divide, plus the optional power, square
  root and percentage. All seven are in scope.
- Frontend (React, TypeScript): intuitive UI, input validation, error handling,
  basic mobile support. It consumes the backend API.
- Backend (REST, Go): endpoints for the operations, input validation, edge cases
  (division by zero, invalid data), JSON responses.
- Non-functional: clean, idiomatic code; unit tests for both layers; docs
  (setup, API usage, design rationale); optional Dockerfile.
- Deliverables: git repo, README (setup, how to run frontend and backend, API
  examples, design decisions/assumptions), unit tests + coverage report,
  Dockerfile, and the prompts used while building it.

## Ground rules for working here

- **Never commit, push, or create branches.** The author reviews and commits
  everything themselves. Leave changes in the working tree.
- **A task is only done when the tests pass and you show the output.** Run the
  relevant test suites (`go test ./...` and/or `npm test`) and include their
  output when reporting a task as finished. Failing or skipped tests mean the
  task is not done; say so plainly.
- **Ask before deciding.** If something isn't covered by SPEC.md, or the spec is
  ambiguous, ask instead of picking silently.
- **Everything in English:** code, identifiers, comments, docs, UI text, error
  messages and commit message suggestions.
- **Backend uses the Go standard library only.** No third-party modules, not even
  for tests.
- **The frontend does no math.** It never evaluates or parses expressions; every
  operation is one request to the backend, one at a time. Building the number
  being typed (digits, decimal point, sign) is input editing, not math.
- **No CORS.** In development the Vite dev server proxies `/api` to Go on
  `:8080`; in Docker one Go process serves both the API and the built frontend.
- **Tests come with the code.** Every change to behavior ships with tests on the
  layer it touches.
- **Don't regenerate the coverage report on every change.** The committed report
  in `docs/coverage/` is generated once, at the end, right before submission
  (when the author asks for it).
- Keep the two Go packages' responsibilities separate: `calculator` does the
  math and returns sentinel errors; `httpapi` owns HTTP (decoding, validation,
  status codes, JSON). `calculator` must not import `net/http`.
- Prefer small, readable code over clever code. No extra features beyond the
  spec without asking. Follow the priority order in SPEC.md: keyboard support
  and the Makefile come last.
- The README must give the plain commands (`go test ./...`, `npm run ...`,
  `docker build ...`) and not only `make` targets, since `make` isn't installed
  on Windows by default.

## Commands

To be filled in once the projects are scaffolded (see "Tooling" in SPEC.md).

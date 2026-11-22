# Prompts

Built with Claude Code (desktop app). I wrote the prompts, reviewed every diff and made every commit myself.

# 1
this repo is a take-home assessment for a job, the assignment is below. create a CLAUDE.md saying that and a SPEC.md with the specs of the project. dont write any code yet

[assignment text pasted here]

what i already decided:
backend in go, only standard library. the route is POST /api/v1/{operation} with a body like {"operands": [10, 2]}. all 7 operations, the optional ones too. sqrt gets 1 number, the others get 2. percentage [20, 50] means 20% of 50

errors are 400, 404, 405 or 422 depending on the case, with a json like {"error": {"code": "DIVISION_BY_ZERO", "message": "..."}}
use pointers for the operands so a null doesnt become 0. Inf and NaN cant go to json, return 422 for them. reject unknown fields and limit the body to 1MB

use two packages: calculator does the math and returns sentinel errors, httpapi handles the request and response and maps the errors to status codes

tests for both sides and commit the coverage report

frontend in react + typescript, a normal calculator with buttons. it doesnt do any math or parse expressions, every operation is a request to the backend, one at a time. no CORS, the vite dev server proxies /api to go on 8080

if something isnt clear or i didnt decide it, ask me before writing the files. dont commit anything, ill review and commit myself

# 2
all the assumptions are ok except two: module path should be github.com/GabrielHKGodinho/fullstack-calculator/backend, and the entry limit is 15 significant digits, 16 doesnt always round trip in float64

body too large is 413. detect it with errors.As on *http.MaxBytesError

keyboard support and the makefile are the lowest priority. the readme needs the plain commands too because make isnt on windows by default

in CLAUDE.md: a task is only done when the tests pass and you show me the output. and dont regenerate the coverage report on every change, only once at the end before i submit. also everything in english

update both files, still no code

# 3
read SPEC.md and CLAUDE.md and plan only the backend now

i want the plan to show the files you will create, the main types and function signatures of each package, how a request goes through httpapi following the order in the spec, and the list of test cases for each package

split it in small steps that i can review and commit one by one, like calculator with its tests first, then httpapi, then cmd/server

dont write any code yet

# 4
plan approved, just two small changes, run the tests with -race too, and rename mathError to calculatorError

do only step 1 now and stop so i can review and commit

# 5
do only step 2 now and stop so i can review and commit

# 6
o only step 3 now and stop so i can review and commit

# 7
do step 4 now. after the tests, run the server and curl the examples from SPEC 4.6, try PORT=9090 too, then stop it with ctrl c and show me the output. stop after that so i can review and commit

# 8
now plan only the frontend, same as the backend plan: the files you will create, the main types and function signatures, the reducer state and all its actions, how a button press goes to the api and back to the display, and the list of test cases for each part. split it in small steps that i can review and commit one by one. dont write any code yet

# 9
plan approved, do only step 1 now and stop so i can review and commit

# 10
do only step 1 now and stop so i can review and commit

# 11
do only step 2 now and stop so i can review and commit

# 12
do only step 3 now and stop so i can review and commit

# 13
do only step 4 now and stop so i can review and commit

# 14
do only step 5 now and stop so i can review and commit

# 15
do only step 6 now and stop so i can review and commit

# 16
now the dockerfile and .dockerignore from spec 7. use distroless nonroot for the final image. build it, run it and show me it works and the image size, then stop it so i can review and commit

# 17
now generate the coverage report from spec 8 for both sides into docs/coverage, and show me the summary. stop so i can review and commit

# 18
now the readme from spec 9, short and easy to read. in the design decisions put what i decided in the plans and today, with the reason for each. dont touch PROMPTS.md. stop so i can review
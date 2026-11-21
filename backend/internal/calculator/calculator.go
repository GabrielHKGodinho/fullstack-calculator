// Package calculator implements the calculator's operations. It knows nothing
// about HTTP: callers look up an operation by name, apply it to its operands
// and check the returned error against the sentinel errors below.
package calculator

import (
	"errors"
	"math"
)

// Sentinel errors returned by Lookup and Operation.Apply. Check them with
// errors.Is.
var (
	ErrUnknownOperation  = errors.New("unknown operation")
	ErrWrongOperandCount = errors.New("wrong number of operands")
	ErrDivisionByZero    = errors.New("division by zero")
	ErrSqrtOfNegative    = errors.New("square root of a negative number")
	ErrResultNotFinite   = errors.New("result is not finite")
)

// Operation is a named calculator operation that takes Arity operands.
// Values are obtained from Lookup; the zero value is not a valid operation.
type Operation struct {
	Name  string
	Arity int
	fn    func(x []float64) (float64, error)
}

var operations = map[string]Operation{
	"add":        {Name: "add", Arity: 2, fn: add},
	"subtract":   {Name: "subtract", Arity: 2, fn: subtract},
	"multiply":   {Name: "multiply", Arity: 2, fn: multiply},
	"divide":     {Name: "divide", Arity: 2, fn: divide},
	"power":      {Name: "power", Arity: 2, fn: power},
	"sqrt":       {Name: "sqrt", Arity: 1, fn: sqrt},
	"percentage": {Name: "percentage", Arity: 2, fn: percentage},
}

// Lookup returns the operation with the given name. Names are matched
// exactly (case-sensitive). An unknown name returns ErrUnknownOperation.
func Lookup(name string) (Operation, error) {
	op, ok := operations[name]
	if !ok {
		return Operation{}, ErrUnknownOperation
	}
	return op, nil
}

// Apply runs the operation on operands. It returns ErrWrongOperandCount if
// len(operands) is not the operation's arity, an operation-specific error
// (ErrDivisionByZero, ErrSqrtOfNegative), or ErrResultNotFinite if the
// result is ±Inf or NaN. A non-nil error always comes with a zero result.
func (op Operation) Apply(operands []float64) (float64, error) {
	if op.fn == nil {
		return 0, ErrUnknownOperation
	}
	if len(operands) != op.Arity {
		return 0, ErrWrongOperandCount
	}
	result, err := op.fn(operands)
	if err != nil {
		return 0, err
	}
	// JSON cannot encode ±Inf or NaN, so none may leave this package.
	if math.IsInf(result, 0) || math.IsNaN(result) {
		return 0, ErrResultNotFinite
	}
	return result, nil
}

func add(x []float64) (float64, error)      { return x[0] + x[1], nil }
func subtract(x []float64) (float64, error) { return x[0] - x[1], nil }
func multiply(x []float64) (float64, error) { return x[0] * x[1], nil }
func power(x []float64) (float64, error)    { return math.Pow(x[0], x[1]), nil }

func divide(x []float64) (float64, error) {
	// b == 0 is also true for -0, so 1/-0 and 0/0 are rejected here too.
	if x[1] == 0 {
		return 0, ErrDivisionByZero
	}
	return x[0] / x[1], nil
}

func sqrt(x []float64) (float64, error) {
	// -0 is not < 0, so sqrt(-0) = -0 is allowed, as in math.Sqrt.
	if x[0] < 0 {
		return 0, ErrSqrtOfNegative
	}
	return math.Sqrt(x[0]), nil
}

// percentage returns a% of b.
func percentage(x []float64) (float64, error) { return x[0] * x[1] / 100, nil }

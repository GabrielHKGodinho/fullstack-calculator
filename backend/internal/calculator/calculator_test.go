package calculator_test

import (
	"errors"
	"math"
	"testing"

	"github.com/GabrielHKGodinho/fullstack-calculator/backend/internal/calculator"
)

// negZero is -0. The Go constant -0 is plain 0, so it has to be built at run time.
var negZero = math.Copysign(0, -1)

func TestLookup(t *testing.T) {
	known := []struct {
		name  string
		arity int
	}{
		{"add", 2},
		{"subtract", 2},
		{"multiply", 2},
		{"divide", 2},
		{"power", 2},
		{"sqrt", 1},
		{"percentage", 2},
	}
	for _, tc := range known {
		t.Run(tc.name, func(t *testing.T) {
			op, err := calculator.Lookup(tc.name)
			if err != nil {
				t.Fatalf("Lookup(%q) error = %v, want nil", tc.name, err)
			}
			if op.Name != tc.name || op.Arity != tc.arity {
				t.Errorf("Lookup(%q) = {Name: %q, Arity: %d}, want {Name: %q, Arity: %d}",
					tc.name, op.Name, op.Arity, tc.name, tc.arity)
			}
		})
	}

	for _, name := range []string{"modulo", "", "ADD"} {
		t.Run("unknown "+name, func(t *testing.T) {
			if _, err := calculator.Lookup(name); !errors.Is(err, calculator.ErrUnknownOperation) {
				t.Errorf("Lookup(%q) error = %v, want %v", name, err, calculator.ErrUnknownOperation)
			}
		})
	}
}

func TestApply(t *testing.T) {
	maxF := math.MaxFloat64
	inf := math.Inf(1)
	nan := math.NaN()

	tests := []struct {
		name     string
		op       string
		operands []float64
		want     float64
		wantErr  error
	}{
		// add
		{"add positives", "add", []float64{2, 3}, 5, nil},
		{"add negatives", "add", []float64{-2, -3}, -5, nil},
		{"add decimals", "add", []float64{0.1, 0.2}, 0.30000000000000004, nil},
		{"add negative zeros", "add", []float64{negZero, negZero}, negZero, nil},
		{"add overflow", "add", []float64{maxF, maxF}, 0, calculator.ErrResultNotFinite},
		{"add infinite input", "add", []float64{inf, 1}, 0, calculator.ErrResultNotFinite},
		{"add NaN input", "add", []float64{nan, 1}, 0, calculator.ErrResultNotFinite},

		// subtract
		{"subtract positives", "subtract", []float64{10, 2}, 8, nil},
		{"subtract to negative", "subtract", []float64{2, 10}, -8, nil},
		{"subtract decimals", "subtract", []float64{0.3, 0.1}, 0.19999999999999998, nil},
		{"subtract overflow", "subtract", []float64{-maxF, maxF}, 0, calculator.ErrResultNotFinite},

		// multiply
		{"multiply positives", "multiply", []float64{3, 4}, 12, nil},
		{"multiply negative", "multiply", []float64{-3, 4}, -12, nil},
		{"multiply decimals", "multiply", []float64{0.5, 0.5}, 0.25, nil},
		{"multiply to negative zero", "multiply", []float64{-1, 0}, negZero, nil},
		{"multiply overflow", "multiply", []float64{1e308, 10}, 0, calculator.ErrResultNotFinite},

		// divide
		{"divide exact decimal", "divide", []float64{10, 4}, 2.5, nil},
		{"divide negative", "divide", []float64{-9, 3}, -3, nil},
		{"divide repeating", "divide", []float64{1, 3}, 1 / 3.0, nil},
		{"divide zero dividend", "divide", []float64{0, 5}, 0, nil},
		{"divide by zero", "divide", []float64{1, 0}, 0, calculator.ErrDivisionByZero},
		{"divide by negative zero", "divide", []float64{1, negZero}, 0, calculator.ErrDivisionByZero},
		{"divide zero by zero", "divide", []float64{0, 0}, 0, calculator.ErrDivisionByZero},
		{"divide negative by zero", "divide", []float64{-1, 0}, 0, calculator.ErrDivisionByZero},

		// power
		{"power integer", "power", []float64{2, 10}, 1024, nil},
		{"power negative exponent", "power", []float64{2, -1}, 0.5, nil},
		{"power negative base", "power", []float64{-2, 3}, -8, nil},
		{"power fractional exponent", "power", []float64{9, 0.5}, 3, nil},
		{"power zero to zero", "power", []float64{0, 0}, 1, nil},
		{"power zero to negative is +Inf", "power", []float64{0, -1}, 0, calculator.ErrResultNotFinite},
		{"power negative base fractional exponent is NaN", "power", []float64{-8, 0.5}, 0, calculator.ErrResultNotFinite},
		{"power overflow", "power", []float64{10, 400}, 0, calculator.ErrResultNotFinite},

		// sqrt
		{"sqrt perfect square", "sqrt", []float64{16}, 4, nil},
		{"sqrt irrational", "sqrt", []float64{2}, 1.4142135623730951, nil},
		{"sqrt zero", "sqrt", []float64{0}, 0, nil},
		{"sqrt negative zero", "sqrt", []float64{negZero}, negZero, nil},
		{"sqrt negative", "sqrt", []float64{-1}, 0, calculator.ErrSqrtOfNegative},
		{"sqrt small negative", "sqrt", []float64{-0.0001}, 0, calculator.ErrSqrtOfNegative},
		{"sqrt infinite input", "sqrt", []float64{inf}, 0, calculator.ErrResultNotFinite},
		{"sqrt NaN input", "sqrt", []float64{nan}, 0, calculator.ErrResultNotFinite},

		// percentage: a% of b
		{"percentage", "percentage", []float64{20, 50}, 10, nil},
		{"percentage swapped", "percentage", []float64{50, 20}, 10, nil},
		{"percentage negative", "percentage", []float64{-10, 200}, -20, nil},
		{"percentage decimal", "percentage", []float64{12.5, 8}, 1, nil},
		{"percentage overflow", "percentage", []float64{1e308, 1e308}, 0, calculator.ErrResultNotFinite},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			op := mustLookup(t, tc.op)
			got, err := op.Apply(tc.operands)

			if tc.wantErr != nil {
				if !errors.Is(err, tc.wantErr) {
					t.Fatalf("%s%v error = %v, want %v", tc.op, tc.operands, err, tc.wantErr)
				}
				if got != 0 {
					t.Errorf("%s%v result = %v on error, want 0", tc.op, tc.operands, got)
				}
				return
			}

			if err != nil {
				t.Fatalf("%s%v error = %v, want nil", tc.op, tc.operands, err)
			}
			// Signbit tells 0 and -0 apart, which == does not.
			if got != tc.want || math.Signbit(got) != math.Signbit(tc.want) {
				t.Errorf("%s%v = %v, want %v", tc.op, tc.operands, got, tc.want)
			}
		})
	}
}

func TestApplyWrongOperandCount(t *testing.T) {
	for _, name := range []string{"add", "subtract", "multiply", "divide", "power", "sqrt", "percentage"} {
		op := mustLookup(t, name)
		cases := map[string][]float64{
			"nil":          nil,
			"empty":        {},
			"one too few":  make([]float64, op.Arity-1),
			"one too many": make([]float64, op.Arity+1),
		}
		for caseName, operands := range cases {
			t.Run(name+" "+caseName, func(t *testing.T) {
				_, err := op.Apply(operands)
				if !errors.Is(err, calculator.ErrWrongOperandCount) {
					t.Errorf("%s with %d operands: error = %v, want %v",
						name, len(operands), err, calculator.ErrWrongOperandCount)
				}
			})
		}
	}
}

func TestApplyZeroValueOperation(t *testing.T) {
	var op calculator.Operation
	if _, err := op.Apply([]float64{1, 2}); !errors.Is(err, calculator.ErrUnknownOperation) {
		t.Errorf("Operation{}.Apply error = %v, want %v", err, calculator.ErrUnknownOperation)
	}
}

func mustLookup(t *testing.T, name string) calculator.Operation {
	t.Helper()
	op, err := calculator.Lookup(name)
	if err != nil {
		t.Fatalf("Lookup(%q) error = %v", name, err)
	}
	return op
}

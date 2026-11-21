/** Operations that take two operands. Values match the backend's route names. */
export type BinaryOperator =
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'power'
  | 'percentage'

/** Every backend operation: POST /api/v1/{operation}. */
export type Operation = BinaryOperator | 'sqrt'

export type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

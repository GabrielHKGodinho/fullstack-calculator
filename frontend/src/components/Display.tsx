import type { DisplayView } from '../calculator/reducer.ts'

// Longer text gets a smaller font so it shrinks instead of overflowing.
// The longest entry is 17 characters (15 digits, '-' and '.').
const SMALL_AFTER = 10
const TINY_AFTER = 16

export function Display({ main, secondary, isError }: DisplayView) {
  let mainClass = 'display__main'
  if (isError) {
    mainClass += ' display__main--error'
  }
  if (main.length > TINY_AFTER) {
    mainClass += ' display__main--tiny'
  } else if (main.length > SMALL_AFTER) {
    mainClass += ' display__main--small'
  }

  return (
    <div className="display" aria-live="polite">
      <div className="display__secondary">{secondary}</div>
      <div className={mainClass}>{main}</div>
    </div>
  )
}

import { useCalculator } from './calculator/useCalculator.ts'
import { Display } from './components/Display.tsx'
import { Keypad } from './components/Keypad.tsx'

function App() {
  const { display, busy, press } = useCalculator()

  return (
    <main className="app">
      <div className="calculator">
        <h1 className="calculator__title">Calculator</h1>
        <Display {...display} />
        <Keypad onPress={press} disabled={busy} />
      </div>
    </main>
  )
}

export default App

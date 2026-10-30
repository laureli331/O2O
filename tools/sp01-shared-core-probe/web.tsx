import { createRoot } from 'react-dom/client'
import { useCounter } from '@o2o/sp01-shared/react'
function Probe() {
  const counter = useCounter()
  return <main><p>{counter.label}</p><button id="probe-increment" onClick={counter.increment}>Increment</button>
    <button id="probe-reset" onClick={counter.reset}>Reset</button></main>
}
const root = document.getElementById('root')
if (!root) throw new Error('ROOT_MISSING')
createRoot(root).render(<Probe />)

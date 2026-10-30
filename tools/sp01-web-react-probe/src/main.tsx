// Adapted from create-vite 9.3.3's React TS entry. No business or network calls.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

const root = document.getElementById('root')
if (!root) throw new Error('SP01_ROOT_MISSING')
createRoot(root).render(
  <StrictMode>
    <p>SP01 React Web synthetic build probe</p>
  </StrictMode>,
)

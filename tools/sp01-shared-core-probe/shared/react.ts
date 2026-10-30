import { useReducer } from 'react'
import { reduceCounter } from './model'
export function useCounter() {
  const [state, dispatch] = useReducer(reduceCounter, { count: 0 })
  return { label: `Count ${state.count}`, increment: () => dispatch({ type: 'increment' }),
    reset: () => dispatch({ type: 'reset' }) }
}

import type { CounterState, CounterAction } from './contracts'
export function reduceCounter(state: CounterState, action: CounterAction): CounterState {
  if (!Number.isSafeInteger(state.count) || state.count < 0) throw new RangeError('INVALID_COUNT')
  if (action.type === 'reset') return { count: 0 }
  const count = state.count + 1
  if (!Number.isSafeInteger(count)) throw new RangeError('COUNT_OVERFLOW')
  return { count }
}

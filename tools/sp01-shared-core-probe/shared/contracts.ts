// Synthetic diagnostic contracts, not product APIs or business rules.
export interface CounterState { count: number }
export type CounterAction = { type: 'increment' } | { type: 'reset' }
export interface ProbeTransport { send(value: number): Promise<unknown> }

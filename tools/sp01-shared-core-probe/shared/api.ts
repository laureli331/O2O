import type { CounterState, ProbeTransport } from './contracts'
export async function readSynthetic(transport: ProbeTransport, input: number): Promise<CounterState> {
  if (!Number.isSafeInteger(input) || input < 0) throw new RangeError('INVALID_INPUT')
  const value = await transport.send(input)
  if (typeof value !== 'object' || value === null || !('count' in value)
      || typeof value.count !== 'number' || !Number.isSafeInteger(value.count) || value.count < 0) {
    throw new TypeError('INVALID_RESPONSE')
  }
  return { count: value.count }
}

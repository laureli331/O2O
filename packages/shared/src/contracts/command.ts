export const COMMAND_PROTOCOL_VERSION = 1 as const;

/**
 * Client-supplied command data. It never carries trusted identity or server time.
 * Every value must still be validated by the receiving server at runtime.
 */
export interface CommandEnvelope<TPayload = unknown, TOperation extends string = string> {
  readonly protocolVersion: typeof COMMAND_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly objectId: string;
  readonly operation: TOperation;
  readonly operationKey: string;
  readonly expectedVersion?: number;
  readonly payload: TPayload;
}

/**
 * Server-only facts supplied by authenticated identity and clock adapters.
 * This shape is a contract boundary, not an implementation of those adapters.
 */
export interface TrustedCommandContext {
  readonly actorId: string;
  readonly receivedAtEpochMs: number;
  readonly requestId: string;
}

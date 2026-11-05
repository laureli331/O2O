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

export type CommandEnvelopeField =
  | 'protocolVersion'
  | 'requestId'
  | 'objectId'
  | 'operation'
  | 'operationKey'
  | 'expectedVersion'
  | 'payload';

export type CommandEnvelopeValidationReason =
  | { readonly code: 'not-object' }
  | { readonly code: 'missing-field'; readonly field: CommandEnvelopeField }
  | { readonly code: 'unexpected-field'; readonly field: string }
  | { readonly code: 'unsupported-protocol-version' }
  | { readonly code: 'invalid-field-type'; readonly field: CommandEnvelopeField }
  | { readonly code: 'empty-field'; readonly field: 'requestId' | 'objectId' | 'operation' | 'operationKey' };

export type ParseCommandEnvelopeResult =
  | { readonly ok: true; readonly value: CommandEnvelope }
  | { readonly ok: false; readonly reason: CommandEnvelopeValidationReason };

const ALLOWED_COMMAND_ENVELOPE_FIELDS: ReadonlySet<string> = new Set([
  'protocolVersion',
  'requestId',
  'objectId',
  'operation',
  'operationKey',
  'expectedVersion',
  'payload',
]);

const REQUIRED_COMMAND_ENVELOPE_FIELDS: readonly CommandEnvelopeField[] = [
  'protocolVersion',
  'requestId',
  'objectId',
  'operation',
  'operationKey',
  'payload',
];

/**
 * Validate the generic command boundary without inventing module rules.
 * Owning modules still validate configured lengths, operation enums, payload/amount rules,
 * authorization, and current object versions on the server before executing a command.
 */
export function parseCommandEnvelope(input: unknown): ParseCommandEnvelopeResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, reason: { code: 'not-object' } };
  }

  const record = input as Record<string, unknown>;
  for (const field of Object.keys(record)) {
    if (!ALLOWED_COMMAND_ENVELOPE_FIELDS.has(field)) {
      return { ok: false, reason: { code: 'unexpected-field', field } };
    }
  }

  for (const field of REQUIRED_COMMAND_ENVELOPE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) {
      return { ok: false, reason: { code: 'missing-field', field } };
    }
  }

  if (record.protocolVersion !== COMMAND_PROTOCOL_VERSION) {
    return { ok: false, reason: { code: 'unsupported-protocol-version' } };
  }

  const requestId = record.requestId;
  if (typeof requestId !== 'string') {
    return { ok: false, reason: { code: 'invalid-field-type', field: 'requestId' } };
  }
  if (requestId.trim().length === 0) {
    return { ok: false, reason: { code: 'empty-field', field: 'requestId' } };
  }

  const objectId = record.objectId;
  if (typeof objectId !== 'string') {
    return { ok: false, reason: { code: 'invalid-field-type', field: 'objectId' } };
  }
  if (objectId.trim().length === 0) {
    return { ok: false, reason: { code: 'empty-field', field: 'objectId' } };
  }

  const operation = record.operation;
  if (typeof operation !== 'string') {
    return { ok: false, reason: { code: 'invalid-field-type', field: 'operation' } };
  }
  if (operation.trim().length === 0) {
    return { ok: false, reason: { code: 'empty-field', field: 'operation' } };
  }

  const operationKey = record.operationKey;
  if (typeof operationKey !== 'string') {
    return { ok: false, reason: { code: 'invalid-field-type', field: 'operationKey' } };
  }
  if (operationKey.trim().length === 0) {
    return { ok: false, reason: { code: 'empty-field', field: 'operationKey' } };
  }

  const hasExpectedVersion = Object.prototype.hasOwnProperty.call(record, 'expectedVersion');
  const expectedVersion = record.expectedVersion;
  if (hasExpectedVersion && (typeof expectedVersion !== 'number' || !Number.isFinite(expectedVersion))) {
    return { ok: false, reason: { code: 'invalid-field-type', field: 'expectedVersion' } };
  }

  if (record.payload === undefined) {
    return { ok: false, reason: { code: 'invalid-field-type', field: 'payload' } };
  }

  const value: CommandEnvelope = {
    protocolVersion: COMMAND_PROTOCOL_VERSION,
    requestId,
    objectId,
    operation,
    operationKey,
    ...(hasExpectedVersion ? { expectedVersion: expectedVersion as number } : {}),
    payload: record.payload,
  };

  return { ok: true, value };
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

/**
 * Minimal shape confirmed from @cloudbase/database@1.4.3 source for one-document add.
 * This adapter deliberately keeps the SDK out of the product dependency graph.
 */
export interface CloudBaseAddReceipt {
  documentId: string;
  requestId?: string;
}

export type CloudBaseAddMode = 'single' | 'transaction';

export class CloudBaseAddUnconfirmedError extends Error {
  readonly code = 'CLOUDBASE_ADD_UNCONFIRMED';

  constructor() {
    super('CloudBase add did not confirm a document insert');
    this.name = 'CloudBaseAddUnconfirmedError';
  }
}

/**
 * Validate the one-document receipt before a transaction callback can resolve.
 * CloudBase database 1.4.3 may return a truthy `code` result from add instead of
 * throwing; allowing that value to escape a transaction callback can lead its
 * wrapper to attempt commit. Never expose raw backend error details here.
 */
export function requireSingleDocumentAddReceipt(
  value: unknown,
  mode: CloudBaseAddMode = 'single',
): CloudBaseAddReceipt {
  if (!isRecord(value) || Boolean(value.code)) {
    throw new CloudBaseAddUnconfirmedError();
  }

  const documentId = value.id;
  if (typeof documentId !== 'string' || documentId.length === 0) {
    throw new CloudBaseAddUnconfirmedError();
  }

  const requestId = value.requestId;
  if (requestId !== undefined && (typeof requestId !== 'string' || requestId.length === 0)) {
    throw new CloudBaseAddUnconfirmedError();
  }

  if (mode === 'transaction' && (value.inserted !== 1 || value.ok !== 1)) {
    throw new CloudBaseAddUnconfirmedError();
  }

  return requestId === undefined ? { documentId } : { documentId, requestId };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

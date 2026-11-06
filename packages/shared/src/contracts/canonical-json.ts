export type CanonicalJsonSerializationReason =
  | 'unsupported-value'
  | 'non-finite-number'
  | 'cyclic-value'
  | 'non-plain-object'
  | 'accessor-property'
  | 'unsupported-property'
  | 'sparse-array'
  | 'inspection-failed';

export type CanonicalJsonSerializationResult =
  | { readonly ok: true; readonly json: string }
  | { readonly ok: false; readonly reason: CanonicalJsonSerializationReason };

class CanonicalJsonFailure extends Error {
  constructor(readonly reason: CanonicalJsonSerializationReason) {
    super(reason);
  }
}

function fail(reason: CanonicalJsonSerializationReason): never {
  throw new CanonicalJsonFailure(reason);
}

function stringifyPrimitive(value: string | number | boolean | null): string {
  const encoded = JSON.stringify(value);
  if (typeof encoded !== 'string') {
    return fail('unsupported-value');
  }
  return encoded;
}

function serializeArray(value: readonly unknown[], ancestors: Set<object>): string {
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key === 'symbol')) {
    return fail('unsupported-property');
  }

  const stringKeys = ownKeys as string[];
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  if (
    lengthDescriptor === undefined
    || !('value' in lengthDescriptor)
    || typeof lengthDescriptor.value !== 'number'
    || !Number.isSafeInteger(lengthDescriptor.value)
    || lengthDescriptor.value < 0
    || !stringKeys.includes('length')
  ) {
    return fail('unsupported-property');
  }

  const length = lengthDescriptor.value;
  const indexKeys = stringKeys.filter((key) => key !== 'length');
  const values = new Map<number, unknown>();
  for (const key of indexKeys) {
    const index = Number(key);
    if (!Number.isSafeInteger(index) || index < 0 || index >= length || String(index) !== key) {
      return fail('unsupported-property');
    }

    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable) {
      return fail('unsupported-property');
    }
    if (!('value' in descriptor)) {
      return fail('accessor-property');
    }
    values.set(index, descriptor.value);
  }
  if (values.size !== length) {
    return fail('sparse-array');
  }

  const encoded: string[] = [];
  for (let index = 0; index < length; index += 1) {
    if (!values.has(index)) {
      return fail('sparse-array');
    }
    encoded.push(serialize(values.get(index), ancestors));
  }

  return `[${encoded.join(',')}]`;
}

function serializeObject(value: object, ancestors: Set<object>): string {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return fail('non-plain-object');
  }

  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key === 'symbol')) {
    return fail('unsupported-property');
  }

  const entries: Array<readonly [string, unknown]> = [];
  for (const key of ownKeys as string[]) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable) {
      return fail('unsupported-property');
    }
    if (!('value' in descriptor)) {
      return fail('accessor-property');
    }
    entries.push([key, descriptor.value]);
  }

  entries.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  const encodedEntries = entries.map(([key, entryValue]) => {
    return `${stringifyPrimitive(key)}:${serialize(entryValue, ancestors)}`;
  });
  return `{${encodedEntries.join(',')}}`;
}

function serialize(value: unknown, ancestors: Set<object>): string {
  if (value === null) {
    return 'null';
  }

  switch (typeof value) {
    case 'string':
    case 'boolean':
      return stringifyPrimitive(value);
    case 'number':
      if (!Number.isFinite(value)) {
        return fail('non-finite-number');
      }
      // JSON has no distinct representation for negative zero, so it encodes as 0.
      return stringifyPrimitive(value);
    case 'object': {
      if (ancestors.has(value)) {
        return fail('cyclic-value');
      }

      ancestors.add(value);
      try {
        if (Array.isArray(value)) {
          if (Object.getPrototypeOf(value) !== Array.prototype) {
            return fail('non-plain-object');
          }
          return serializeArray(value, ancestors);
        }
        return serializeObject(value, ancestors);
      } finally {
        ancestors.delete(value);
      }
    }
    default:
      return fail('unsupported-value');
  }
}

/**
 * Deterministically serializes already validated JSON data for payload digests.
 * Object keys are ordered by JavaScript UTF-16 code-unit order; array order is preserved.
 * This function does not normalize business fields or decide payload equivalence.
 * Undefined values, accessors, sparse arrays, non-plain objects, cycles, and non-finite
 * numbers are rejected instead of being silently omitted or coerced by JSON.stringify.
 */
export function serializeCanonicalJson(value: unknown): CanonicalJsonSerializationResult {
  try {
    return { ok: true, json: serialize(value, new Set()) };
  } catch (error: unknown) {
    if (error instanceof CanonicalJsonFailure) {
      return { ok: false, reason: error.reason };
    }
    return { ok: false, reason: 'inspection-failed' };
  }
}

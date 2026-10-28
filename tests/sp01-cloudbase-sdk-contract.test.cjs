'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHandler, COLLECTION } = require('../miniprogram/cloudfunctions/sp01EnvProbe/handler');

function createCloudBaseV3187ContractMock() {
  const collections = new Map();
  const ensureCollection = (name) => {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  };
  const clone = (value) => value === undefined ? undefined : structuredClone(value);
  const invalidParam = () => {
    const error = new Error('CloudBase rejected non-finite numeric update data');
    error.code = 'INVALID_PARAM';
    return error;
  };
  const hasNonFiniteNumber = (value) => {
    if (typeof value === 'number') return !Number.isFinite(value);
    if (!value || typeof value !== 'object') return false;
    return Object.values(value).some(hasNonFiniteNumber);
  };

  function reference(id, docs) {
    return {
      async get() {
        return { data: clone(docs.get(id)) ?? null };
      },
      async set(fields) {
        if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw invalidParam();
        if (Object.hasOwn(fields, '_id')) throw invalidParam();
        docs.set(id, { _id: id, ...clone(fields) });
        return { updated: 1 };
      },
      async update(fields) {
        if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw invalidParam();
        if (Object.hasOwn(fields, '_id') || hasNonFiniteNumber(fields)) throw invalidParam();
        const current = docs.get(id);
        if (!current) return { updated: 0 };
        docs.set(id, { ...current, ...clone(fields) });
        return { updated: 1 };
      },
      async remove() {
        return { deleted: docs.delete(id) ? 1 : 0 };
      },
    };
  }

  function collection(name, docs = ensureCollection(name)) {
    return {
      doc(id) {
        return reference(id, docs);
      },
      where(condition) {
        return {
          async get() {
            const matches = [...docs.values()].filter((record) =>
              Object.entries(condition).every(([key, value]) => record[key] === value));
            return { data: clone(matches) };
          },
          async remove() {
            let deleted = 0;
            for (const [id, record] of docs) {
              if (Object.entries(condition).every(([key, value]) => record[key] === value)) {
                docs.delete(id);
                deleted += 1;
              }
            }
            return { deleted };
          },
        };
      },
    };
  }

  return {
    collections,
    async createCollection(name) {
      if (collections.has(name)) throw new Error(`collection already exists: ${name}`);
      collections.set(name, new Map());
      return { requestId: 'mock-create' };
    },
    collection,
    async runTransaction(callback) {
      const stored = ensureCollection(COLLECTION);
      const snapshot = new Map([...stored.entries()].map(([id, record]) => [id, clone(record)]));
      const result = await callback({ collection: (name) => collection(name, snapshot) });
      stored.clear();
      for (const [id, record] of snapshot) stored.set(id, record);
      return { result, errMsg: 'runTransaction:ok' };
    },
  };
}

test('probe uses the locked CloudBase 3.18.7 flat-field contract and leaves no run records in the local mock', async () => {
  const db = createCloudBaseV3187ContractMock();
  const handler = createHandler({ db, nodeVersion: 'v20.19.3', sdkVersion: '3.18.7' });
  const runId = 'sp01_' + 'b'.repeat(32);
  await handler({ action: 'prepare' });

  const result = await handler({ action: 'run', runId });

  assert.equal(result.commit.allDocumentsVisible, true);
  assert.equal(result.rollback.abortObserved, true);
  assert.equal(result.rollback.noPartialWrites, true);
  assert.deepEqual(result.concurrency.outcomes.map(({ status }) => status), ['fulfilled', 'fulfilled']);
  assert.equal(result.concurrency.stateConsistent, false, 'the local shape mock does not model CloudBase transaction isolation');
  assert.equal(result.success, false, 'a passing local payload-shape check must not be mistaken for cloud transaction acceptance');
  assert.equal(result.cleanup.success, true);
  assert.equal(result.cleanup.deletedCount, 3);
  assert.equal((await db.collection(COLLECTION).where({ sp01RunId: runId }).get()).data.length, 0);
  assert.equal(db.collections.has(COLLECTION), true);
});

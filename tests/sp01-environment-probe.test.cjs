'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHandler, COLLECTION, RUN_ID_PATTERN } = require('../miniprogram/cloudfunctions/sp01EnvProbe/handler');

function createMemoryDatabase({ transactionMode = 'snapshot', failOnQueryForIdAtCount = null, skipRemoveForId = null } = {}) {
  const collections = new Map();
  const queryCountsById = new Map();
  let injectedQueryFailureUsed = false;
  const ensureCollection = (name) => {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  };
  const clone = (value) => value === undefined ? undefined : structuredClone(value);

  function reference(name, id, docs) {
    return {
      async get() {
        return { data: clone(docs.get(id)) ?? null };
      },
      async set({ data }) {
        docs.set(id, { _id: id, ...clone(data) });
        return { _id: id };
      },
      async update({ data }) {
        const current = docs.get(id);
        if (!current) throw new Error(`missing document ${id}`);
        docs.set(id, { ...current, ...clone(data) });
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
        return reference(name, id, docs);
      },
      where(condition) {
        return {
          async get() {
            const matchingId = condition._id;
            const queryCount = (queryCountsById.get(matchingId) || 0) + 1;
            queryCountsById.set(matchingId, queryCount);
            if (!injectedQueryFailureUsed && failOnQueryForIdAtCount
                && matchingId === failOnQueryForIdAtCount.id
                && queryCount === failOnQueryForIdAtCount.count) {
              injectedQueryFailureUsed = true;
              throw new Error('mock query failure');
            }
            const found = [...docs.values()].filter((item) =>
              Object.entries(condition).every(([key, value]) => item[key] === value));
            return { data: clone(found) };
          },
          async remove() {
            let deleted = 0;
            for (const [id, item] of docs) {
              if (id !== skipRemoveForId
                  && Object.entries(condition).every(([key, value]) => item[key] === value)) {
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
      const original = ensureCollection(COLLECTION);
      const snapshot = new Map([...original.entries()].map(([id, value]) => [id, clone(value)]));
      const tx = { collection: (name) => collection(name, snapshot) };
      const value = await callback(tx);

      if (transactionMode === 'conflict-on-second-commit') {
        this.commitCount = (this.commitCount || 0) + 1;
        if (this.commitCount === 2) {
          const conflict = new Error('mock transaction conflict');
          conflict.code = 'MOCK_CONFLICT';
          throw conflict;
        }
      }

      original.clear();
      for (const [id, item] of snapshot) original.set(id, item);
      return { result: value, errMsg: 'runTransaction:ok' };
    },
  };
}

const runId = 'sp01_' + 'a'.repeat(32);

test('probe accepts only fixed actions and a synthetic run identifier', async () => {
  const handler = createHandler({ db: createMemoryDatabase(), nodeVersion: 'v20.19.0', sdkVersion: '3.18.7' });

  await assert.rejects(handler({ action: 'drop-database' }), /Unsupported SP01 probe action/);
  await assert.rejects(handler({ action: 'run', runId: 'user-data' }), /Invalid SP01 run identifier/);
  await assert.rejects(handler({ action: 'run', runId, collection: 'orders' }), /Unexpected event field/);
  await assert.rejects(handler({ action: 'inspect', extra: 'value' }), /Unexpected event field/);
});

test('runtime inspection reports only the Node and pinned SDK versions', async () => {
  const handler = createHandler({ db: createMemoryDatabase(), nodeVersion: 'v20.19.0', sdkVersion: '3.18.7' });

  assert.deepEqual(await handler({ action: 'inspect' }), {
    success: true,
    nodeVersion: 'v20.19.0',
    nodeRuntimeMatch: true,
    sdkVersion: '3.18.7',
  });
  assert.deepEqual(await createHandler({ db: createMemoryDatabase(), nodeVersion: 'v22.21.0', sdkVersion: '3.18.7' })({ action: 'inspect' }), {
    success: false,
    nodeVersion: 'v22.21.0',
    nodeRuntimeMatch: false,
    sdkVersion: '3.18.7',
  });
});

test('prepare creates only the fixed isolated probe collection and refuses reuse', async () => {
  const db = createMemoryDatabase();
  const handler = createHandler({ db, nodeVersion: 'v20.19.0', sdkVersion: '3.18.7' });

  assert.deepEqual(await handler({ action: 'prepare' }), {
    success: true,
    collection: COLLECTION,
    created: true,
  });
  assert.deepEqual([...db.collections.keys()], [COLLECTION]);
  await assert.rejects(handler({ action: 'prepare' }), /collection already exists/);
});

test('run verifies transaction commit, injected rollback, reports contention, and auto-cleans only this run', async () => {
  const db = createMemoryDatabase();
  const handler = createHandler({ db, nodeVersion: 'v20.19.0', sdkVersion: '3.18.7' });
  await handler({ action: 'prepare' });

  const result = await handler({ action: 'run', runId });

  assert.equal(result.runId, runId);
  assert.equal(result.commit.allDocumentsVisible, true);
  assert.equal(result.rollback.abortObserved, true);
  assert.equal(result.rollback.noPartialWrites, true);
  assert.equal(result.concurrency.overlapObserved, true);
  assert.equal(result.concurrency.startBarrierTimedOut, false);
  assert.deepEqual(result.concurrency.outcomes.map(({ status }) => status), ['fulfilled', 'fulfilled']);
  assert.equal(result.concurrency.stateConsistent, false, 'snapshot mock deliberately loses an update and must be detected');
  assert.equal(result.success, false, 'local mock is not evidence that the real environment passes');
  assert.equal(result.cleanup.success, true);
  assert.equal(result.cleanup.deletedCount, 3);
  assert.equal((await db.collection(COLLECTION).where({ sp01RunId: runId }).get()).data.length, 0);
  assert.equal(db.collections.has(COLLECTION), true, 'probe cleanup must preserve the empty collection');
});

test('run continues to cleanup owned documents after a verification phase throws', async () => {
  const db = createMemoryDatabase({ failOnQueryForIdAtCount: { id: `${runId}_commit_a`, count: 2 } });
  const handler = createHandler({ db, nodeVersion: 'v20.19.0', sdkVersion: '3.18.7' });
  await handler({ action: 'prepare' });

  const result = await handler({ action: 'run', runId });

  assert.equal(result.success, false);
  assert.deepEqual(result.failures.map(({ phase, name }) => ({ phase, name })), [
    { phase: 'commit', name: 'Error' },
  ]);
  assert.equal(result.rollback.abortObserved, true);
  assert.equal(result.cleanup.success, true);
  assert.equal(result.cleanup.deletedCount, 3);
  assert.equal((await db.collection(COLLECTION).where({ sp01RunId: runId }).get()).data.length, 0);
  assert.equal(db.collections.has(COLLECTION), true);
});

test('run does not mistake transactions started after the overlap timeout for concurrent work', async () => {
  const db = createMemoryDatabase();
  const runTransaction = db.runTransaction.bind(db);
  let callCount = 0;
  let releaseFirstConcurrentTransaction;
  const firstConcurrentTransactionFinished = new Promise((resolve) => {
    releaseFirstConcurrentTransaction = resolve;
  });
  db.runTransaction = async (callback) => {
    callCount += 1;
    const call = callCount;
    if (call === 4) await firstConcurrentTransactionFinished;
    try {
      return await runTransaction(callback);
    } finally {
      if (call === 3) releaseFirstConcurrentTransaction();
    }
  };

  const handler = createHandler({ db, nodeVersion: 'v20.19.0', sdkVersion: '3.18.7' });
  await handler({ action: 'prepare' });
  const result = await handler({ action: 'run', runId });

  assert.equal(result.concurrency.startBarrierTimedOut, true);
  assert.equal(result.concurrency.overlapObserved, false);
  assert.equal(result.concurrency.stateConsistent, true);
  assert.equal(result.success, false, 'sequential updates do not satisfy the concurrency probe');
  assert.equal(result.cleanup.success, true);
  assert.equal((await db.collection(COLLECTION).where({ sp01RunId: runId }).get()).data.length, 0);
});

test('run reports failure when cleanup response is insufficient and a run document remains', async () => {
  const remainingId = `${runId}_commit_a`;
  const db = createMemoryDatabase({ skipRemoveForId: remainingId });
  const handler = createHandler({ db, nodeVersion: 'v20.19.0', sdkVersion: '3.18.7' });
  await handler({ action: 'prepare' });

  const result = await handler({ action: 'run', runId });

  assert.equal(result.success, false);
  assert.equal(result.cleanup.success, false);
  assert.equal(result.cleanup.deletedCount, null);
  assert.deepEqual(result.failures.map(({ phase, name }) => ({ phase, name })), [
    { phase: 'cleanup', name: 'Error' },
  ]);
  assert.equal((await db.collection(COLLECTION).doc(remainingId).get()).data.sp01RunId, runId);
  assert.equal((await db.collection(COLLECTION).where({ sp01RunId: runId }).get()).data.length, 1);
});

test('run refuses to overwrite documents belonging to an earlier or different run', async () => {
  const db = createMemoryDatabase();
  const handler = createHandler({ db, nodeVersion: 'v20.19.0', sdkVersion: '3.18.7' });
  await handler({ action: 'prepare' });
  await db.collection(COLLECTION).doc(`${runId}_commit_a`).set({
    data: { sp01Probe: COLLECTION, sp01RunId: 'sp01_' + 'b'.repeat(32) },
  });

  await assert.rejects(handler({ action: 'run', runId }), /Probe document already exists/);
});

test('cleanup deletes only this run’s allowlisted documents and leaves the collection and unrelated data', async () => {
  const db = createMemoryDatabase();
  const handler = createHandler({ db, nodeVersion: 'v20.19.0', sdkVersion: '3.18.7' });
  await handler({ action: 'prepare' });
  await db.collection(COLLECTION).doc(`${runId}_commit_a`).set({
    data: { sp01Probe: COLLECTION, sp01RunId: runId },
  });
  await db.collection(COLLECTION).doc('unrelated').set({ data: { keep: true } });
  await db.collection(COLLECTION).doc(`${runId}_rollback_a`).set({
    data: { sp01Probe: COLLECTION, sp01RunId: 'sp01_' + 'b'.repeat(32) },
  });

  await assert.rejects(handler({ action: 'cleanup', runId }), /Refusing to clean non-owned probe document/);
  assert.equal((await db.collection(COLLECTION).doc(`${runId}_commit_a`).get()).data.sp01RunId, runId);
  assert.equal((await db.collection(COLLECTION).doc('unrelated').get()).data.keep, true);
  assert.equal((await db.collection(COLLECTION).doc(`${runId}_rollback_a`).get()).data.sp01RunId, 'sp01_' + 'b'.repeat(32));

  await db.collection(COLLECTION).doc(`${runId}_rollback_a`).remove();
  const cleaned = await handler({ action: 'cleanup', runId });
  assert.equal(cleaned.deletedCount, 1);
  assert.equal((await db.collection(COLLECTION).doc(`${runId}_commit_a`).get()).data, null);
  assert.equal((await db.collection(COLLECTION).doc('unrelated').get()).data.keep, true);
  assert.equal(db.collections.has(COLLECTION), true, 'cleanup must not delete collections');
});

test('run identifier contract is narrowly scoped to generated SP01 identifiers', () => {
  assert.equal(RUN_ID_PATTERN.test(runId), true);
  assert.equal(RUN_ID_PATTERN.test('sp01_' + 'A'.repeat(32)), false);
  assert.equal(RUN_ID_PATTERN.test('sp01_' + 'a'.repeat(31)), false);
});

test('SP01 progress distinguishes the deployed function from pending cloud acceptance', () => {
  const root = path.resolve(__dirname, '..');
  const plan = JSON.parse(fs.readFileSync(path.join(root, 'docs/v1-executable-development-plan-20261027.json'), 'utf8'));
  const task = plan.tasks.find((item) => item.id === 'SP01');
  const harness = task.executionProgress.localProbeHarness;
  const deployment = task.executionProgress.latestCloudDeployment;
  const runbook = fs.readFileSync(path.join(root, 'docs/sp01-cloud-probe-runbook-20261028.md'), 'utf8');

  assert.equal(task.status, 'in-progress');
  assert.equal(task.productAcceptancePassed, false);
  assert.equal(harness.functionName, 'sp01EnvProbe');
  assert.equal(harness.localTestCount, 11);
  assert.equal(harness.localTestsPassed, 11);
  assert.equal(harness.concurrencyBarrierTimeoutMs, 1500);
  assert.equal(harness.concurrencyRequiresOverlappingInitialReads, true);
  assert.equal(harness.sdkVersionRuntimeSource, 'require(@cloudbase/node-sdk/package.json).version');
  assert.equal(harness.cleanupPostDeleteReadback, true);
  assert.equal(harness.cleanupFailsWhenRunDocumentRemains, true);
  assert.equal(harness.cloudRuntimeExecuted, false);
  assert.equal(harness.cloudTransactionTestExecuted, false);
  assert.equal(harness.cloudFunctionDeployed, true);
  assert.equal(harness.cloudCollectionCreated, false);
  assert.equal(harness.cloudRecordsWrittenOrDeleted, false);
  assert.equal(harness.cloudWriteAndDeploymentAuthorization, 'granted-for-sp01EnvProbe-and-sp01_probe_20261028-synthetic-records-only');
  assert.equal(harness.collectionCleanup, 'records-only; retain-empty-collection');
  assert.equal(harness.storageRoleTestPrepared, false);
  assert.equal(deployment.cloudFunctionDeployed, true);
  assert.equal(deployment.targetAppId, 'wx2414399d423dfb65');
  assert.equal(deployment.targetEnvironmentId, 'cloud1-d2gjahlq39bf141c7');
  assert.deepEqual(deployment.postDeploymentFunctionNames, ['sp01EnvProbe']);
  assert.equal(deployment.postDeploymentCollectionCount, 0);
  assert.equal(deployment.cloudRuntimeExecuted, false);
  assert.equal(deployment.cloudRecordsWrittenOrDeleted, false);
  assert.match(runbook, /临时探针已部署；等待用户在开发者工具\/CloudBase 控制台执行云端测试/);
  assert.match(runbook, /sp01_f95243389fa9ca4f7a407c90ce2052ef/);
  assert.match(runbook, /不删除集合或任何非本轮记录/);
  assert.match(runbook, /删除后重新读取五个确切 ID/);
  assert.match(runbook, /测试云函数/);
});

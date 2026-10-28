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
      async set(fields) {
        docs.set(id, { _id: id, ...clone(fields) });
        return { _id: id };
      },
      async update(fields) {
        const current = docs.get(id);
        if (!current) throw new Error(`missing document ${id}`);
        docs.set(id, { ...current, ...clone(fields) });
        return { updated: 1 };
      },
      async remove() {
        if (id === skipRemoveForId) return { deleted: 0 };
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
  await assert.rejects(handler({ action: 'inspectRun', runId: 'user-data' }), /Invalid SP01 run identifier/);
  await assert.rejects(handler({ action: 'inspectRun', runId, extra: 'value' }), /Unexpected event field/);
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

test('inspectRun reads only the five allowlisted records and reports ownership without document contents', async () => {
  const db = createMemoryDatabase();
  const handler = createHandler({ db, nodeVersion: 'v20.19.0', sdkVersion: '3.18.7' });
  await handler({ action: 'prepare' });
  const firstId = `${runId}_commit_a`;
  const legacyId = `${runId}_rollback_a`;
  await db.collection(COLLECTION).doc(firstId).set({
    sp01Probe: COLLECTION, sp01RunId: runId, privateField: 'must not escape the probe',
  });
  await db.collection(COLLECTION).doc(legacyId).set({
    data: { sp01Probe: COLLECTION, sp01RunId: runId, marker: 'legacy' },
  });
  await db.collection(COLLECTION).doc('unrelated').set({ keep: true });
  const before = [...db.collections.get(COLLECTION).entries()].map(([id, record]) => [id, structuredClone(record)]);

  const result = await handler({ action: 'inspectRun', runId });

  assert.equal(result.success, true);
  assert.equal(result.safeToClean, true);
  assert.equal(result.presentCount, 2);
  assert.equal(result.documents.length, 5);
  assert.deepEqual(result.documents.find(({ id }) => id === firstId), {
    id: firstId, state: 'owned', format: 'flat',
  });
  assert.deepEqual(result.documents.find(({ id }) => id === legacyId), {
    id: legacyId, state: 'owned', format: 'legacy-nested',
  });
  assert.equal(JSON.stringify(result).includes('must not escape'), false);
  assert.deepEqual([...db.collections.get(COLLECTION).entries()], before, 'inspection must not mutate any record');
});

test('inspectRun blocks cleanup when any allowlisted ID is not owned by the requested run', async () => {
  const db = createMemoryDatabase();
  const handler = createHandler({ db, nodeVersion: 'v20.19.0', sdkVersion: '3.18.7' });
  await handler({ action: 'prepare' });
  const foreignId = `${runId}_commit_a`;
  await db.collection(COLLECTION).doc(foreignId).set({
    sp01Probe: COLLECTION, sp01RunId: `sp01_${'b'.repeat(32)}`,
  });

  const result = await handler({ action: 'inspectRun', runId });

  assert.equal(result.success, false);
  assert.equal(result.safeToClean, false);
  assert.equal(result.presentCount, 1);
  assert.deepEqual(result.documents[0], {
    id: foreignId, state: 'foreign-or-mismatched', format: 'invalid',
  });
  assert.equal((await db.collection(COLLECTION).doc(foreignId).get()).data.sp01RunId, `sp01_${'b'.repeat(32)}`);
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
    sp01Probe: COLLECTION, sp01RunId: 'sp01_' + 'b'.repeat(32),
  });

  await assert.rejects(handler({ action: 'run', runId }), /Probe document already exists/);
});

test('cleanup deletes only this run’s allowlisted documents and leaves the collection and unrelated data', async () => {
  const db = createMemoryDatabase();
  const handler = createHandler({ db, nodeVersion: 'v20.19.0', sdkVersion: '3.18.7' });
  await handler({ action: 'prepare' });
  await db.collection(COLLECTION).doc(`${runId}_commit_a`).set({
    sp01Probe: COLLECTION, sp01RunId: runId,
  });
  await db.collection(COLLECTION).doc('unrelated').set({ keep: true });
  await db.collection(COLLECTION).doc(`${runId}_rollback_a`).set({
    sp01Probe: COLLECTION, sp01RunId: 'sp01_' + 'b'.repeat(32),
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

test('cleanup safely recognizes and removes only this run’s legacy nested SDK-payload document', async () => {
  const db = createMemoryDatabase();
  const handler = createHandler({ db, nodeVersion: 'v20.19.0', sdkVersion: '3.18.7' });
  await handler({ action: 'prepare' });
  const legacyId = `${runId}_commit_a`;
  await db.collection(COLLECTION).doc(legacyId).set({
    data: { sp01Probe: COLLECTION, sp01RunId: runId, marker: 'legacy-nested-payload' },
  });
  await db.collection(COLLECTION).doc('unrelated').set({
    data: { sp01Probe: COLLECTION, sp01RunId: runId },
  });

  const cleaned = await handler({ action: 'cleanup', runId });

  assert.deepEqual(cleaned, {
    success: true,
    runId,
    collection: COLLECTION,
    deletedCount: 1,
  });
  assert.equal((await db.collection(COLLECTION).doc(legacyId).get()).data, null);
  assert.deepEqual((await db.collection(COLLECTION).doc('unrelated').get()).data.data, {
    sp01Probe: COLLECTION,
    sp01RunId: runId,
  });
  assert.equal(db.collections.has(COLLECTION), true);
});

test('run identifier contract is narrowly scoped to generated SP01 identifiers', () => {
  assert.equal(RUN_ID_PATTERN.test(runId), true);
  assert.equal(RUN_ID_PATTERN.test('sp01_' + 'A'.repeat(32)), false);
  assert.equal(RUN_ID_PATTERN.test('sp01_' + 'a'.repeat(31)), false);
});

test('SP01 progress distinguishes authorized recovery work from cloud acceptance', () => {
  const root = path.resolve(__dirname, '..');
  const plan = JSON.parse(fs.readFileSync(path.join(root, 'docs/v1-executable-development-plan-20261027.json'), 'utf8'));
  const task = plan.tasks.find((item) => item.id === 'SP01');
  const harness = task.executionProgress.localProbeHarness;
  const deployment = task.executionProgress.initialCloudDeployment;
  const previousDeploymentAttempt = task.executionProgress.previousCloudDeploymentAttempt;
  const latestUpload = task.executionProgress.latestCloudDeploymentEvidence;
  const runbook = fs.readFileSync(path.join(root, 'docs/sp01-cloud-probe-runbook-20261028.md'), 'utf8');

  assert.equal(task.status, 'in-progress');
  assert.equal(task.productAcceptancePassed, false);
  assert.match(harness.evidenceScope, /before-authorized-transaction-recovery/);
  assert.equal(harness.functionName, 'sp01EnvProbe');
  assert.equal(harness.localTestCount, 16);
  assert.equal(harness.localTestsPassed, 16);
  assert.deepEqual(harness.allowedActions, ['inspect', 'prepare', 'inspectRun', 'run', 'cleanup']);
  assert.equal(harness.concurrencyBarrierTimeoutMs, 1500);
  assert.equal(harness.concurrencyRequiresOverlappingInitialReads, true);
  assert.equal(harness.sdkVersionRuntimeSource, 'require(@cloudbase/node-sdk/package.json).version');
  assert.equal(harness.cleanupPostDeleteReadback, true);
  assert.equal(harness.cleanupFailsWhenRunDocumentRemains, true);
  assert.equal(harness.cloudRuntimeExecuted, true);
  assert.equal(harness.cloudTransactionTestExecuted, false);
  assert.equal(harness.cloudFunctionDeployed, true);
  assert.equal(harness.cloudCollectionCreated, true);
  assert.equal(harness.cloudRecordsWrittenOrDeleted, 'unknown-during-timeout; current-read-only-record-count-zero');
  assert.equal(harness.cloudWriteAndDeploymentAuthorization, 'granted-for-sp01EnvProbe-and-sp01_probe_20261028-synthetic-records-only');
  assert.equal(harness.collectionCleanup, 'records-only; retain-empty-collection');
  assert.equal(harness.storageRoleTestPrepared, false);
  assert.equal(deployment.cloudFunctionDeployed, true);
  assert.equal(deployment.targetAppId, 'wx2414399d423dfb65');
  assert.equal(deployment.targetEnvironmentId, 'cloud1-d2gjahlq39bf141c7');
  assert.deepEqual(deployment.postDeploymentFunctionNames, ['sp01EnvProbe']);
  assert.equal(deployment.cliPathRequirement, 'absolute-cloud-function-directory; directory-name-is-function-name; one-function-directory-per-deploy');
  assert.equal(deployment.expectedLocalFunctionDirectory, 'E:\\O2O\\miniprogram\\cloudfunctions\\sp01EnvProbe');
  assert.equal(deployment.historicalDeploymentPathCaptured, false);
  assert.equal(deployment.historicalPackageDigestCaptured, false);
  assert.equal(deployment.helloWorldRootCause, 'unknown-historical-deployment-artifact-not-inspectable-after-user-deletion');
  assert.equal(deployment.postDeploymentCollectionCount, 0);
  assert.equal(deployment.cloudRuntimeExecuted, false);
  assert.equal(deployment.cloudRecordsWrittenOrDeleted, false);
  assert.equal(previousDeploymentAttempt.functionName, 'sp01EnvProbe');
  assert.equal(previousDeploymentAttempt.taskResult.wrapperStatus, 'success');
  assert.equal(previousDeploymentAttempt.taskResult.codeUpdateStatus, 'failed');
  assert.equal(previousDeploymentAttempt.postDeploymentReadOnly.runtime, 'Nodejs16.13');
  assert.equal(previousDeploymentAttempt.functionTestInvoked, false);
  assert.equal(previousDeploymentAttempt.databaseWritePerformed, false);
  assert.equal(latestUpload.retry.deploymentStatus, 'success');
  assert.equal(latestUpload.retry.filesCount, 4);
  assert.equal(latestUpload.postDeploymentReadOnly.runtime, 'Nodejs20.19');
  assert.equal(latestUpload.inspectResultReceived, true);
  assert.deepEqual(latestUpload.inspectResult, { success: true, nodeVersion: 'v20.19.3', nodeRuntimeMatch: true, sdkVersion: '3.18.7' });
  assert.equal(latestUpload.prepareResultReceived, true);
  assert.deepEqual(latestUpload.prepareResult, { success: true, collection: 'sp01_probe_20261028', created: true });
  assert.equal(latestUpload.cloudCollectionCreated, true);
  assert.equal(latestUpload.cloudRuntimeExecutionVerified, true);
  const previousAttempt = task.executionProgress.previousUnmatchedCloudTestAttempt;
  assert.equal(previousAttempt.responseMatchedExpectedProbeContract, false);
  assert.equal(previousAttempt.probeExecutionVerified, false);
  const inspectAttempt = task.executionProgress.previousCloudTestAttempt;
  assert.deepEqual(inspectAttempt.event, { action: 'inspect' });
  assert.deepEqual(inspectAttempt.response, { success: true, nodeVersion: 'v20.19.3', nodeRuntimeMatch: true, sdkVersion: '3.18.7' });
  assert.equal(inspectAttempt.responseMatchedExpectedProbeContract, true);
  assert.equal(inspectAttempt.probeExecutionVerified, true);
  const attempt = task.executionProgress.prepareCloudTestAttempt;
  assert.deepEqual(attempt.event, { action: 'prepare' });
  assert.deepEqual(attempt.response, { success: true, collection: 'sp01_probe_20261028', created: true });
  assert.equal(attempt.responseMatchedExpectedProbeContract, true);
  assert.equal(attempt.probeExecutionVerified, true);
  assert.equal(attempt.transactionAcceptancePassed, false);
  assert.equal(attempt.transactionAcceptancePassed, false);
  assert.equal(attempt.databaseWritePerformed, true);
  const runAttempt = task.executionProgress.previousFailedCloudRunAttempt;
  assert.deepEqual(runAttempt.event, { action: 'run', runId: 'sp01_f892f63b9fdc4c11ae1254800a9e83cf' });
  assert.equal(runAttempt.functionTimeoutSeconds, 30);
  assert.equal(runAttempt.response.success, false);
  assert.equal(runAttempt.response.commit.allDocumentsVisible, false);
  assert.deepEqual(runAttempt.response.rollback, { abortObserved: true, noPartialWrites: true });
  assert.deepEqual(runAttempt.response.concurrency.outcomes.map((item) => item.reasonCode), ['INVALID_PARAM', 'INVALID_PARAM']);
  assert.equal(runAttempt.response.cleanup.success, false);
  assert.equal(runAttempt.transactionAcceptancePassed, false);
  assert.equal(runAttempt.cleanupVerified, false);
  assert.equal(runAttempt.recordStateAfterFailedCleanup, 'unknown; no post-run read-only record query');
  const recovery = task.executionProgress.authorizedRecovery;
  assert.equal(recovery.authorization, 'granted-for-target-sp01EnvProbe-fixed-collection-owned-record-cleanup-and-one-new-synthetic-run');
  assert.deepEqual(recovery.readOnlyEnvironmentList, ['cloud1-d2gjahlq39bf141c7']);
  assert.deepEqual(recovery.readOnlyFunctionList, ['sp01EnvProbe']);
  assert.deepEqual(recovery.functionInfo, { status: 'Active', runtime: 'Nodejs20.19', timeoutSeconds: 30 });
  assert.equal(recovery.inspectRunAction.implementedLocally, true);
  assert.equal(recovery.inspectRunAction.readOnly, true);
  assert.equal(recovery.inspectRunAction.returnsDocumentContents, false);
  assert.equal(recovery.correctedFunctionDeployment.success, true);
  assert.equal(recovery.correctedFunctionDeployment.uploadedFiles, 4);
  assert.equal(recovery.correctedFunctionDeployment.remoteNpmInstall, true);
  assert.deepEqual(recovery.correctedFunctionDeployment.postDeploymentFunctionNames, ['sp01EnvProbe']);
  assert.deepEqual(recovery.correctedFunctionDeployment.postDeploymentInfo, {
    status: 'Active', runtime: 'Nodejs20.19', timeoutSeconds: 30,
  });
  assert.equal(recovery.correctedFunctionDeployed, true);
  assert.equal(recovery.legacyRecordsInspected, true);
  assert.equal(recovery.legacyRecordsInspectionResult.safeToClean, true);
  assert.equal(recovery.legacyRecordsInspectionResult.presentCount, 3);
  assert.deepEqual(recovery.legacyRecordsInspectionResult.documents.map(({ id, state, format }) => ({ id, state, format })), [
    { id: `${recovery.legacyRunId}_commit_a`, state: 'owned', format: 'legacy-nested' },
    { id: `${recovery.legacyRunId}_commit_b`, state: 'owned', format: 'legacy-nested' },
    { id: `${recovery.legacyRunId}_rollback_a`, state: 'missing', format: undefined },
    { id: `${recovery.legacyRunId}_rollback_b`, state: 'missing', format: undefined },
    { id: `${recovery.legacyRunId}_concurrency`, state: 'owned', format: 'legacy-nested' },
  ]);
  assert.equal(recovery.legacyRecordsCleaned, true);
  assert.deepEqual(recovery.legacyCleanupResult, {
    success: true,
    runId: recovery.legacyRunId,
    collection: 'sp01_probe_20261028',
    deletedCount: 3,
    postDeleteVerification: 'handler-reported-success-means-all-five-fixed-ids-absent',
    collectionRetained: true,
  });
  assert.equal(recovery.newRunId, 'sp01_3db660bc5eb548559f4f6966a34209a2');
  assert.equal(recovery.newRunExecuted, true);
  assert.deepEqual(recovery.newRunResponse, {
    success: true,
    runId: recovery.newRunId,
    collection: 'sp01_probe_20261028',
    commit: { allDocumentsVisible: true },
    rollback: { abortObserved: true, noPartialWrites: true },
    concurrency: {
      overlapObserved: true,
      startBarrierTimedOut: false,
      outcomes: [{ status: 'fulfilled' }, { status: 'fulfilled' }],
      finalValue: 2,
      successfulTransactions: 2,
      stateConsistent: true,
      resultRequiresReview: false,
    },
    cleanup: {
      success: true,
      runId: recovery.newRunId,
      collection: 'sp01_probe_20261028',
      deletedCount: 3,
    },
    failures: [],
  });
  assert.equal(recovery.newRunResponseMatchedExpectedProbeContract, true);
  assert.equal(recovery.newRunCleanupVerified, true);
  assert.equal(recovery.cloudTransactionAcceptancePassed, true);
  assert.equal(recovery.temporaryFunctionRemovalStatus, 'not-confirmed-after-latest-run');
  assert.equal(task.status, 'in-progress');
  assert.equal(task.productAcceptancePassed, false);
  assert.equal(task.executionProgress.previousCloudRunAttemptAtThreeSeconds.event.runId, 'sp01_f4157fdc182bda6f9fd8e37395d4943e');
  assert.equal(task.executionProgress.latestLocalSdkCompatibilityDiagnosis.fixUploadedToCloud, true);
  assert.equal(task.executionProgress.latestLocalSdkCompatibilityDiagnosis.cloudProbeAfterFixPassed, true);
  assert.equal(previousAttempt.postAttemptCollectionState, 'not-present-on-read-only-recheck');
  assert.equal(previousAttempt.postAttemptCollectionCount, 0);
  assert.equal(previousAttempt.postAttemptCollectionRequestId, 'cf8e9a09-ac8a-4d7a-8359-43886e31874c');
  assert.equal(previousAttempt.userDeletedFunction, true);
  assert.deepEqual(previousAttempt.functionNamesAfterDeletion, []);
  assert.equal(task.executionProgress.previousPostProbeReadOnlyDatabaseCheck.collectionCount, 0);
  assert.equal(task.executionProgress.previousPostProbeReadOnlyDatabaseCheck.requestId, 'cf8e9a09-ac8a-4d7a-8359-43886e31874c');
  assert.equal(task.executionProgress.previousPostProbeReadOnlyDatabaseCheck.provesFunctionDidNotTransientlyCreateCollectionDuringAttempt, false);
  assert.match(runbook, /只读核对：环境列表仅含目标EnvID，函数列表仅含`sp01EnvProbe`；函数状态`Active`、运行时`Nodejs20.19`、超时30秒/);
  assert.match(runbook, /`inspectRun`只读事件/);
  assert.match(runbook, /安装目录CLI只读详情确认当前配置为30秒/);
  assert.match(runbook, /最新 run（30秒配置）/);
  assert.match(runbook, /最新云端事务探针已通过/);
  assert.match(runbook, /全部断言/);
  assert.match(runbook, /inspect.*结构化响应通过/);
  assert.match(runbook, /定向清理返回值/);
  assert.match(runbook, /最新run结束后的删除状态尚未由用户确认/);
  assert.match(runbook, /sp01_3db660bc5eb548559f4f6966a34209a2/);
  assert.ok(runbook.includes('prepare') && runbook.includes('固定集合`sp01_probe_20261028`已创建'));
  assert.match(runbook, /sp01_f892f63b9fdc4c11ae1254800a9e83cf/);
  assert.match(runbook, /两个并发事务均以 `INVALID_PARAM` 拒绝/);
  assert.match(runbook, /本地SDK接口形状契约模拟测试复现并修复/);
  assert.match(runbook, /历史失败没有逐变量云端对照/);
  assert.match(runbook, /当时的记录状态未知/);
  assert.match(runbook, /删除后的只读查询返回数据库集合列表为空/);
  assert.ok(runbook.includes('固定集合`sp01_probe_20261028`已创建'));
  assert.match(runbook, /临时授权凭据字段和值/);
  assert.doesNotMatch(runbook, /TENCENTCLOUD_SECRETKEY\s*[:=]\s*[^`\s]+/);
  assert.match(runbook, /sp01_f95243389fa9ca4f7a407c90ce2052ef/);
  assert.match(runbook, /不删除集合或任何非本轮记录/);
  assert.match(runbook, /删除后重新读取五个确切 ID/);
  assert.match(runbook, /--path` 必须是函数目录的绝对路径/);
  assert.match(runbook, /现存证据没有保留历史部署调用的完整--path参数或上传包内容摘要/);
  assert.match(runbook, /测试云函数/);
});

test('probe source never logs runtime context or reads credential environment variables', () => {
  const root = path.resolve(__dirname, '..');
  const source = ['index.js', 'handler.js'].map((name) =>
    fs.readFileSync(path.join(root, 'miniprogram/cloudfunctions/sp01EnvProbe', name), 'utf8')).join('\n');
  assert.doesNotMatch(source, /console\s*\.\s*(?:log|info|debug|dir)\s*\(/);
  assert.doesNotMatch(source, /TENCENTCLOUD_(?:SECRETID|SECRETKEY|SESSIONTOKEN)/);
});

test('probe deployment package points to the handler entry and pinned CloudBase SDK', () => {
  const root = path.resolve(__dirname, '..');
  const functionDir = path.join(root, 'miniprogram/cloudfunctions/sp01EnvProbe');
  const packageJson = JSON.parse(fs.readFileSync(path.join(functionDir, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(functionDir, 'package-lock.json'), 'utf8'));
  const entry = fs.readFileSync(path.join(functionDir, packageJson.main), 'utf8');
  const handler = fs.readFileSync(path.join(functionDir, 'handler.js'), 'utf8');

  assert.equal(path.basename(functionDir), 'sp01EnvProbe');
  assert.equal(packageJson.main, 'index.js');
  assert.equal(packageJson.dependencies['@cloudbase/node-sdk'], '3.18.7');
  assert.equal(lock.name, packageJson.name);
  assert.equal(lock.version, packageJson.version);
  assert.equal(lock.packages[''].dependencies['@cloudbase/node-sdk'], '3.18.7');
  assert.equal(lock.packages['node_modules/@cloudbase/node-sdk'].version, '3.18.7');
  assert.match(entry, /exports\.main\s*=/);
  assert.match(entry, /require\(['"]\.\/handler['"]\)/);
  assert.doesNotMatch(`${entry}\n${handler}`, /Hello\s+World/i);
  assert.doesNotMatch(handler, /\.set\(\{\s*data\s*:/);
  assert.doesNotMatch(handler, /\.update\(\{\s*data\s*:/);
});

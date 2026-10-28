'use strict';

const COLLECTION = 'sp01_probe_20261028';
const RUN_ID_PATTERN = /^sp01_[0-9a-f]{32}$/;
const DOCUMENT_SUFFIXES = ['commit_a', 'commit_b', 'rollback_a', 'rollback_b', 'concurrency'];
const ABORT_SENTINEL = 'SP01_INJECTED_ABORT';

function assertEvent(event, allowedKeys) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw new Error('Invalid SP01 probe event');
  }
  for (const key of Object.keys(event)) {
    if (!allowedKeys.includes(key)) throw new Error(`Unexpected event field: ${key}`);
  }
}

function assertRunId(runId) {
  if (typeof runId !== 'string' || !RUN_ID_PATTERN.test(runId)) {
    throw new Error('Invalid SP01 run identifier');
  }
}

function documentId(runId, suffix) {
  return `${runId}_${suffix}`;
}

function queryForRunDocument(db, id) {
  return db.collection(COLLECTION).where({ _id: id }).get();
}

function isOwnedByRun(data, runId) {
  const fields = data?.sp01Probe === COLLECTION && data?.sp01RunId === runId
    ? data
    : data?.data;
  return fields?.sp01Probe === COLLECTION && fields?.sp01RunId === runId;
}

async function assertRunIsUnused(db, runId) {
  for (const suffix of DOCUMENT_SUFFIXES) {
    const id = documentId(runId, suffix);
    const result = await queryForRunDocument(db, id);
    if (result.data?.length) throw new Error(`Probe document already exists: ${id}`);
  }
}

async function checkCommit(db, runId) {
  const firstId = documentId(runId, 'commit_a');
  const secondId = documentId(runId, 'commit_b');

  await db.runTransaction(async (transaction) => {
    await transaction.collection(COLLECTION).doc(firstId).set({
      sp01Probe: COLLECTION, sp01RunId: runId, marker: 'commit-a',
    });
    await transaction.collection(COLLECTION).doc(secondId).set({
      sp01Probe: COLLECTION, sp01RunId: runId, marker: 'commit-b',
    });
  });

  const [first, second] = await Promise.all([
    queryForRunDocument(db, firstId),
    queryForRunDocument(db, secondId),
  ]);
  return {
    allDocumentsVisible: isOwnedByRun(first.data?.[0], runId) && isOwnedByRun(second.data?.[0], runId),
  };
}

async function checkRollback(db, runId) {
  const firstId = documentId(runId, 'rollback_a');
  const secondId = documentId(runId, 'rollback_b');
  let abortObserved = false;

  try {
    await db.runTransaction(async (transaction) => {
      await transaction.collection(COLLECTION).doc(firstId).set({
        sp01Probe: COLLECTION, sp01RunId: runId, marker: 'rollback-a',
      });
      await transaction.collection(COLLECTION).doc(secondId).set({
        sp01Probe: COLLECTION, sp01RunId: runId, marker: 'rollback-b',
      });
      throw new Error(ABORT_SENTINEL);
    });
  } catch (error) {
    abortObserved = error?.message === ABORT_SENTINEL;
  }

  const [first, second] = await Promise.all([
    queryForRunDocument(db, firstId),
    queryForRunDocument(db, secondId),
  ]);
  const noPartialWrites = !first.data?.length && !second.data?.length;
  return { abortObserved, noPartialWrites };
}

async function checkConcurrentWrites(db, runId) {
  const counterId = documentId(runId, 'concurrency');
  await db.collection(COLLECTION).doc(counterId).set({
    sp01Probe: COLLECTION, sp01RunId: runId, value: 0,
  });

  let readers = 0;
  let releaseReaders;
  const readersReady = new Promise((resolve) => { releaseReaders = resolve; });
  let startBarrierTimedOut = false;
  const timeout = setTimeout(() => {
    startBarrierTimedOut = true;
    releaseReaders();
  }, 1500);
  let overlapObserved = false;

  const update = () => {
    let waitedForInitialSnapshot = false;
    return db.runTransaction(async (transaction) => {
      const reference = transaction.collection(COLLECTION).doc(counterId);
      const current = await reference.get();
      if (!waitedForInitialSnapshot) {
        waitedForInitialSnapshot = true;
        readers += 1;
        if (readers === 2) {
          overlapObserved = !startBarrierTimedOut;
          clearTimeout(timeout);
          releaseReaders();
        }
        await readersReady;
      }
      await reference.update({ value: current.data.value + 1 });
    });
  };

  const outcomes = await Promise.allSettled([update(), update()]);
  clearTimeout(timeout);
  const record = await queryForRunDocument(db, counterId);
  const finalValue = record.data?.[0]?.value;
  const successfulTransactions = outcomes.filter(({ status }) => status === 'fulfilled').length;
  const summarizedOutcomes = outcomes.map((outcome) => outcome.status === 'fulfilled'
    ? { status: 'fulfilled' }
    : {
      status: 'rejected',
      reasonName: typeof outcome.reason?.name === 'string' ? outcome.reason.name : 'Error',
      reasonCode: typeof outcome.reason?.code === 'string' ? outcome.reason.code : null,
    });

  return {
    overlapObserved,
    startBarrierTimedOut,
    outcomes: summarizedOutcomes,
    finalValue: Number.isInteger(finalValue) ? finalValue : null,
    successfulTransactions,
    stateConsistent: Number.isInteger(finalValue) && finalValue === successfulTransactions,
    resultRequiresReview: outcomes.some(({ status }) => status === 'rejected'),
  };
}

async function runProbe(db, runId) {
  await assertRunIsUnused(db, runId);
  let commit;
  let rollback;
  let concurrency;
  const failures = [];

  try {
    commit = await checkCommit(db, runId);
  } catch (error) {
    failures.push({ phase: 'commit', name: error?.name || 'Error', code: error?.code || null });
  }
  try {
    rollback = await checkRollback(db, runId);
  } catch (error) {
    failures.push({ phase: 'rollback', name: error?.name || 'Error', code: error?.code || null });
  }
  try {
    concurrency = await checkConcurrentWrites(db, runId);
  } catch (error) {
    failures.push({ phase: 'concurrency', name: error?.name || 'Error', code: error?.code || null });
  }

  let cleanup;
  try {
    cleanup = await cleanupRun(db, runId);
  } catch (error) {
    failures.push({ phase: 'cleanup', name: error?.name || 'Error', code: error?.code || null });
    cleanup = { success: false, runId, collection: COLLECTION, deletedCount: null };
  }

  const commitPassed = commit?.allDocumentsVisible === true;
  const rollbackPassed = rollback?.abortObserved === true && rollback?.noPartialWrites === true;
  const concurrencyPassed = concurrency?.overlapObserved === true
    && concurrency?.startBarrierTimedOut === false
    && concurrency?.stateConsistent === true
    && concurrency?.resultRequiresReview === false;
  return {
    success: commitPassed && rollbackPassed && concurrencyPassed && cleanup.success === true && failures.length === 0,
    runId,
    collection: COLLECTION,
    commit,
    rollback,
    concurrency,
    cleanup,
    failures,
  };
}

async function cleanupRun(db, runId) {
  const records = [];
  for (const suffix of DOCUMENT_SUFFIXES) {
    const id = documentId(runId, suffix);
    const result = await queryForRunDocument(db, id);
    const record = result.data?.[0];
    if (record && (record._id !== id || !isOwnedByRun(record, runId))) {
      throw new Error(`Refusing to clean non-owned probe document: ${id}`);
    }
    if (record) records.push(id);
  }

  let deletedCount = 0;
  for (const id of records) {
    const result = await db.collection(COLLECTION).doc(id).remove();
    deletedCount += result.deleted || 0;
  }

  const remaining = await Promise.all(DOCUMENT_SUFFIXES.map((suffix) =>
    queryForRunDocument(db, documentId(runId, suffix))));
  const leftoverIndex = remaining.findIndex((result) => result.data?.length);
  if (leftoverIndex !== -1) {
    throw new Error(`Probe cleanup verification failed: ${documentId(runId, DOCUMENT_SUFFIXES[leftoverIndex])}`);
  }
  return { success: true, runId, collection: COLLECTION, deletedCount };
}

function createHandler({ db, nodeVersion, sdkVersion }) {
  if (!db || typeof db.collection !== 'function' || typeof db.runTransaction !== 'function') {
    throw new Error('SP01 probe requires the CloudBase document database');
  }

  return async function handle(event) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      throw new Error('Invalid SP01 probe event');
    }

    switch (event.action) {
      case 'inspect':
        assertEvent(event, ['action']);
        return {
          success: /^v20\.19\./.test(nodeVersion),
          nodeVersion,
          nodeRuntimeMatch: /^v20\.19\./.test(nodeVersion),
          sdkVersion,
        };
      case 'prepare':
        assertEvent(event, ['action']);
        if (typeof db.createCollection !== 'function') throw new Error('CloudBase SDK does not expose createCollection');
        await db.createCollection(COLLECTION);
        return { success: true, collection: COLLECTION, created: true };
      case 'run':
      case 'cleanup':
        assertEvent(event, ['action', 'runId']);
        assertRunId(event.runId);
        return event.action === 'run' ? runProbe(db, event.runId) : cleanupRun(db, event.runId);
      default:
        throw new Error('Unsupported SP01 probe action');
    }
  };
}

module.exports = { createHandler, COLLECTION, RUN_ID_PATTERN };

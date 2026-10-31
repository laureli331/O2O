'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeSamples } = require('../tools/sp01-network-probe/summarize.cjs');
const { collectSequentialSamples } = require('../tools/sp01-network-probe/collect.cjs');
const { runReadOnlyNetworkProbe } = require('../tools/sp01-storage-probe/miniprogram/utils/network-workflow.js');
const { validateNonce } = require('../tools/sp01-storage-probe/miniprogram/utils/probe-contract.js');
const fs = require('node:fs');
const path = require('node:path');

test('network sample summary retains failures and computes nearest-rank p95', () => {
  const result = summarizeSamples([
    { elapsedMs: 100, ok: true }, { elapsedMs: 200, ok: true },
    { elapsedMs: 300, ok: true }, { elapsedMs: 400, ok: false },
  ]);
  assert.deepEqual(result, { attempts: 4, succeeded: 3, failed: 1,
    failureRate: 0.25, medianMs: 200, p95Ms: 300, maxMs: 300,
    meanConsecutiveDifferenceMs: 100 });
});

test('network sample summary does not invent latency when all attempts fail', () => {
  assert.deepEqual(summarizeSamples([{ ok: false, elapsedMs: 500 }]), {
    attempts: 1, succeeded: 0, failed: 1, failureRate: 1,
    medianMs: null, p95Ms: null, maxMs: null,
    meanConsecutiveDifferenceMs: null,
  });
});

test('empty and malformed sample sets cannot be reported as successful measurements', () => {
  assert.equal(summarizeSamples([]).failureRate, null);
  assert.equal(summarizeSamples([]).p95Ms, null);
  assert.throws(() => summarizeSamples([{ ok: true, elapsedMs: -1 }]), TypeError);
  assert.throws(() => summarizeSamples([{ ok: true, elapsedMs: Number.NaN }]), TypeError);
});

test('collector calls a read-only endpoint sequentially and never returns response bodies', async () => {
  const events = [];
  let tick = 0;
  const samples = await collectSequentialSamples({ count: 3,
    clock: () => tick,
    makeNonce: index => `nonce-${index}`,
    call: async nonce => { events.push(nonce); tick += 10; return { fingerprint: 'must-not-appear' }; },
  });
  assert.deepEqual(events, ['nonce-0', 'nonce-1', 'nonce-2']);
  assert.deepEqual(samples, [
    { ok: true, elapsedMs: 10 }, { ok: true, elapsedMs: 10 }, { ok: true, elapsedMs: 10 },
  ]);
  assert.doesNotMatch(JSON.stringify(samples), /fingerprint/);
});

test('collector keeps failed attempts and stops on invalid configuration', async () => {
  let tick = 0;
  const samples = await collectSequentialSamples({ count: 2, clock: () => tick,
    makeNonce: index => `nonce-${index}`,
    call: async nonce => { tick += 5; if (nonce === 'nonce-0') throw new Error('private response'); },
  });
  assert.deepEqual(samples, [{ ok: false, elapsedMs: 5 }, { ok: true, elapsedMs: 5 }]);
  assert.rejects(() => collectSequentialSamples({ count: 0, clock: () => 0,
    makeNonce: () => 'x', call: async () => {} }), RangeError);
});

test('mini-program adapter uses the existing read-only identity function and strips its body', async () => {
  let tick = 0;
  const calls = [];
  const result = await runReadOnlyNetworkProbe({ count: 2, clock: () => tick,
    makeNonce: index => `nonce-${String(index).padStart(16, '0')}`,
    callFunction: async input => {
      calls.push(input);
      tick += 12;
      return { result: { success: true, appMatchesTarget: true, fingerprint: 'a'.repeat(24) } };
    },
  });
  assert.deepEqual(calls.map(call => call.name), ['sp01IdentityProbe', 'sp01IdentityProbe']);
  assert.deepEqual(result.samples, [{ ok: true, elapsedMs: 12 }, { ok: true, elapsedMs: 12 }]);
  assert.doesNotMatch(JSON.stringify(result), /fingerprint|aaaaaaaa/);
});

test('mini-program adapter treats malformed or wrong-app responses as failed samples', async () => {
  let tick = 0;
  const result = await runReadOnlyNetworkProbe({ count: 2, clock: () => tick,
    makeNonce: index => `nonce-${String(index).padStart(16, '0')}`,
    callFunction: async () => { tick += 7; return { result: { success: true, appMatchesTarget: false,
      fingerprint: 'b'.repeat(24) } }; },
  });
  assert.equal(result.summary.succeeded, 0);
  assert.equal(result.summary.failed, 2);
  assert.equal(result.summary.p95Ms, null);
});

test('isolated mini-program page makes no cloud call until tapped and reports only redacted samples', async () => {
  const pageModule = require.resolve('../tools/sp01-storage-probe/miniprogram/pages/network/index.js');
  const originalPage = global.Page;
  const originalWx = global.wx;
  let definition;
  const calls = [];
  global.Page = value => { definition = value; };
  global.wx = {
    getNetworkType: ({ success }) => success({ networkType: 'wifi' }),
    cloud: { callFunction: async options => {
      calls.push(options);
      return { result: { success: true, appMatchesTarget: true, fingerprint: 'a'.repeat(24) } };
    } },
    setClipboardData: () => {},
  };
  try {
    delete require.cache[pageModule];
    require(pageModule);
    assert.equal(calls.length, 0);
    const page = { data: { ...definition.data }, setData(update) { Object.assign(this.data, update); },
      start: definition.start, copyReport: definition.copyReport };
    await page.start();
    assert.equal(calls.length, 30);
    assert.ok(calls.every(call => call.name === 'sp01IdentityProbe' && validateNonce(call.data.nonce)));
    assert.equal(new Set(calls.map(call => call.data.nonce)).size, 30);
    const report = JSON.parse(page.data.report);
    assert.equal(report.summary.succeeded, 30);
    assert.equal(report.scope, 'application-roundtrip-not-link-rtt-or-packet-loss');
    assert.doesNotMatch(page.data.report, /fingerprint|aaaaaaaa/);
  } finally {
    delete require.cache[pageModule];
    global.Page = originalPage;
    global.wx = originalWx;
  }
});

test('network page is independently reachable and labels the measurement boundary', () => {
  const root = '../tools/sp01-storage-probe/miniprogram';
  const config = require(`${root}/app.json`);
  const entry = fs.readFileSync(path.join(__dirname, root, 'pages/index/index.wxml'), 'utf8');
  const network = fs.readFileSync(path.join(__dirname, root, 'pages/network/index.wxml'), 'utf8');
  assert.ok(config.pages.includes('pages/network/index'));
  assert.match(entry, /url="\/pages\/network\/index"/);
  assert.match(network, /bindtap="start"/);
  assert.match(network, /不能当作网络 RTT、上下行速度或真实丢包/);
});

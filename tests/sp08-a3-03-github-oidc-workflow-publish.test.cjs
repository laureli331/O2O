'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const callerPath = path.join(root, '.github/workflows/sp08-a3-03-oidc-smoke.yml');
const reusablePath = path.join(root, '.github/workflows/sp08-a3-03-oidc-smoke-reusable.yml');
const guard = "github.event_name == 'workflow_dispatch' && github.repository == 'laureli331/O2O' && github.ref == 'refs/heads/codex/sp08-a3-03-oidc-smoke-20261118' && github.run_attempt == 1";
const read = (file) => fs.readFileSync(file, 'utf8');

test('published caller is manual-only, invokes the local reusable workflow and gates the job on the exact repo/ref/attempt', () => {
  const source = read(callerPath);
  assert.match(source, /^on:\s*\n\s+workflow_dispatch:\s*$/m);
  assert.doesNotMatch(source, /^\s{2}(push|pull_request|schedule):/m);
  assert.equal((source.match(/\$\{\{ ([^}]+) \}\}/g) || []).filter((expr) => expr.includes(guard)).length, 1);
  assert.match(source, /uses:\s*\.\/\.github\/workflows\/sp08-a3-03-oidc-smoke-reusable\.yml/);
  assert.match(source, /permissions:\s*\n\s+contents: read\s*\n\s+id-token: write/);
  assert.doesNotMatch(source, /\b(secrets|variables):/);
});

test('reusable token job and token step require the same exact guard and approved environment', () => {
  const source = read(reusablePath);
  assert.match(source, /^on:\s*\n\s+workflow_call:\s*$/m);
  assert.equal((source.match(new RegExp(guard.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 2);
  assert.match(source, /environment:\s*\n\s+name: SP08-A3-03-OIDC-smoke/);
  assert.match(source, /A303_EXPECTED_GITHUB_ENVIRONMENT: SP08-A3-03-OIDC-smoke/);
  assert.match(source, /permissions:\s*\n\s+contents: read\s*\n\s+id-token: write/);
  assert.doesNotMatch(source, /__REPLACE|if:\s*\$\{\{ false \}\}/);
  assert.match(source, /uses: actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/);
  assert.match(source, /persist-credentials: false/);
  assert.ok(source.indexOf('oidc-origin-preflight.cjs') < source.indexOf('oidc-smoke.cjs'));
});

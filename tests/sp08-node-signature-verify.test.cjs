'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('Node release signature candidate is manual, read-only, pinned, and digest-bound', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/sp08-node-signature-verify.yml'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'tools/sp08-node-signature-verify.sh'), 'utf8');

  assert.match(workflow, /push:\s+branches:\s+- codex\/sp08-node-signature-verify/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/codex\/sp08-node-signature-verify'/);
  assert.match(workflow, /github\.run_attempt == 1/);
  assert.doesNotMatch(workflow, /workflow_dispatch|pull_request|schedule:/);
  assert.match(workflow, /runs-on: ubuntu-24\.04/);
  assert.match(workflow, /permissions:\s+contents: read/);
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
  assert.doesNotMatch(workflow, /id-token:\s*write|secrets\.|cloudbase|deploy/i);
  assert.match(script, /v24\.22\.3/);
  assert.match(script, /node-v24\.22\.3-linux-x64\.tar\.xz/);
  assert.match(script, /4f2b175a6d53a5c617a80dba2676238a0688cef28c6da4eba35c7d844e66fcfb/);
  assert.match(script, /release-keys\/\$\{release_keys_commit\}\/gpg\/pubring\.kbx/);
  assert.match(script, /readonly release_keys_commit='481637f813e912c4aa3622d7964ab426c97b8e8d'/);
  assert.equal((script.match(/gpgv --keyring/g) ?? []).length, 1);
  assert.match(script, /SHASUMS256\.txt\.asc/);
  assert.doesNotMatch(script, /SHASUMS256\.txt\.sig/);
  assert.match(script, /count != 1 \|\| bad/);
  assert.doesNotMatch(script, /node-v24\.22\.3-linux-x64\.tar\.xz"\s+-o|apt(-get)?\s+install/i);
});

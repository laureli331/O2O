'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('installer uses private Node before extraction, preserves existing code, and installs matching sources offline', () => {
  const gitPath = process.env.GIT_EXE || 'D:/Git_exe';
  const bash = path.join(gitPath, 'usr/bin/bash.exe');
  assert.ok(fs.existsSync(bash), 'Git Bash required for installer verification');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'a303-install-'));
  const slashRoot = root.replaceAll('\\', '/');
  const sourceNames = ['a-segment-local.cjs', 'jwks-handoff.cjs', 'oidc-smoke.cjs', 'server-entry.cjs'];
  const script = path.join(root, 'install.sh');
  const marker = path.join(root, 'private-node-called');
  const nodeDir = path.join(root, 'node-v24.22.3');
  const bin = path.join(nodeDir, 'bin');
  const node = path.join(bin, 'node');
  const code = path.join(root, 'server-code');
  const archive = path.join(root, 'server-code.zip');
  const template = fs.readFileSync(path.join(__dirname, 'tat-install-server-code.sh'), 'utf8');
  assert.doesNotMatch(template, /^node\s/m);
  // NTFS cannot reproduce Linux install/chmod modes. Substitute only permission
  // helpers in this fixture; archive, version gate and Node invocation stay real.
  fs.writeFileSync(script, template.replace('umask 077', 'umask 077\ninstall() { mkdir -p "${@: -1}"; }\nchmod() { :; }').replaceAll('/opt/o2o-sp08-a303', slashRoot));
  const env = { ...process.env, PATH: `${path.join(gitPath, 'usr/bin')};${path.join(gitPath, 'mingw64/bin')};${process.env.PATH}` };
  const run = () => spawnSync(bash, [script], { env, windowsHide: true, encoding: 'utf8', timeout: 10000 });
  const clean = () => {
    for (const file of [...sourceNames.map(name => path.join(code, name)), archive, node, marker, script]) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    for (const dir of [code, bin, nodeDir, root]) if (fs.existsSync(dir)) fs.rmdirSync(dir);
  };
  try {
    const missing = run();
    assert.notEqual(missing.status, 0);
    assert.equal(fs.existsSync(archive), false);
    fs.mkdirSync(bin, { recursive: true });
    const fakeNode = version => fs.writeFileSync(node, `#!/usr/bin/env bash\nprintf '%s\\n' "$1" >> '${slashRoot}/private-node-called'\nprintf '%s\\n' '${version}'\n`, { mode: 0o700 });
    fakeNode('v0.0.0');
    assert.notEqual(run().status, 0);
    assert.equal(fs.existsSync(archive), false);
    fakeNode('v24.22.3');
    const installed = run();
    assert.equal(installed.status, 0, installed.stderr);
    assert.deepEqual(fs.readdirSync(code).sort(), sourceNames.slice().sort());
    for (const name of sourceNames) {
      const normalize = value => value.replaceAll('\r\n', '\n');
      assert.equal(normalize(fs.readFileSync(path.join(code, name), 'utf8')), normalize(fs.readFileSync(path.join(__dirname, name), 'utf8')), name);
    }
    assert.equal(fs.readFileSync(marker, 'utf8').trim(), '--version\n--version\n--version');
    const before = fs.readFileSync(path.join(code, sourceNames[0]));
    const repeated = run();
    assert.notEqual(repeated.status, 0);
    assert.match(repeated.stdout, /existing-server-code/);
    assert.deepEqual(fs.readFileSync(path.join(code, sourceNames[0])), before);
  } finally { clean(); }
});

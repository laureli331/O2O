'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const bash = 'D:/Git_exe/usr/bin/bash.exe';
const packageDir = __dirname;
const run = (exe, args, options = {}) => {
  const result = spawnSync(exe, args, { encoding: 'utf8', timeout: 15000, windowsHide: true, shell: false, ...options });
  if (result.error) throw result.error;
  return result;
};

test('sign output is exact, start consumes its leaf path, and stop cleans the owned temp files without starting service', (t) => {
  if (!fs.existsSync(bash)) { t.skip('Git Bash unavailable'); return; }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'a303-sign-files-'));
  const pki = path.join(root, 'pki');
  const tmp = path.join(root, 'tmp');
  fs.mkdirSync(pki); fs.mkdirSync(tmp);
  const files = ['pki/ca.key.pem', 'pki/ca.pem', 'pki/ca.srl', 'pki/client.pem', 'tmp/client.csr.pem', 'tmp/client.ext', 'tmp/server-lifecycle-owner.json',
    'tmp/fixture.key.pem', 'tmp/fixture.csr.pem', 'sign-fixture.sh', 'stop-fixture.sh'];
  const removeFile = (relative) => { const target = path.join(root, relative); if (fs.existsSync(target)) fs.unlinkSync(target); };
  t.after(() => { for (const relative of files) removeFile(relative); fs.rmdirSync(pki); fs.rmdirSync(tmp); fs.rmdirSync(root); });

  assert.equal(run('D:/Git_exe/usr/bin/openssl.exe', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(pki, 'ca.key.pem'), '-out', path.join(pki, 'ca.pem'), '-subj', '/CN=A303 Offline Fixture CA', '-days', '1']).status, 0);
  assert.equal(run('D:/Git_exe/usr/bin/openssl.exe', ['req', '-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(tmp, 'fixture.key.pem'), '-out', path.join(tmp, 'fixture.csr.pem'), '-subj', '/CN=A303 Offline Fixture Client']).status, 0);
  const csrB64 = fs.readFileSync(path.join(tmp, 'fixture.csr.pem')).toString('base64');
  const signSource = fs.readFileSync(path.join(packageDir, 'tat-sign-csr.template.sh'), 'utf8')
    .replace('ROOT=/opt/o2o-sp08-a303', `ROOT='${root.replaceAll('\\', '/')}'`)
    .replace("CSR_B64='{{csr_b64}}'", `CSR_B64='${csrB64}'`)
    .replace("SOURCE_RUN_ID='{{source_run_id}}'", "SOURCE_RUN_ID='123456'");
  const script = path.join(root, 'sign-fixture.sh');
  fs.writeFileSync(script, signSource);
  const signed = run(bash, [script], { env: { ...process.env, PATH: `D:/Git_exe/usr/bin;${process.env.PATH}` } });
  assert.equal(signed.status, 0, signed.stderr);
  const lines = signed.stdout.trimEnd().split('\n');
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^csr_sha256=[a-f0-9]{64}$/);
  assert.equal(lines[0].slice('csr_sha256='.length), require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(tmp, 'fixture.csr.pem'))).digest('hex'));
  assert.equal(lines[1], `leaf_cert_b64=${fs.readFileSync(path.join(pki, 'client.pem')).toString('base64')}`);
  assert.equal(lines[2], `ca_cert_b64=${fs.readFileSync(path.join(pki, 'ca.pem')).toString('base64')}`);
  const start = fs.readFileSync(path.join(packageDir, 'tat-server-start.template.sh'), 'utf8');
  assert.match(start, /test -s "\$ROOT\/pki\/client\.pem"/);
  assert.match(start, /fs\.readFileSync\(`\$\{pkiPath\}\/client\.pem`\)/);
  assert.ok(fs.statSync(path.join(pki, 'client.pem')).size > 0);

  const stopSource = fs.readFileSync(path.join(packageDir, 'tat-server-stop.template.sh'), 'utf8')
    .replace('ROOT=/opt/o2o-sp08-a303', `ROOT='${root.replaceAll('\\', '/')}'`)
    .replace("SOURCE_RUN_ID='{{source_run_id}}'", "SOURCE_RUN_ID='123456'");
  const stopPath = path.join(root, 'stop-fixture.sh'); fs.writeFileSync(stopPath, stopSource);
  const stopped = run(bash, [stopPath], { env: { ...process.env, PATH: `D:/Git_exe/usr/bin;${process.env.PATH}` } });
  assert.equal(stopped.status, 32);
  assert.match(stopped.stdout, /server_stop_state=unknown_pid_but_secrets_removed/);
  for (const relative of ['pki/ca.key.pem', 'pki/ca.srl', 'pki/client.pem', 'tmp/client.csr.pem', 'tmp/client.ext', 'tmp/server-lifecycle-owner.json']) {
    assert.equal(fs.existsSync(path.join(root, relative)), false, relative);
  }
});

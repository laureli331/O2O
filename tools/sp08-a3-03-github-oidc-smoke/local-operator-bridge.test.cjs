'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const sourceDir = __dirname;
const pwsh = 'C:\\Users\\Administrator\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\native\\powershell\\pwsh.exe';
const node20 = 'E:\\O2O\\.codex-validation-node20.19.3\\node-v20.19.3-win-x64\\node.exe';

function prepareFixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a303-operator-bridge-'));
  const owned = [];
  const write = (name, content) => { const target = path.join(dir, name); fs.writeFileSync(target, content); owned.push(target); return target; };
  t.after(() => { for (const file of owned) fs.unlinkSync(file); fs.rmdirSync(dir); });
  const prodScript = path.join(sourceDir, 'start-local-operator.ps1');
  const copiedScript = write('start-local-operator.ps1', fs.readFileSync(prodScript, 'utf8'));
  write('bounded-process-output.cs', fs.readFileSync(path.join(sourceDir, 'bounded-process-output.cs'), 'utf8'));
  write('config.json', JSON.stringify({ valid: true }));
  const childPath = path.join(dir, 'child-started.txt');
  const fake = String.raw`'use strict';
const fs = require('node:fs');
if (['--check-only', '--check-await-source'].includes(process.argv[2])) {
  const cfg = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  process.exitCode = cfg.valid === true ? 0 : 4;
} else if (['--run-once', '--await-source'].includes(process.argv[2])) {
  if (process.argv[2] === '--await-source') process.stdout.write(JSON.parse(fs.readFileSync(process.argv[3], 'utf8')).mode === 'bad-ready'
    ? 'SENTINEL-BAD-READY.........\n' : 'A303_AWAIT_SOURCE_READY\n');
  fs.writeFileSync(${JSON.stringify(childPath)}, 'started');
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => input += chunk);
  process.stdin.on('end', () => {
    const value = JSON.parse(input);
    const good = value.credential.secretId === 'id-sentinel'
      && value.credential.secretKey === 'key-sentinel'
      && value.credential.token === 'sts-sentinel'
      && value.token === 'github-sentinel'
      && value.expiration === '2030-01-01T00:00:00.0000000+00:00';
    if (!good) { process.stderr.write('sentinel-mapping-failed'); process.exitCode = 8; return; }
    if (JSON.parse(fs.readFileSync(process.argv[3], 'utf8')).mode === 'fail') {
      process.stderr.write('child-sentinel-error'); process.exitCode = 7; return;
    }
    process.stdout.write('{"state":"tls-complete","sourceRunId":"123"}\n');
  });
} else { process.stderr.write('unexpected-args'); process.exitCode = 9; }
`;
  write('local-operator-launcher.cjs', fake);
  const harness = String.raw`param([string]$ConfigPath, [string]$NodePath, [string]$Mode)
$global:promptCount = 0
function Read-Host {
  param([string]$Prompt, [switch]$AsSecureString)
  $global:promptCount++
  if ($Mode -eq 'cancel') { throw 'prompt-cancel-sentinel' }
  if (-not $AsSecureString) { return '2030-01-01T00:00:00.0000000+00:00' }
  $value = switch -Regex ($Prompt) {
    'SecretId' { 'id-sentinel'; break }
    'SecretKey' { 'key-sentinel'; break }
    'STS Token' { 'sts-sentinel'; break }
    'GitHub token' { 'github-sentinel'; break }
    default { throw 'unexpected-prompt-sentinel' }
  }
  ConvertTo-SecureString -String $value -AsPlainText -Force
}
$scriptPath = Join-Path $PSScriptRoot 'start-local-operator.ps1'
if ($Mode -in @('watch','watch-bad-ready')) { & $scriptPath -ConfigPath $ConfigPath -NodePath $NodePath -RunOnce -AwaitSource }
elseif ($Mode -eq 'watch-check') { & $scriptPath -ConfigPath $ConfigPath -NodePath $NodePath -AwaitSource }
elseif ($Mode -in @('success','fail','cancel')) { & $scriptPath -ConfigPath $ConfigPath -NodePath $NodePath -RunOnce }
else { & $scriptPath -ConfigPath $ConfigPath -NodePath $NodePath }
Write-Output "PROMPTCOUNT=$global:promptCount"
`;
  const harnessPath = write('bridge-harness.ps1', harness);
  return { dir, write, copiedScript, harnessPath, configPath: path.join(dir, 'config.json'), childPath };
}

function runBridge(fixture, mode, configPath = fixture.configPath) {
  return spawnSync(pwsh, ['-NoProfile', '-File', fixture.harnessPath, '-ConfigPath', configPath, '-NodePath', node20, '-Mode', mode], {
    cwd: fixture.dir, encoding: 'utf8', timeout: 20000,
  });
}

test('Windows PowerShell bridge stays offline, prompts only after check, maps distinct credentials, and suppresses child failure', { skip: process.platform !== 'win32' }, (t) => {
  const fixture = prepareFixture(t);
  const defaultRun = runBridge(fixture, 'default');
  assert.equal(defaultRun.status, 0, defaultRun.stderr);
  assert.match(defaultRun.stdout, /"state":"check-only"/, defaultRun.stderr);
  assert.equal(fs.existsSync(fixture.childPath), false);

  const watchCheck = runBridge(fixture, 'watch-check');
  assert.equal(watchCheck.status, 0, watchCheck.stderr);
  assert.match(watchCheck.stdout, /PROMPTCOUNT=0/);
  assert.equal(fs.existsSync(fixture.childPath), false);
  const watch = runBridge(fixture, 'watch');
  assert.equal(watch.status, 0, watch.stderr);
  assert.match(watch.stdout, /"state":"waiting-for-source","readyToDispatch":false/);
  assert.match(watch.stdout, /"sourceRunId":"123"/);
  assert.equal(`${watch.stdout}${watch.stderr}`.includes('sentinel'), false);
  fs.unlinkSync(fixture.childPath);
  const badReadyPath = fixture.write('bad-ready.json', JSON.stringify({ valid: true, mode: 'bad-ready' }));
  const badReady = runBridge(fixture, 'watch-bad-ready', badReadyPath);
  assert.match(`${badReady.stdout}${badReady.stderr}`, /本地启动未完成/);
  assert.equal(`${badReady.stdout}${badReady.stderr}`.includes('SENTINEL'), false);
  assert.equal(badReady.stdout.includes('waiting-for-source'), false);
  fs.unlinkSync(fixture.childPath);

  const badConfig = fixture.write('bad-config.json', '{invalid');
  const bad = runBridge(fixture, 'default', badConfig);
  assert.match(`${bad.stdout}${bad.stderr}`, /本地启动未完成/);
  assert.match(bad.stdout, /PROMPTCOUNT=0/);
  assert.equal(bad.stdout.includes('PROMPT_CALLED'), false);
  assert.equal(fs.existsSync(fixture.childPath), false);

  const success = runBridge(fixture, 'success');
  assert.equal(success.status, 0, success.stderr);
  assert.match(success.stdout, /"sourceRunId":"123"/);
  assert.equal(`${success.stdout}${success.stderr}`.includes('sentinel'), false);

  fs.unlinkSync(fixture.childPath);
  const failConfig = fixture.write('fail-config.json', JSON.stringify({ valid: true, mode: 'fail' }));
  const failed = runBridge(fixture, 'fail', failConfig);
  assert.match(`${failed.stdout}${failed.stderr}`, /本地启动未完成/);
  assert.equal(`${failed.stdout}${failed.stderr}`.includes('sentinel'), false);
  assert.equal(fs.existsSync(fixture.childPath), true);

  fs.unlinkSync(fixture.childPath);
  const canceled = runBridge(fixture, 'cancel');
  assert.match(`${canceled.stdout}${canceled.stderr}`, /本地启动未完成/);
  assert.match(canceled.stdout, /PROMPTCOUNT=1/);
  assert.equal(`${canceled.stdout}${canceled.stderr}`.includes('sentinel'), false);
  assert.equal(fs.existsSync(fixture.childPath), false);
});

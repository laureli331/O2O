'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');

function evaluate(outcomes) {
  return outcomes.fullDeclarationExitCode !== 0 && Number.isInteger(outcomes.fullDeclarationExitCode)
    && outcomes.sourceOnlyExitCode === 0 && outcomes.originalConfigUnchanged === true
    && outcomes.negativeCases.length === 2
    && outcomes.negativeCases.every((entry) => entry.exitCode !== 0 && Number.isInteger(entry.exitCode) && entry.expectedDiagnosticObserved);
}
function runCheck() {
  const runtime = path.join(root, '.local/sp01-taro-probe-peer-fix');
  const compiler = path.join(runtime, 'node_modules/typescript/bin/tsc');
  const config = path.join(runtime, 'tsconfig.json');
  const original = fs.readFileSync(config);
  const hash = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
  const compile = (target) => spawnSync(process.execPath,
    [compiler, '--noEmit', '--pretty', 'false', '--project', target],
    { encoding: 'utf8', timeout: 30000 });
  const full = compile(config);
  const source = compile(path.join(runtime, 'tsconfig.app.json'));
  const directory = path.join(runtime, 'validation-cases');
  fs.mkdirSync(directory, { recursive: true });
  const negativeCases = [];
  for (const file of ['invalid-component.tsx', 'invalid-api.ts']) {
    fs.copyFileSync(path.join(__dirname, 'type-policy-cases', file), path.join(directory, file));
    const negativeConfig = path.join(directory, `${file}.json`);
    fs.writeFileSync(negativeConfig, JSON.stringify({ extends: '../tsconfig.app.json', include: ['../src', '../config', `./${file}`] }, null, 2));
    const result = compile(negativeConfig);
    const output = `${result.stdout || ''}${result.stderr || ''}`;
    negativeCases.push({ name: file, exitCode: result.status,
      expectedDiagnosticObserved: /\bTS2322\b/.test(output) && output.includes(file) });
    fs.writeFileSync(path.join(root, `.local/taro-policy-${file}.txt`), output);
  }
  const report = { evidenceScope: 'local-approved-type-policy-verification', nodeVersion: process.version,
    fullDeclarationExitCode: full.status, fullDeclarationDiagnosticLines: full.stdout.split(/\r?\n/).filter(Boolean).length,
    sourceOnlyExitCode: source.status, negativeCases,
    originalConfigUnchanged: hash(original) === hash(fs.readFileSync(config)),
    approvedPolicy: 'split-strict-source-own-declarations-vendor-diagnostics', fullDeclarationCheckPassed: false, productAcceptancePassed: false };
  report.comparisonConclusive = evaluate(report);
  fs.writeFileSync(path.join(root, '.local/taro-peer-full-declarations.txt'), `${full.stdout || ''}${full.stderr || ''}`);
  fs.writeFileSync(path.join(root, '.local/taro-peer-source-only.txt'), `${source.stdout || ''}${source.stderr || ''}`);
  fs.writeFileSync(path.join(root, '.local/taro-type-policy-comparison.json'), JSON.stringify(report, null, 2));
  return report;
}
module.exports = { evaluate, runCheck };
if (require.main === module) {
  const report = runCheck();
  console.log(JSON.stringify(report));
  if (!report.comparisonConclusive) process.exitCode = 1;
}

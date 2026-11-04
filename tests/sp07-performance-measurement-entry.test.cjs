'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const entryPath = 'docs/performance-measurement-entry-20261105.json';

test('SP07 registers QP10 evidence intake without claiming product measurements', () => {
  const entryFile = path.join(root, entryPath);
  assert.ok(fs.existsSync(entryFile), 'register the QP10 evidence entry before claiming SP07 registration');

  const entry = JSON.parse(fs.readFileSync(entryFile, 'utf8'));
  const plan = JSON.parse(fs.readFileSync(path.join(root, 'docs/v1-executable-development-plan-20261027.json'), 'utf8'));
  const quality = JSON.parse(fs.readFileSync(path.join(root, 'docs/v1-quality-acceptance-20261027.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const sp07 = plan.tasks.find((task) => task.id === 'SP07');
  const qp10 = quality.criteria.find((criterion) => criterion.id === 'QP10');

  assert.equal(entry.criterionId, 'QP10');
  assert.equal(entry.registrationStatus, 'registered');
  assert.equal(entry.productMeasurementsExecuted, false);
  assert.equal(entry.productMeasurementCount, 0);
  assert.equal(entry.thresholdsChanged, false);
  assert.deepEqual(entry.ownerTasks, ['SP07', 'SP15', 'SP18', 'SP35']);
  assert.equal(entry.downstream.SP15.trigger, 'first-implemented-core-flow');
  assert.equal(entry.downstream.SP18.trigger, 'first-implemented-core-flow');
  assert.equal(entry.downstream.SP35.trigger, 'final-candidate-build');
  assert.ok(entry.requiredRunRecordFields.includes('rawSamplesAndEvidencePaths'));
  assert.ok(entry.requiredRunRecordFields.includes('measurementToolVersionAndResolution'));
  assert.equal(entry.missingEvidenceDisposition, 'not-passed');
  assert.deepEqual(entry.criterionReferences, ['QP05', 'QP06', 'QP08', 'QP09', 'QP10']);
  assert.match(qp10.method, /SP07测量入口、SP15\/SP18早期基线/);
  assert.ok(plan.sources.includes(entryPath));
  assert.ok(plan.sources.includes('docs/performance-measurement-entry-20261105.md'));
  assert.ok(manifest.scripts['check:foundation'].includes('tests/sp07-performance-measurement-entry.test.cjs'));
  assert.equal(sp07.status, 'in-progress');
  assert.equal(sp07.productAcceptancePassed, false);
  assert.ok(sp07.executionProgress.completedAcceptance.some((item) => item.includes(entryPath)));
  assert.ok(sp07.executionProgress.remainingAcceptance.some((item) => /full repository regression is not green/i.test(item)));
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const readText = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('SP05 preparation contract traces accepted pages, states, design tokens and quality gates', () => {
  const contract = readJson('docs/sp05-page-acceptance-contract-20261104.json');
  const plan = readJson('docs/v1-executable-development-plan-20261027.json');
  const quality = readJson('docs/v1-quality-acceptance-20261027.json');
  const pageManifest = readJson('docs/ui-consistency-pages-20261027.json');
  const tokens = readJson('docs/superpowers/specs/2026-10-27-ui-consistency-design-tokens.json');
  const sp05 = plan.tasks.find((task) => task.id === 'SP05');

  assert.equal(contract.task, 'SP05');
  assert.equal(contract.status, 'preparation-confirmed-product-validation-not-executed');
  assert.equal(contract.scope.preparationOnly, true);
  assert.equal(contract.scope.formalEngineeringStarted, false);
  assert.equal(contract.scope.productValidationPerformed, false);
  assert.equal(contract.scope.productAcceptancePassed, false);
  assert.equal(contract.scope.formalProductModuleDiagramRequired, false);

  assert.deepEqual(contract.pageInventory.activeHtmlFiles, pageManifest.pages.map((page) => page.file));
  assert.deepEqual(contract.pageInventory.excludedHtmlFiles, pageManifest.excludedPages);
  assert.deepEqual(contract.pageInventory.pages, ['G01', 'G02', 'G03', 'G04']);
  assert.equal(contract.pageInventory.activeHtmlFiles.length, 33);
  assert.equal(Object.keys(contract.pageInventory.excludedHtmlFiles).length, 6);

  const expectedStateGroups = {
    G01: Array.from({ length: 8 }, (_, index) => `G01-0${index + 1}`),
    G02: Array.from({ length: 6 }, (_, index) => `G02-0${index + 1}`),
    G03: Array.from({ length: 6 }, (_, index) => `G03-0${index + 1}`),
    G04: Array.from({ length: 4 }, (_, index) => `G04-0${index + 1}`),
  };
  assert.deepEqual(contract.stateContract.groups, expectedStateGroups);
  assert.equal(Object.values(contract.stateContract.groups).flat().length, 24);

  assert.deepEqual(contract.visualBaseline.spacingScale, tokens.spacingScale);
  assert.deepEqual(contract.visualBaseline.radius, tokens.radius);
  assert.deepEqual(contract.visualBaseline.mobile, tokens.mobile);
  assert.deepEqual(contract.visualBaseline.admin, tokens.admin);
  assert.deepEqual(contract.visualBaseline.protectedExceptions, tokens.protected);
  assert.equal(contract.visualBaseline.approvalScope, 'approved-all-active-delivered');

  const criteria = new Map(quality.criteria.map((criterion) => [criterion.id, criterion]));
  for (const id of ['QP05', 'QP07', 'QP08', 'QP09']) {
    assert.deepEqual(contract.qualityPlan[id].sourceContract, criteria.get(id));
  }

  assert.equal(contract.qualityPlan.QP05.preparationOwner, 'SP01/SP05');
  assert.equal(contract.qualityPlan.QP05.productEvidenceOwner, 'SP35');
  assert.equal(contract.qualityPlan.QP05.freezeSegmentDurationSeconds, 10);
  assert.equal(contract.qualityPlan.QP05.status, 'preparation-parameter-confirmed-product-not-executed');
  assert.equal(contract.qualityPlan.QP05.referenceRefreshHz, 60);
  assert.equal(contract.qualityPlan.QP05.minAverageFpsPerSegment, 55);
  assert.equal(contract.qualityPlan.QP05.maxAttributableStallMs, 100);
  assert.equal(contract.qualityPlan.QP05.roundsPerDeviceGroup, 3);
  assert.equal(contract.qualityPlan.QP05.minSegmentsPerRound, 30);

  assert.equal(contract.qualityPlan.QP07.configurationOwner, 'SP01');
  assert.deepEqual(contract.qualityPlan.QP07.productRecoveryOwners, ['SP11', 'each-applicable-business-card', 'SP35']);
  assert.equal(contract.qualityPlan.QP07.existingProbeIsProductEvidence, false);

  assert.equal(contract.qualityPlan.QP08.preparationOwner, 'SP05');
  assert.equal(contract.qualityPlan.QP08.productEnduranceOwner, 'SP35');
  assert.deepEqual(contract.qualityPlan.QP08.confirmedWorkload, {
    durationMinutes: 60,
    minimumCompleteCycles: 60,
    checkpointMinutes: 10,
  });
  assert.deepEqual(contract.qualityPlan.QP08.cycleRecipe, [
    'browse a list',
    'open a detail',
    'return to the list',
    'open and close a modal',
    'enter and cancel a publish form',
    'load an image',
    'query a business object',
    'restore the same baseline page',
  ]);
  assert.equal(contract.qualityPlan.QP08.cycleRecipeStatus, 'confirmed');
  assert.equal(contract.qualityPlan.QP08.attributableMemoryGrowthBudget, null);
  assert.equal(contract.qualityPlan.QP08.memoryBudgetStatus, 'not-set-no-formal-page-level-baseline');

  assert.equal(contract.qualityPlan.QP09.productEvidenceOwner, 'SP35');
  assert.equal(contract.qualityPlan.QP09.numericWebBudgets, null);
  assert.equal(contract.qualityPlan.QP09.existingChromeProbeIsProductEvidence, false);
  assert.equal(contract.deviceSnapshots.webBrowser.browser, 'Chrome');
  assert.equal(contract.deviceSnapshots.webBrowser.exactVersion, '156.0.8078.47');
  assert.equal(contract.deviceSnapshots.webBrowser.windowsBuild, null);

  assert.deepEqual(contract.decisionsPending, []);
  assert.deepEqual(contract.decisionsConfirmed.map((decision) => decision.id), [
    'QP05_SEGMENT_DURATION',
    'QP08_CYCLE_RECIPE',
  ]);
  assert.equal(sp05.status, 'complete');
  assert.equal(sp05.productAcceptancePassed, false);
  assert.equal(sp05.completion.scope, 'task-preparation-only');
  assert.equal(sp05.completion.scopeNote.includes('产品验收未通过'), true);
  assert.ok(sp05.completion.evidence.includes('docs/sp05-page-acceptance-contract-20261104.json'));
  assert.ok(sp05.completion.evidence.includes('tests/sp05-page-acceptance-contract.test.cjs'));
  assert.deepEqual(sp05.prototypeProgress.remaining, []);
  assert.equal(sp05.prototypeProgress.contractRef, 'docs/sp05-page-acceptance-contract-20261104.json');
  assert.equal(sp05.prototypeProgress.contractMarkdownRef, 'docs/sp05-page-acceptance-contract-20261104.md');
  assert.equal(sp05.executionProgress.productValidationPerformed, false);
  assert.equal(sp05.executionProgress.formalEngineeringStarted, false);
});

test('SP05 contract cites reusable project artifacts and does not add a library or enter SP07', () => {
  const contract = readJson('docs/sp05-page-acceptance-contract-20261104.json');
  const plan = readJson('docs/v1-executable-development-plan-20261027.json');
  const sp07 = plan.tasks.find((task) => task.id === 'SP07');
  for (const source of contract.sources) assert.ok(fs.existsSync(path.join(root, source)), source);
  assert.deepEqual(contract.reuseSurvey.newDependencies, []);
  assert.equal(contract.reuseSurvey.adoptedApproach, 'reuse-current-page-manifest-shared-states-and-approved-ui-tokens');
  assert.equal(sp07.status, 'planned');
  assert.equal(plan.firstProductTask, 'SP07');
  assert.deepEqual(plan.firstProductTaskPrerequisites, ['SP01', 'SP02', 'SP03', 'SP04', 'SP05', 'SP06']);
  assert.ok(contract.sources.includes('docs/backend-architecture-contract-20261103.md'));
  assert.ok(contract.sources.includes('docs/backend-architecture-contract-20261103.json'));
  assert.ok(contract.sources.includes('docs/sp01-closeout-reconciliation-20261104.md'));
  assert.ok(contract.sources.includes('docs/sp01-closeout-reconciliation-20261104.json'));
  assert.ok(contract.sources.includes('docs/sp04-operations-configuration-20261027.md'));
  assert.ok(contract.sources.includes('docs/sp04-operations-configuration-20261027.json'));
  assert.ok(plan.sources.includes('docs/sp05-page-acceptance-contract-20261104.md'));
  assert.ok(plan.sources.includes('docs/sp05-page-acceptance-contract-20261104.json'));
});

test('SP05 plan and human-readable contract record approved preparation decisions without claiming product acceptance', () => {
  const contract = readJson('docs/sp05-page-acceptance-contract-20261104.json');
  const plan = readJson('docs/v1-executable-development-plan-20261027.json');
  const markdown = readText('docs/sp05-page-acceptance-contract-20261104.md');
  const planMarkdown = readText('docs/v1-executable-development-plan-20261027.md');
  const sp05 = plan.tasks.find((task) => task.id === 'SP05');

  for (const decision of contract.decisionsConfirmed) assert.ok(markdown.includes(decision.id));
  assert.match(markdown, /每段持续操作片段 \*\*10秒\*\*，已由用户确认/);
  assert.match(markdown, /用户已确认采用以下八步混合循环/);
  assert.ok(markdown.includes('QP05'));
  assert.ok(markdown.includes('QP07'));
  assert.ok(markdown.includes('QP08'));
  assert.ok(markdown.includes('QP09'));
  assert.ok(markdown.includes('SP35'));
  assert.ok(markdown.includes('未执行'));
  for (const threshold of ['≥55 FPS', '100ms', '60分钟', '60个完整循环', '每10分钟']) assert.ok(markdown.includes(threshold), threshold);
  assert.ok(markdown.includes('QP08_MEMORY_BUDGET_TIMING') === false);
  assert.equal(sp05.executionProgress.productValidationPerformed, false);
  assert.equal(sp05.executionProgress.formalEngineeringStarted, false);
  assert.match(sp05.executionProgress.nextAction, /SP06/);
  assert.match(sp05.executionProgress.nextAction, /QD03/);
  assert.match(sp05.executionProgress.nextAction, /SP35/);
  assert.doesNotMatch(sp05.executionProgress.nextAction, /等待用户确认/);
});

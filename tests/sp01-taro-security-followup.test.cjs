'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const evidence = require('../docs/sp01-taro-security-followup-20261029.json');
const variant = require('../tools/sp01-taro-probe/variants/peer-fix.json');

test('security evidence keeps unresolved audit findings and limited build evidence separate from acceptance', () => {
  assert.equal(variant.overrides[evidence.globOverride.selector], evidence.globOverride.version);
  const audit = evidence.validation.audit;
  assert.equal(audit.after.total, audit.after.moderate + audit.after.high + audit.after.critical);
  assert.equal(audit.before.total - audit.after.total, audit.removedEntries.length);
  assert.equal(audit.allFindingsResolved, false);
  assert.equal(evidence.validation.buildHostCoverage.absenceProvesSafety, false);
  assert.equal(evidence.validation.buildHostCoverage.vulnerableFunctionsProvenReachable, false);
  assert.equal(evidence.vendorDeclarationFailureRetained, true);
  assert.equal(evidence.sp01Passed, false);
  assert.equal(evidence.productAcceptancePassed, false);
});

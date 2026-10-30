'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertSmokeResult, EXPECTED_TEXT } = require('../tools/sp01-web-react-probe/browser-smoke.cjs');
function valid() {
  return { views: [1280, 360].map(width => ({ width, httpStatus: 200, text: EXPECTED_TEXT,
    reloadText: EXPECTED_TEXT, horizontalOverflow: false })),
  pageErrors: [], consoleErrors: [], failedResponses: [], externalRequests: [] };
}
test('browser acceptance rejects missing React output, failed resources and runtime errors', () => {
  assert.doesNotThrow(() => assertSmokeResult(valid()));
  for (const mutate of [
    r => { r.views[0].text = ''; },
    r => { r.views[1].reloadText = ''; },
    r => { r.views[1].horizontalOverflow = true; },
    r => { r.failedResponses.push({ path: '/assets/missing.js', status: 404 }); },
    r => { r.pageErrors.push('TypeError'); },
    r => { r.consoleErrors.push('synthetic error'); },
    r => { r.externalRequests.push('https://synthetic.invalid'); },
    r => { r.views.pop(); },
    r => { r.views[1].width = 1280; },
  ]) {
    const result = valid(); mutate(result);
    assert.throws(() => assertSmokeResult(result));
  }
});

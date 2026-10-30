'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const report = require('../docs/sp01-refresh-rate-report-20261030.json');
const devices = require('../docs/sp01-device-evidence-20261029.json');

test('reported refresh rates preserve uncertain mode/model association without certifying measured FPS', () => {
  const knownIds = new Set(devices.devices.map(device => device.id));
  for (const rate of report.reportedRates) {
    assert.ok(rate.reportedHz > 0);
    if (rate.knownDevice) assert.ok(knownIds.has(rate.knownDevice));
    for (const id of rate.possibleDeviceIds || []) assert.ok(knownIds.has(id));
  }
  assert.equal(report.reportedRates.find(rate => rate.brand === 'HUAWEI').knownDevice, null);
  assert.equal(report.currentSettingOrMaximumCapabilityConfirmed, false);
  assert.equal(report.physicalRefreshTimingMeasured, false);
  assert.equal(report.renderedFpsMeasured, false);
  assert.equal(report.measurementGroupsFrozen, false);
  assert.equal(report.existing60HzAcceptanceThresholdChanged, false);
  assert.equal(report.productAcceptancePassed, false);
});

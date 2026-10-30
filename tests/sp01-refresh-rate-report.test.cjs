'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const report = require('../docs/sp01-refresh-rate-report-20261030.json');
const devices = require('../docs/sp01-device-evidence-20261029.json');

test('confirmed selected refresh rates match all four devices without certifying measured FPS', () => {
  const knownIds = new Set(devices.devices.map(device => device.id));
  for (const rate of report.reportedRates) {
    assert.ok(rate.reportedHz > 0);
    assert.ok(knownIds.has(rate.knownDevice));
    assert.equal(devices.devices.find(device => device.id === rate.knownDevice).selectedRefreshRateHz, rate.reportedHz);
    for (const id of rate.possibleDeviceIds || []) assert.ok(knownIds.has(id));
  }
  assert.equal(report.reportedRates.length, 4);
  assert.equal(report.reportedRates.find(rate => rate.reportedHz === 90).knownDevice, 'DEVICE03');
  assert.equal(report.currentSettingOrMaximumCapabilityConfirmed, true);
  assert.equal(report.huaweiModelAssociationConfirmed, true);
  assert.equal(report.rateMeaning, 'currently-selected-setting');
  assert.ok(devices.devices.every(device => device.refreshRateHz === null));
  assert.equal(report.physicalRefreshTimingMeasured, false);
  assert.equal(report.renderedFpsMeasured, false);
  assert.equal(report.measurementGroupsFrozen, false);
  assert.equal(report.existing60HzAcceptanceThresholdChanged, false);
  assert.equal(report.productAcceptancePassed, false);
});

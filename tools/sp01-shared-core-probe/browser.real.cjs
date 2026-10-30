'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
const { runBrowserSmoke } = require('../sp01-web-react-probe/browser-smoke.cjs');
const root = path.resolve(__dirname, '../..');
const interactions = [];
runBrowserSmoke(path.join(root, '.local/sp01-shared-react18-probe/apps/web'),
  path.join(root, '.local/npm-tool-cache/_npx/873d7bcc81943761/node_modules/playwright-core'),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  path.join(root, '.local/shared18-browser.json'), {
    expectedText: 'Count 0', contentSelector: '#root p',
    onReady: async (page, width) => {
      for (let index = 0; index < 3; index++) await page.getByRole('button', { name: 'Increment', exact: true }).click();
      await page.getByText('Count 3', { exact: true }).waitFor({ state: 'visible' });
      assert.equal(await page.locator('#root p').textContent(), 'Count 3');
      await page.getByRole('button', { name: 'Reset', exact: true }).click();
      await page.getByText('Count 0', { exact: true }).waitFor({ state: 'visible' });
      interactions.push({ width, increments: 3, resetPassed: true });
    },
  }).then(result => console.log(JSON.stringify({ success: result.success, interactions,
    browserVersion: result.browserVersion, browserClosed: result.browserClosed, previewClosed: result.previewClosed })))
  .catch(error => { console.error(error.message); process.exitCode = 1; });

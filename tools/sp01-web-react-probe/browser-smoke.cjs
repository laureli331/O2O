'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const EXPECTED_TEXT = 'SP01 React Web synthetic build probe';

function assertSmokeResult(result, expectedText = EXPECTED_TEXT) {
  assert.equal(result.views.length, 2, 'EXPECTED_TWO_VIEWPORTS');
  assert.deepEqual(result.views.map(view => view.width), [1280, 360], 'VIEWPORTS_NOT_CHECKED');
  for (const view of result.views) {
    assert.equal(view.httpStatus, 200, 'PAGE_NOT_OK');
    assert.equal(view.text, expectedText, 'REACT_RENDER_MISSING');
    assert.equal(view.reloadText, expectedText, 'RELOAD_RENDER_MISSING');
    assert.equal(view.horizontalOverflow, false, 'HORIZONTAL_OVERFLOW');
  }
  assert.deepEqual(result.pageErrors, [], 'PAGE_RUNTIME_ERRORS');
  assert.deepEqual(result.consoleErrors, [], 'CONSOLE_ERRORS');
  assert.deepEqual(result.failedResponses, [], 'RESOURCE_ERRORS');
  assert.deepEqual(result.externalRequests, [], 'UNEXPECTED_EXTERNAL_REQUESTS');
}

async function runBrowserSmoke(project, playwrightPackage, executablePath, outputFile, options = {}) {
  const expectedText = options.expectedText || EXPECTED_TEXT;
  const selector = options.contentSelector || '#root';
  const resolveProject = createRequire(path.join(path.resolve(project), 'package.json'));
  const { preview } = await import(pathToFileURL(resolveProject.resolve('vite')).href);
  const { chromium } = require(path.resolve(playwrightPackage));
  const result = { success: false, views: [], pageErrors: [], consoleErrors: [],
    failedResponses: [], externalRequests: [], previewClosed: false, browserClosed: false };
  let server, browser, failure;
  try {
    server = await preview({ root: path.resolve(project), configFile: path.resolve(project, 'vite.config.ts'),
      preview: { host: '127.0.0.1', port: 18865, strictPort: true, open: false } });
    const address = server.httpServer.address();
    assert.equal(address.address, '127.0.0.1', 'PREVIEW_MUST_BE_LOOPBACK');
    const origin = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({ executablePath, headless: true, timeout: 15000 });
    result.browserVersion = browser.version();
    result.playwrightVersion = require(path.resolve(playwrightPackage, 'package.json')).version;
    const context = await browser.newContext();
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      result.externalRequests.push(url.origin);
      return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => result.pageErrors.push(error.name));
    page.on('console', message => { if (message.type() === 'error') result.consoleErrors.push(message.text()); });
    page.on('response', response => {
      if (response.status() >= 400) result.failedResponses.push({ path: new URL(response.url()).pathname, status: response.status() });
    });
    for (const width of [1280, 360]) {
      await page.setViewportSize({ width, height: 800 });
      const response = await page.goto(origin, { waitUntil: 'networkidle', timeout: 15000 });
      await page.getByText(expectedText, { exact: true }).waitFor({ state: 'visible', timeout: 10000 });
      if (options.onReady) await options.onReady(page, width);
      const text = await page.locator(selector).textContent();
      const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      await page.reload({ waitUntil: 'networkidle', timeout: 15000 });
      await page.getByText(expectedText, { exact: true }).waitFor({ state: 'visible', timeout: 10000 });
      result.views.push({ width, height: 800, httpStatus: response.status(), text,
        reloadText: await page.locator(selector).textContent(), horizontalOverflow });
    }
    assertSmokeResult(result, expectedText);
    result.success = true;
  } catch (error) {
    failure = error;
    result.failure = { name: error.name, message: error.message.slice(0, 240) };
  } finally {
    for (const [resource, field, closed] of [
      [browser, 'browserClosed', () => !browser.isConnected()],
      [server, 'previewClosed', () => !server.httpServer.listening],
    ]) {
      if (!resource) continue;
      try { await resource.close(); result[field] = closed(); }
      catch (error) {
        failure ||= error;
        result.success = false;
        result.cleanupFailure = { resource: field, name: error.name };
      }
    }
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
  }
  if (failure) throw failure;
  return result;
}
module.exports = { assertSmokeResult, runBrowserSmoke, EXPECTED_TEXT };
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length !== 4) throw Error('EXPECTED_PROJECT_PLAYWRIGHT_CHROME_OUTPUT');
  runBrowserSmoke(...args).then(result => console.log(JSON.stringify({ success: result.success,
    browserVersion: result.browserVersion, previewClosed: result.previewClosed, browserClosed: result.browserClosed })))
    .catch(error => { console.error(error.message.slice(0, 240)); process.exitCode = 1; });
}

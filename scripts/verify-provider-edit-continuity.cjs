'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const { chromium } = require(process.env.PREVIEW_PLAYWRIGHT_PATH);
  const [base, out, executablePath] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const nav = code => page.locator(`[data-screen=${code}]`).click();
  const beforeUnload = () => page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    dispatchEvent(event);
    return event.defaultPrevented;
  });
  try {
    for (const width of [320, 375, 414, 1280]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(base + '/v10.html');
      await nav('C');
      assert.equal(await beforeUnload(), false, 'Clean editor does not interrupt');
      await page.locator('#p-name').fill('保留这次修改');
      await page.locator('#scenario').selectOption('guest');
      assert(await page.locator('#confirm-dialog').isVisible());
      assert.equal(await page.locator('#scenario').inputValue(), 'normal', 'Unconfirmed scenario must not appear applied');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'cancel-action');
      await page.locator('#cancel-action').click();
      assert.equal(await page.locator('#p-name').inputValue(), '保留这次修改');
      assert.equal(await beforeUnload(), true, 'Unsaved profile protects refresh and external navigation');
      if (width === 375) {
        const dialog = page.waitForEvent('dialog');
        const reload = page.reload({ timeout: 1500 }).catch(error => {
          // Edge leaves the cancelled reload waiting for a navigation that never occurs.
          assert(/ERR_ABORTED|cancel|aborted|Timeout 1500ms/i.test(error.message), error.message);
        });
        const prompt = await dialog;
        assert.equal(prompt.type(), 'beforeunload');
        await prompt.dismiss();
        await reload;
        assert.equal(await page.locator('#p-name').inputValue(), '保留这次修改', 'Cancelled real refresh retains input');
      }
      await page.locator('#scenario').selectOption('ready');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#scenario').inputValue(), 'normal');
      assert.equal(await page.locator('#p-name').inputValue(), '保留这次修改');
      await page.locator('#p-name').fill('');
      assert.equal(await beforeUnload(), false, 'Reverted editor does not interrupt');
      await page.locator('#scenario').selectOption('ready');
      assert.equal(await page.locator('#scenario').inputValue(), 'ready');
      await nav('D');
      assert.equal(await beforeUnload(), false);
      await page.locator('[data-action=add-slot]').click();
      assert.equal(await beforeUnload(), true, 'Schedule edits are protected');
      await page.locator('#scenario').selectOption('guest');
      assert.equal(await page.locator('#scenario').inputValue(), 'ready');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'confirm-action');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'cancel-action');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert(await page.locator('#confirm-dialog button').evaluateAll(items => items.every(e => e.getBoundingClientRect().height >= 44)));
      await page.screenshot({ path: path.join(out, `provider-leave-${width}.png`), fullPage: true });
      await page.locator('#confirm-action').click();
      assert.equal(await page.locator('#scenario').inputValue(), 'guest');
      assert((await page.locator('#content').textContent()).includes('登录后'));
      assert.equal(await beforeUnload(), false, 'Explicit discard leaves no dirty form');
      if (width === 375) {
        await page.locator('#scenario').selectOption('ready');
        await nav('C');
        await page.locator('#p-name').fill('明确放弃后直接前往个人资料');
        await page.locator('[data-action=personal]').click();
        assert(await page.locator('#confirm-dialog').isVisible());
        await Promise.all([
          page.waitForURL('**/v05.html', { timeout: 3000 }),
          page.locator('#confirm-action').click(),
        ]);
        assert(new URL(page.url()).pathname.endsWith('/v05.html'), 'Explicit discard must not trigger a second native prompt');
      }
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ passed: true, widths: [320, 375, 414, 1280], checks: ['cancel and Escape preserve scenario and draft', 'clean/reverted editor not interrupted', 'profile and schedule beforeunload protection', 'explicit discard applies intended scenario', 'dialog focus loop and 44px buttons'] }, null, 2));
    console.log('PASS provider edit continuity');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

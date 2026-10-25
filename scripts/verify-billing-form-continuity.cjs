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
  page.setDefaultTimeout(10000);
  try {
    for (const width of [320, 375, 414, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + '/v22.html');
      await page.evaluate(() => sessionStorage.clear());
      await page.reload();
      await page.locator('[data-index=D]').click();
      const original = await page.locator('#target').inputValue();
      const options = await page.locator('#target option').evaluateAll(items => items.map(e => e.value));
      const next = options.find(value => value !== original);
      assert(next, 'The scenario must have a second eligible transaction');
      for (const amount of ['5', '0', '金额待核对']) {
        await page.locator('#amount').fill(amount);
        await page.locator('[data-index=A]').click();
        assert(await page.locator('#leave-dialog').isVisible(), 'Amount-only input must be protected');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'stay');
        await page.locator('#stay').click();
        assert.equal(await page.locator('#amount').inputValue(), amount);
      }
      await page.locator('#amount').fill('5');
      await page.locator('#reason').fill('这笔交易的金额需要核对。');
      const subject = await page.locator('#content .bill-subject').textContent();
      await page.locator('#target').selectOption(next);
      assert(await page.locator('#leave-dialog').isVisible());
      assert.equal(await page.locator('#target').inputValue(), original, 'Unconfirmed target must not appear selected');
      await page.locator('#stay').click();
      assert.equal(await page.locator('#target').inputValue(), original);
      assert.equal(await page.locator('#content .bill-subject').textContent(), subject);
      assert.equal(await page.locator('#amount').inputValue(), '5');
      assert.equal(await page.locator('#reason').inputValue(), '这笔交易的金额需要核对。');
      await page.locator('#target').selectOption(next);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#target').inputValue(), original);
      assert.equal(await page.locator('#amount').inputValue(), '5');
      await page.locator('#target').selectOption(next);
      await page.locator('#discard').click();
      assert.equal(await page.locator('#target').inputValue(), next);
      assert.notEqual(await page.locator('#content .bill-subject').textContent(), subject);
      assert.equal(await page.locator('#amount').inputValue(), '');
      assert.equal(await page.locator('#reason').inputValue(), '');
      await page.locator('#target').selectOption(original);
      assert(!(await page.locator('#leave-dialog').isVisible()), 'Empty form switches directly');
      assert.equal(await page.locator('#target').inputValue(), original);
      await page.locator('#amount').fill('5');
      await page.locator('#back').click();
      assert(await page.locator('#leave-dialog').isVisible());
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(out, 'billing-leave-' + width + '.png'), fullPage: true });
      await page.locator('#discard').click();
      assert.equal(await page.locator('#title').textContent(), '我的佣金账单');
      assert((await page.locator('#content').textContent()).includes('¥48.00'), 'No financial mutation');
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ passed: true, widths: [320, 375, 414, 1280], checks: ['amount-only, zero and invalid input protected', 'cancel and Escape retain consistent transaction and draft', 'explicit discard applies intended target without inherited draft', 'empty form switches directly', 'back protection and unchanged bill'] }, null, 2));
    console.log('PASS billing form continuity');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

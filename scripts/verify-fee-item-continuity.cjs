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
  const image = { name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9ioAAAAASUVORK5CYII=', 'base64') };
  const rows = () => page.locator('.fee-item');
  try {
    for (const width of [320, 375, 414, 1280]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(base + '/v07.html');
      await page.locator('[data-screen=I]').click();
      await page.locator('#stage-name').fill('合成材料采购与安装');
      await rows().first().locator('[data-item=name]').fill('合成配件');
      await rows().first().locator('[data-item=amount]').fill('20');
      await rows().first().locator('[data-item=note]').fill('先核对配件');
      await rows().first().locator('[data-item=type]').selectOption('expense');
      await page.locator('#evidence-0').setInputFiles(image);
      await page.locator('#advance-yes').check();
      await page.locator('#advance-limit').fill('50');
      await page.locator('[data-action=add-item]').click();
      assert(await page.locator('#advance-yes').isChecked(), 'Adding must retain advance choice');
      assert.equal(await page.locator('#advance-limit').inputValue(), '50');
      assert.equal(await page.locator('#evidence-0').evaluate(e => e.files.length), 1, 'Adding must retain evidence');
      assert.equal(await page.locator('#stage-name').inputValue(), '合成材料采购与安装');
      assert.equal(await rows().first().locator('[data-item=note]').inputValue(), '先核对配件');
      assert(await rows().nth(1).locator('[data-item=name]').evaluate(e => e === document.activeElement));
      await rows().nth(1).locator('[data-item=name]').fill('合成安装');
      await rows().nth(1).locator('[data-item=amount]').fill('10');
      await page.locator('[data-action=add-item]').click();
      await rows().nth(2).locator('[data-item=name]').fill('另一合成配件');
      await rows().nth(2).locator('[data-item=amount]').fill('5');
      await rows().nth(2).locator('[data-item=type]').selectOption('expense');
      await page.locator('#evidence-2').setInputFiles(image);
      await rows().nth(1).locator('[data-delete-item]').click();
      assert.equal(await rows().count(), 2);
      assert.equal(await rows().nth(1).locator('[data-item=name]').inputValue(), '另一合成配件');
      assert.equal(await page.locator('#evidence-1').evaluate(e => e.files.length), 1, 'Renumbering must retain the surviving file input');
      assert.equal(await page.locator('#evidence-0').evaluate(e => e.files.length), 1);
      assert(await page.locator('#advance-yes').isChecked());
      assert.equal(await page.locator('#advance-limit').inputValue(), '50');
      assert((await page.locator('#fee-subtotals').textContent()).includes('¥25.00'));
      assert(await rows().nth(1).locator('[data-item=name]').evaluate(e => e === document.activeElement));
      assert(await page.evaluate(() => {
        const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
        return ids.length === new Set(ids).size && document.documentElement.scrollWidth <= innerWidth;
      }));
      await page.screenshot({ path: path.join(out, `fee-items-${width}.png`), fullPage: true });
      await rows().nth(1).locator('[data-delete-item]').click();
      assert(await rows().first().locator('[data-delete-item]').isDisabled());
      await page.locator('[data-action=submit-fee]').click();
      assert.equal(await page.locator('#page-code').textContent(), 'V07-J');
      assert((await page.locator('#detail-content').textContent()).includes('¥20.00'));
      if (width === 375) {
        await page.goto(base + '/v07.html');
        await page.locator('[data-screen=I]').click();
        for (let n = 1; n < 20; n++) await page.locator('[data-action=add-item]').click();
        assert.equal(await rows().count(), 20);
        assert(await page.locator('[data-action=add-item]').isDisabled());
        await rows().first().locator('[data-delete-item]').click();
        assert.equal(await rows().count(), 19);
        assert(await page.locator('[data-action=add-item]').isEnabled());
        await page.locator('[data-action=add-item]').click();
        assert.equal(await rows().count(), 20);
        assert(await page.locator('[data-action=add-item]').isDisabled());
      }
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ passed: true, widths: [320, 375, 414, 1280], checks: ['add/remove retain existing evidence and advance fields', 'surviving item renumbering and unique ids', 'new/adjacent row focus', 'last row cannot be deleted', 'totals and explicit proposal submission'] }, null, 2));
    console.log('PASS fee item continuity');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

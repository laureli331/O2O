'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const { chromium } = require(process.env.PREVIEW_PLAYWRIGHT_PATH);
  const [base, out, executablePath] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath });
  const p = await browser.newPage();
  p.setDefaultTimeout(6000);
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  const action = (name, id) => p.locator(`[data-action="${name}"]${id ? `[data-id="${id}"]` : ''}`);
  const dirty = () => p.evaluate(() => {
    const e = new Event('beforeunload', { cancelable: true });
    dispatchEvent(e);
    return e.defaultPrevented;
  });
  const activeId = () => p.evaluate(() => document.activeElement.dataset.id);
  try {
    for (const width of [320, 375, 414, 1280]) {
      await p.setViewportSize({ width, height: 1000 });
      await p.goto(base + '/v09.html?page=C');
      await action('edit-address', 'A1').click();
      await p.locator('#address-note').fill('本次保存的合成地址备注');
      await action('save-address').click();
      assert.equal(await activeId(), 'A1', 'Saved address must regain focus');
      assert.equal(await p.evaluate(() => document.activeElement.dataset.action), 'edit-address');
      await action('edit-address', 'A1').click();
      const original = await p.locator('#address-note').inputValue();
      assert.equal(await dirty(), false);
      await p.locator('#address-note').fill('尚未保存的地址备注');
      assert(await dirty(), 'Address edits must protect refresh/external leave');
      await p.locator('#selection-mode').click();
      assert(await p.locator('#confirm-dialog').isVisible());
      assert(await p.locator('#toast').isHidden(), 'Old save feedback must not cover the confirmation');
      assert.equal(await p.locator('#confirm-title').textContent(), '放弃未保存的修改？');
      assert.equal(await p.locator('#cancel-action').textContent(), '继续编辑');
      assert(!(await p.locator('#selection-mode').isChecked()), 'Unconfirmed mode must remain unchanged');
      await p.locator('#cancel-action').click();
      assert.equal(await p.locator('#address-note').inputValue(), '尚未保存的地址备注');
      await p.locator('#selection-mode').click();
      await p.keyboard.press('Escape');
      assert(!(await p.locator('#selection-mode').isChecked()));
      await p.locator('#address-note').fill(original);
      assert.equal(await dirty(), false, 'Reverted address is clean');
      await p.locator('#back').click();
      assert.equal(await activeId(), 'A1');
      if (width === 375) {
        for (let i = 0; i < 6; i++) {
          await action('new-address').click();
          await p.locator('#address-name').fill('合成联系人' + i);
          await p.locator('#address-phone').fill('13800003040');
          await p.locator('#address-region').selectOption('演示社区');
          await p.locator('#address-detail').fill('合成长列表地址' + i);
          await action('save-address').click();
          const lastId = await p.locator('.address-card').last().getAttribute('data-record');
          assert.equal(await activeId(), lastId);
        }
        assert(await p.locator('#tool-scroll').evaluate(e => e.scrollTop > 0));
      }
      await action('new-address').click();
      await action('save-address').click();
      assert(await p.locator('#form-error').isVisible());
      await p.locator('#address-name').fill('无效表单也应保护');
      assert(await dirty());
      await p.locator('#selection-mode').click();
      assert(await p.locator('#confirm-dialog').isVisible());
      assert(await p.locator('#confirm-dialog button').evaluateAll(items => items.every(e => e.getBoundingClientRect().height >= 44)));
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await p.screenshot({ path: path.join(out, `address-leave-${width}.png`), fullPage: true });
      await p.locator('#confirm-action').click();
      assert(await p.locator('#selection-mode').isChecked());
      assert.equal(await p.locator('#page-title').textContent(), '选择私人地址');
      assert.equal(await dirty(), false);
      assert(!(await p.locator('#content').textContent()).includes('无效表单也应保护'));
      await action('new-address').click();
      await p.locator('#back').click();
      assert.equal(await p.evaluate(() => document.activeElement.dataset.action), 'new-address');
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ passed: true, widths: [320, 375, 414, 1280], checks: ['saved/returned address focus', 'new record visible in long list', 'cancel/Escape retain selection mode and edit', 'clean/reverted versus dirty beforeunload', 'invalid input remains protected', 'explicit discard switches without saving'] }, null, 2));
    console.log('PASS address edit continuity');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

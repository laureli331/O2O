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
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  const nav = code => p.locator(`[data-screen=${code}]`).click();
  const action = name => p.locator(`[data-action=${name}]`);
  const isDirty = () => p.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    dispatchEvent(event);
    return event.defaultPrevented;
  });
  try {
    for (const width of [320, 375, 414, 1280]) {
      await p.setViewportSize({ width, height: 1000 });
      await p.goto(base + '/v07.html');
      await nav('M');
      await p.locator('#cancel-reason').fill('未提交的取消说明，应该保留。');
      await p.locator('#detail-phone .back').click();
      assert(await p.locator('#order-sheet').isVisible(), 'Back must protect unsubmitted cancellation');
      assert.equal(await p.evaluate(() => document.activeElement.dataset.action), 'keep-filling');
      await action('keep-filling').click();
      assert.equal(await p.locator('#cancel-reason').inputValue(), '未提交的取消说明，应该保留。');
      assert(await isDirty());
      const oldRole = await p.locator('#role').inputValue();
      await p.locator('#role').selectOption('requester');
      assert.equal(await p.locator('#role').inputValue(), oldRole);
      await p.keyboard.press('Escape');
      assert.equal(await p.locator('#cancel-reason').inputValue(), '未提交的取消说明，应该保留。');
      await p.locator('#scenario').selectOption('cancelled');
      assert.equal(await p.locator('#scenario').inputValue(), 'active');
      await action('keep-filling').click();
      await p.locator('#reset').click();
      await p.keyboard.press('Shift+Tab');
      assert.equal(await p.evaluate(() => document.activeElement.dataset.action), 'discard-filling');
      await p.keyboard.press('Tab');
      assert.equal(await p.evaluate(() => document.activeElement.dataset.action), 'keep-filling');
      assert(await p.locator('#order-menu button').evaluateAll(items => items.every(e => e.getBoundingClientRect().height >= 44)));
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await p.screenshot({ path: path.join(out, `order-leave-${width}.png`), fullPage: true });
      await action('keep-filling').click();
      await p.locator('#cancel-reason').fill('');
      assert.equal(await isDirty(), false, 'Reverted form is clean');
      if (width === 375) {
        await p.locator('#attachments').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9ioAAAAASUVORK5CYII=', 'base64') });
        await nav('B');
        await action('keep-filling').click();
        assert.equal(await p.locator('#attachments').evaluate(e => e.files.length), 1, 'Image-only input is protected');
        await action('submit-cancel').click();
        assert(await p.locator('#form-error').isVisible());
        assert(await isDirty(), 'Failed validation does not clear protection');
        await nav('N');
        await action('discard-filling').click();
      }
      await nav('N');
      await p.locator('#dispute-reason').fill('尚未提交的异议');
      await nav('B');
      await action('discard-filling').click();
      assert.equal(await p.locator('#page-code').textContent(), 'V07-B');
      assert(!(await p.locator('#detail-content').textContent()).includes('有交付异议'));
      await nav('I');
      await p.locator('[data-item=name]').fill('未提交费用');
      await nav('H');
      await action('keep-filling').click();
      assert.equal(await p.locator('[data-item=name]').inputValue(), '未提交费用');
      await p.locator('[data-item=amount]').fill('20');
      await action('submit-fee').click();
      assert.equal(await p.locator('#page-code').textContent(), 'V07-J', 'Explicit successful submit proceeds directly');
      assert(await p.locator('#order-sheet').isHidden());
      assert.equal(await isDirty(), false);
      await nav('M');
      await p.locator('#cancel-reason').fill('切换角色前明确放弃');
      await p.locator('#role').selectOption('requester');
      await action('discard-filling').click();
      assert.equal(await p.locator('#role').inputValue(), 'requester');
      assert.equal(await p.locator('#cancel-reason').inputValue(), '');
      if (width === 375) {
        await p.locator('#scenario').selectOption('unconfirmed');
        await nav('D');
        await p.locator('#buyer-time').fill('2026-10-22T09:00');
        assert(await isDirty());
        await action('buyer-time').click();
        assert.equal(await isDirty(), false, 'Accepted buyer time establishes a clean baseline');
        await nav('F');
        assert(await p.locator('#order-sheet').isHidden());
      }
    }
    await p.goto(base + '/v07.html?focus=order&from=services&kind=' + encodeURIComponent('维修') + '&role=provider&page=M');
    await p.locator('#cancel-reason').fill('从服务页进入的未提交说明');
    await p.locator('#detail-phone .back').click();
    await action('keep-filling').click();
    assert.equal(await p.locator('#cancel-reason').inputValue(), '从服务页进入的未提交说明');
    await p.locator('#detail-phone .back').click();
    await action('discard-filling').click();
    assert.equal(await p.locator('#page-code').textContent(), 'V07-B');
    await Promise.all([
      p.waitForURL('**/services.html*', { timeout: 3000 }),
      p.locator('#detail-phone .back').click(),
    ]);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ passed: true, widths: [320, 375, 414, 1280], checks: ['back and role/scenario/reset protection', 'continue and Escape preserve input', 'reverted form clean', 'discard does not submit dispute', 'fee submit bypasses leave prompt after success', '44px buttons and focus loop'] }, null, 2));
    console.log('PASS order form leave protection');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

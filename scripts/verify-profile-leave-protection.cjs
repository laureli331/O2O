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
  const dirty = () => p.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    dispatchEvent(event);
    return event.defaultPrevented;
  });
  const keep = () => p.locator('#profile-keep').click();
  try {
    for (const width of [320, 375, 414, 1280]) {
      await p.setViewportSize({ width, height: 1000 });
      await p.goto(base + '/v05.html');
      await p.locator('[data-screen=D]').click();
      assert.equal(await dirty(), false);
      await p.locator('#nickname').fill('未保存的合成修改');
      await p.locator('#detail-back').click();
      assert(await p.locator('#profile-leave').isVisible(), 'Profile back must not silently discard input');
      assert.equal(await p.evaluate(() => document.activeElement.id), 'profile-keep');
      assert(await p.locator('#my-phone').evaluate(e => e.inert));
      await keep();
      assert.equal(await p.locator('#nickname').inputValue(), '未保存的合成修改');
      assert(await dirty());
      if (width === 375) {
        const prompt = p.waitForEvent('dialog');
        const reload = p.reload({ timeout: 1500 }).catch(error => {
          // Edge may keep waiting for a navigation after the user cancels it.
          assert(/ERR_ABORTED|cancel|aborted|Timeout 1500ms/i.test(error.message), error.message);
        });
        const dialog = await prompt;
        assert.equal(dialog.type(), 'beforeunload');
        await dialog.dismiss();
        await reload;
        assert.equal(await p.locator('#nickname').inputValue(), '未保存的合成修改');
      }
      await p.locator('[data-screen=settings]').click();
      await p.keyboard.press('Escape');
      assert.equal(await p.locator('#nickname').inputValue(), '未保存的合成修改');
      assert(!(await p.locator('#my-phone').evaluate(e => e.inert)));
      if (width === 375) {
        await p.locator('#detail-back').click();
        await p.locator('#profile-leave').click({ position: { x: 30, y: 40 } });
        assert.equal(await p.locator('#nickname').inputValue(), '未保存的合成修改');
        assert(await p.locator('#profile-leave').isHidden());
      }
      await p.locator('#scenario').selectOption('guest');
      assert.equal(await p.locator('#scenario').inputValue(), 'pending');
      await p.keyboard.press('Shift+Tab');
      assert.equal(await p.evaluate(() => document.activeElement.id), 'profile-discard');
      await p.keyboard.press('Tab');
      assert.equal(await p.evaluate(() => document.activeElement.id), 'profile-keep');
      assert(await p.locator('#profile-leave button').evaluateAll(items => items.every(e => e.getBoundingClientRect().height >= 44)));
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await p.screenshot({ path: path.join(out, `profile-leave-${width}.png`), fullPage: true });
      await keep();
      await p.locator('#nickname').fill('演示用户');
      assert.equal(await dirty(), false);
      await p.locator('#detail-back').click();
      assert(await p.locator('#profile-leave').isHidden());
      await p.locator('[data-screen=D]').click();
      await p.locator('#wechat').fill('synthetic_change');
      await p.locator('#save-profile').click();
      assert(await p.locator('#confirm-profile-change').isVisible());
      assert(await p.locator('#profile-leave').isHidden(), 'Saving enters only the existing contact confirmation');
      await p.locator('#detail-back').click();
      assert.equal(await p.locator('#wechat').inputValue(), 'synthetic_change');
      assert(await p.locator('#profile-leave').isHidden());
      await p.locator('#profile-form [data-open=phone]').click();
      assert(await p.locator('#profile-leave').isHidden());
      await p.locator('[data-screen=E]').click();
      await keep();
      assert(await p.locator('#phone-consent').isVisible());
      await p.locator('#return-profile-draft').click();
      assert.equal(await p.locator('#wechat').inputValue(), 'synthetic_change');
      await p.locator('[data-screen=settings]').click();
      await p.locator('#profile-discard').click();
      assert.equal(await p.locator('#detail-title').textContent(), '设置');
      assert.equal(await dirty(), false);
      await p.locator('[data-screen=D]').click();
      assert.equal(await p.locator('#wechat').inputValue(), '');
      await p.locator('#nickname').fill('明确保存的合成昵称');
      await p.locator('#save-profile').click();
      assert.equal(await dirty(), false);
      assert.equal(await p.locator('#my-phone .profile-name').textContent(), '明确保存的合成昵称');
      await p.locator('#nickname').fill('外部跳转前放弃');
      await p.locator('#my-phone [data-private=addresses]').click();
      await Promise.all([
        p.waitForURL('**/v09.html?page=C', { timeout: 3000 }),
        p.locator('#profile-discard').click(),
      ]);
      if (width === 375) {
        await p.goto(base + '/v05.html');
        await p.locator('[data-screen=D]').click();
        await p.locator('#nickname').fill('放弃后切换演示');
        await p.locator('#scenario').selectOption('guest');
        await p.locator('#profile-discard').click();
        assert.equal(await p.locator('#scenario').inputValue(), 'guest');
        assert(await p.locator('#login-button').isVisible());
        assert.equal(await dirty(), false);
      }
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ passed: true, widths: [320, 375, 414, 1280], checks: ['dirty profile navigation and scenario protection', 'clean/reverted/saved do not interrupt', 'child returns preserve draft without redundant prompt', 'discard leaves saved model unchanged', 'external navigation has no second prompt', 'inert background, focus trap and touch targets'] }, null, 2));
    console.log('PASS profile leave protection');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

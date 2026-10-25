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
  async function assertDraft() {
    assert.equal(await p.locator('#nickname').inputValue(), '未保存的合成昵称');
    assert.equal(await p.locator('#wechat').inputValue(), 'synthetic_contact');
    assert.equal(await p.locator('#my-phone .profile-name').textContent(), '演示用户', 'Returning must not save the profile');
  }
  try {
    for (const width of [320, 375, 414, 1280]) {
      await p.setViewportSize({ width, height: 1000 });
      await p.goto(base + '/v05.html');
      await p.locator('[data-screen=D]').click();
      await p.locator('#nickname').fill('未保存的合成昵称');
      await p.locator('#wechat').fill('synthetic_contact');
      await p.locator('#save-profile').scrollIntoViewIfNeeded();
      const editorOffset = await p.locator('#detail-scroll').evaluate(e => e.scrollTop);
      await p.locator('#save-profile').click();
      assert(await p.locator('#confirm-profile-change').isVisible());
      await p.locator('#detail-back').click();
      assert.equal(await p.locator('#detail-code').textContent(), 'V05-D', 'Top back must resume profile editing');
      await assertDraft();
      assert.equal(await p.locator('#detail-scroll').evaluate(e => e.scrollTop), editorOffset);
      assert.equal(await p.evaluate(() => document.activeElement.id), 'save-profile');
      await p.locator('#save-profile').click();
      await p.locator('#cancel-profile-change').click();
      await assertDraft();
      await p.locator('#profile-form [data-open=phone]').click();
      assert(await p.locator('#phone-consent').isVisible());
      assert.equal(await p.locator('#return-profile-draft').textContent(), '返回个人资料');
      await p.locator('#detail-back').click();
      await assertDraft();
      assert(await p.locator('#profile-form [data-open=phone]').evaluate(e => e === document.activeElement));
      await p.locator('#profile-form [data-open=phone]').click();
      await p.locator('#verify-phone').click();
      assert(await p.locator('#phone-error').isVisible());
      await p.locator('#return-profile-draft').click();
      await assertDraft();
      await p.locator('#profile-form [data-open=phone]').click();
      await p.locator('#phone-consent').check();
      await p.locator('#verify-phone').click();
      await assertDraft();
      assert((await p.locator('#profile-form').textContent()).includes('微信手机号已验证'));
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await p.screenshot({ path: path.join(out, `profile-resume-${width}.png`), fullPage: true });
      await p.locator('#save-profile').click();
      await p.locator('#confirm-profile-change').click();
      assert.equal(await p.locator('#my-phone .profile-name').textContent(), '未保存的合成昵称');
      assert.equal(await p.locator('#wechat').inputValue(), 'synthetic_contact');
      if (width === 375) {
        await p.goto(base + '/v05.html');
        await p.locator('#scenario').selectOption('unavailable');
        await p.locator('[data-screen=D]').click();
        await p.locator('#nickname').fill('未保存的合成昵称');
        await p.locator('#wechat').fill('synthetic_contact');
        await p.locator('#profile-form [data-open=phone]').click();
        await p.locator('#phone-consent').check();
        await p.locator('#verify-phone').click();
        assert((await p.locator('#phone-error').textContent()).includes('稍后再验证'));
        await p.locator('#return-profile-draft').click();
        await assertDraft();
      }
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ passed: true, widths: [320, 375, 414, 1280], checks: ['top and footer back resume contact-change draft', 'phone cancel and missing-consent return preserve draft', 'successful phone verification returns without profile save', 'only explicit contact confirmation saves profile', 'focus and mobile overflow'] }, null, 2));
    console.log('PASS profile return continuity');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

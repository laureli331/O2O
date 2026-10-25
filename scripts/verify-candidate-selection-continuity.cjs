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
  const radio = id => p.locator(`input[name=candidate][value="${id}"]`);
  const focused = id => radio(id).evaluate(e => e === document.activeElement);
  try {
    for (const width of [320, 375, 414, 1280]) {
      await p.setViewportSize({ width, height: 1000 });
      await p.goto(base + '/v03.html');
      const originalNode = await radio('b').elementHandle();
      await radio('b').scrollIntoViewIfNeeded();
      const scroll = await p.locator('#publisher-scroll').evaluate(e => e.scrollTop);
      const outer = await p.evaluate(() => scrollY);
      await radio('b').check();
      assert(await focused('b'), 'Choosing a candidate must retain keyboard focus');
      assert(await originalNode.evaluate(e => e.isConnected), 'Choosing must not rebuild the candidate list');
      assert.equal(await p.locator('#publisher-scroll').evaluate(e => e.scrollTop), scroll);
      assert(Math.abs(await p.evaluate(() => scrollY) - outer) <= 2);
      assert((await p.locator('#selection-caption').textContent()).includes('演示用户 B'));
      assert((await p.locator('#selection-caption').textContent()).includes('尚未正式承接'));
      assert.equal(await p.locator('#selection-caption').getAttribute('role'), 'status');
      await p.keyboard.press('ArrowUp');
      assert(await radio('a').isChecked());
      assert(await focused('a'));
      await p.keyboard.press('ArrowDown');
      assert(await radio('b').isChecked());
      assert(await focused('b'));
      await p.keyboard.press('ArrowDown');
      assert(await radio('a').isChecked(), 'Disabled candidate C is skipped');
      assert.equal(await p.locator('input[name=candidate]:checked').count(), 1);
      await radio('b').check();
      await p.locator('#open-confirm').click();
      assert((await p.locator('#confirm-summary').textContent()).includes('演示用户 B'));
      await p.keyboard.press('Escape');
      assert.equal(await p.evaluate(() => document.activeElement.id), 'open-confirm');
      assert(await radio('b').isChecked());
      await p.locator('[data-review=b]').click();
      await p.keyboard.press('Escape');
      assert(await p.locator('[data-review=b]').evaluate(e => e === document.activeElement));
      assert(await radio('b').isChecked());
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await p.screenshot({ path: path.join(out, `candidate-selection-${width}.png`), fullPage: true });
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ passed: true, widths: [320, 375, 414, 1280], checks: ['selection retains DOM, focus and both scroll positions', 'native arrow navigation with disabled candidate skipped', 'one selected candidate, still tentative', 'summary and review modal cancellation retain choice/focus', 'polite status announcement and mobile overflow'] }, null, 2));
    console.log('PASS candidate selection continuity');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

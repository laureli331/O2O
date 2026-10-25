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
  try {
    for (const width of [320, 375, 414, 1280]) {
      await p.setViewportSize({ width, height: 1100 });
      await p.goto(base + '/v04.html');
      await p.locator('#f-title').fill('原提交的合成跑腿需求');
      await p.locator('#save-draft').click();
      await p.locator('[data-screen=A]').click();
      await p.locator('[data-action=drafts]').click();
      const restore = await p.locator('[data-restore="0"]').elementHandle();
      await p.locator('[data-screen=A]').click();
      await p.locator('[data-action=sources]').click();
      const copy = await p.locator('[data-source]').first().elementHandle();
      await p.locator('#scenario').selectOption('unknown');
      await p.locator('#review-button').click();
      await p.locator('#confirm-publish').click();
      await p.locator('[data-screen=B]').click();
      assert.equal(await p.locator('#form-title').textContent(), '发布跑腿需求', 'Pending request must not be replaced by another business');
      assert(await p.locator('#query-result').isVisible());
      assert.equal(await p.locator('#f-title').inputValue(), '原提交的合成跑腿需求');
      assert(await p.locator('#f-title').isDisabled());
      assert(await p.locator('#image-input').isDisabled());
      assert(await p.locator('#open-ai').isDisabled());
      assert(await p.locator('#save-draft').isDisabled());
      // Reattach old controls to ensure delegated restore/copy routes cannot clear pending state.
      await p.evaluate(([restore, copy]) => { document.querySelector('#flow-content').append(restore, copy); }, [restore, copy]);
      await p.locator('[data-restore="0"]').click();
      assert(await p.locator('#query-result').isVisible());
      await p.evaluate(copy => document.querySelector('#flow-content').append(copy), copy);
      await p.locator('[data-source]').first().click();
      assert(await p.locator('#query-result').isVisible());
      await p.locator('#scenario').selectOption('normal');
      assert.equal(await p.locator('#scenario').inputValue(), 'unknown');
      await p.locator('#flow-back').click();
      assert(await p.locator('#query-result').isVisible());
      await p.locator('#review-button').click();
      assert.equal(await p.locator('#confirm-publish').count(), 0);
      assert((await p.locator('#flow-content').textContent()).includes('原提交的合成跑腿需求'));
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert(await p.locator('#query-result').evaluate(e => e.getBoundingClientRect().height >= 44));
      await p.screenshot({ path: path.join(out, `publish-pending-${width}.png`), fullPage: true });
      await p.locator('#query-result').click();
      assert.equal(await p.locator('#flow-title').textContent(), '演示：已发布');
      assert((await p.locator('#flow-content').textContent()).includes('原提交的合成跑腿需求'));
      assert(await p.locator('#f-title').isEnabled());
      assert(await p.locator('#open-ai').isEnabled());
      await p.locator('#f-title').fill('查询后明确修改的内容');
      await p.locator('#review-button').click();
      assert.equal(await p.locator('#flow-title').textContent(), '发布前核对');
      assert((await p.locator('#public-review').textContent()).includes('查询后明确修改'));
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ passed: true, widths: [320, 375, 414, 1280], checks: ['pending business and scenario cannot be replaced', 'read-only form with original title', 'stale restore/copy controls cannot clear pending', 'back/review retain original query', 'query unlocks form and later edits require recheck', 'mobile query button and overflow'] }, null, 2));
    console.log('PASS publish pending continuity');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

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
  const png = { name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9ioAAAAASUVORK5CYII=', 'base64') };
  const review = () => p.locator('#review-button').click();
  async function publish() {
    await review();
    assert.equal(await p.locator('#flow-title').textContent(), '发布前核对');
    await p.locator('#confirm-publish').click();
    assert.equal(await p.locator('#flow-title').textContent(), '演示：已发布');
  }
  try {
    for (const width of [320, 375, 414, 1280]) {
      await p.setViewportSize({ width, height: 1100 });
      await p.goto(base + '/v04.html?mode=review');
      await publish();
      await p.locator('#image-input').setInputFiles(png);
      assert.equal(await p.locator('#flow-title').textContent(), '请重新核对');
      await review();
      assert.equal(await p.locator('#flow-title').textContent(), '发布前核对', 'New image must not inherit old published result');
      assert.equal(await p.locator('#public-review img').count(), 1);
      await p.locator('#confirm-publish').click();
      await p.locator('[data-remove-image="0"]').click();
      await publish();
      await p.locator('[data-address=delivery]').click();
      await p.locator('[data-pick-address="1"]').click();
      await review();
      assert.equal(await p.locator('#flow-title').textContent(), '发布前核对');
      assert((await p.locator('#private-review').textContent()).includes('合成送达点2'));
      assert(!(await p.locator('#public-review').textContent()).includes('合成送达点2'));
      await p.locator('#confirm-publish').click();
      await p.locator('#image-input').setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('synthetic') });
      await review();
      assert.equal(await p.locator('#flow-title').textContent(), '演示：已发布', 'Rejected image must not invalidate unchanged content');
      await p.locator('#image-input').setInputFiles([]);
      await review();
      assert.equal(await p.locator('#flow-title').textContent(), '演示：已发布', 'Empty selection is not an edit');
      await p.locator('#open-ai').click();
      await p.locator('[data-action=ai-sample]').click();
      await p.locator('#run-ai').click();
      await p.locator('[data-adopt=note]').check();
      await p.locator('[data-candidate=note]').fill('本次AI核对后修改的合成需求说明。');
      await p.locator('#adopt-ai').click();
      await review();
      assert.equal(await p.locator('#flow-title').textContent(), '发布前核对');
      assert((await p.locator('#public-review').textContent()).includes('本次AI核对后修改'));
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await p.screenshot({ path: path.join(out, `publish-recheck-${width}.png`), fullPage: true });
      await p.locator('#confirm-publish').click();
      assert.equal(await p.locator('#flow-title').textContent(), '演示：已发布');
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ passed: true, widths: [320, 375, 414, 1280], checks: ['accepted image addition/removal invalidates prior result', 'selected address is private and requires recheck', 'AI adoption requires explicit publish', 'rejected and cancelled image do not invalidate result'] }, null, 2));
    console.log('PASS publish result invalidation');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

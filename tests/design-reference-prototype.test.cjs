'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const repo = path.resolve(__dirname, '..');
const folder = 'assets/ui/design-reference-20261009';
const read = relative => fs.readFileSync(path.join(repo, relative), 'utf8');
const expectedPages = ['首页', '维修详情', '跑腿选人', '二手列表', '三维评分', '我的', 'AI发布助手', '运营看板'];

function validateManifest(manifest) {
  assert.equal(manifest.status, 'visual-reference-not-product-implementation');
  assert.equal(manifest.sourceDocument, 'design.md');
  assert.equal(manifest.assetPolicy, 'image-placeholders-and-generic-avatar-placeholders');
  assert.equal(manifest.method, 'built-in-imagegen');
  assert.deepEqual(manifest.pages, expectedPages);
  assert.equal(manifest.image, `${folder}/overview.png`);
  assert.match(manifest.sha256, /^[a-f0-9]{64}$/);
  assert(manifest.width >= 1000 && manifest.height >= 1000);
  assert.equal(manifest.currentApprovedSelectionChanged, false);
  assert.equal(manifest.originalAssetsChanged, false);
}

test('prototype is an isolated eight-page image reference with placeholder assets', () => {
  const manifest = JSON.parse(read(`${folder}/manifest.json`));
  validateManifest(manifest);
  assert(fs.existsSync(path.join(repo, manifest.sourceDocument)));
  const bytes = fs.readFileSync(path.join(repo, manifest.image));
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16), manifest.width);
  assert.equal(bytes.readUInt32BE(20), manifest.height);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), manifest.sha256);
  const selected = JSON.parse(read('assets/ui/approved-selection.json'));
  const oldImage = fs.readFileSync(path.join(repo, 'assets/ui', selected.image));
  assert.equal(crypto.createHash('sha256').update(oldImage).digest('hex').toUpperCase(), selected.imageSha256);
});

test('generation instructions preserve placeholder requirements and key task boundaries', () => {
  const prompt = read(`${folder}/generation-prompt.txt`);
  for (const phrase of ['图片占位', '138****0000', '双方直接结算', 'FIVE EMPTY OUTLINE stars', 'NOT a chat page', '确认后再提交', '仅运营者可见']) assert(prompt.includes(phrase), `Missing constraint: ${phrase}`);
  for (const color of Object.values(JSON.parse(read('assets/ui/v2/design-tokens.json')).palette)) assert(prompt.includes(color));
  assert(read(`${folder}/README.md`).includes('未替换已采用'));
});

test('manifest validation rejects scope drift, replaced assets and false implementation claims', () => {
  const original = JSON.parse(read(`${folder}/manifest.json`));
  for (const mutation of [m => m.pages.pop(), m => m.assetPolicy = 'photographs', m => m.image = 'assets/ui/v2/overview.png', m => m.originalAssetsChanged = true, m => m.status = 'implemented']) {
    const changed = structuredClone(original);
    mutation(changed);
    assert.throws(() => validateManifest(changed));
  }
});

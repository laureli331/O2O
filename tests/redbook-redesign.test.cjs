'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const folder = 'assets/ui/redbook-redesign-20261009';
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex');
function validate(m) {
  assert.equal(m.status, 'new-visual-proposal-not-adopted');
  assert.equal(m.legacyVisualRulesUsed, false);
  assert.equal(m.visualSource, 'redbook');
  assert.equal(m.oldDocumentsModified, false);
  assert.equal(m.image, `${folder}/overview.png`);
  assert.deepEqual(m.pages, ['首页','维修详情','跑腿选人','二手列表','三维评分','我的','AI发布助手','运营看板']);
  assert.equal(m.photos, 'placeholders');
  assert.equal(m.sourceMaterials.length, 17);
  assert(m.sourceMaterials.every(s => s.path.startsWith('redbook/')));
}
test('redesign uses local redbook sources and stays isolated from earlier prototypes', () => {
  const m = JSON.parse(read(`${folder}/manifest.json`)); validate(m);
  assert.equal(hash(m.image), m.sha256);
  const bytes = fs.readFileSync(path.join(root, m.image));
  assert.equal(bytes.subarray(0,8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16), m.width);
  assert.equal(bytes.readUInt32BE(20), m.height);
  for (const source of m.sourceMaterials) assert.equal(hash(source.path), source.sha256);
  assert.notEqual(m.sha256, hash('assets/ui/design-reference-20261009/overview.png'));
});
test('prompt requires a new composition, silver-blue style, placeholders and task boundaries', () => {
  const prompt = read(`${folder}/generation-prompt.txt`);
  for (const text of ['Recompose every screen from scratch', 'white/pearl/silver', 'No leaves', '图片占位', '138****0000', '双方直接结算', 'FIVE EMPTY OUTLINE STARS', '不会自动发布', '仅运营者可见']) assert(prompt.includes(text), `Missing requirement: ${text}`);
  assert(!prompt.includes('#618872'));
  assert(!prompt.includes('assets/ui/v2'));
});
test('validation rejects old-style inheritance, wrong destination, real photos and false adoption', () => {
  const m = JSON.parse(read(`${folder}/manifest.json`));
  for (const mutate of [x => x.legacyVisualRulesUsed = true, x => x.image = 'assets/ui/v2/overview.png', x => x.photos = 'photographs', x => x.status = 'adopted', x => x.sourceMaterials.pop()]) {
    const copy = structuredClone(m); mutate(copy); assert.throws(() => validate(copy));
  }
});

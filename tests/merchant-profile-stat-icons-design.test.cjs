const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const specPath = path.join(
  __dirname,
  '..',
  'docs',
  'superpowers',
  'specs',
  '2026-10-20-merchant-profile-stat-icons-design.md',
);

test('merchant profile stat icon design records the approved icon semantics', () => {
  const spec = fs.readFileSync(specPath, 'utf8');

  for (const phrase of [
    '帖子：新增内容卡片图标',
    '订阅：新增铃铛图标',
    '收藏：复用现有星形 `icon-star`',
    '`icon-post.svg`',
    '`icon-post-green.svg`',
    '`icon-subscribe.svg`',
    '`icon-subscribe-green.svg`',
  ]) assert.ok(spec.includes(phrase), phrase);
});

test('merchant profile stat icon design keeps HTML and behavior out of scope', () => {
  const spec = fs.readFileSync(specPath, 'utf8');

  for (const phrase of [
    '不修改 `previews/v06.html` 或其他页面',
    '不把图标接入任何按钮、统计项或导航',
    '不修改收藏、订阅或帖子相关业务逻辑',
    '不新增心形收藏图标',
  ]) assert.ok(spec.includes(phrase), phrase);

  assert.doesNotMatch(spec, /\b(?:TODO|TBD)\b/);
});

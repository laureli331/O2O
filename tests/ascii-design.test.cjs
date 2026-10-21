'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(path.join(root, file)));
const file = 'docs/ascii-design-prd-2.1.md';
const document = read(file);
const prd = read('docs/prd.md');
const counts = [2, 4, 4, 9, 5, 3, 19, 2, 4, 4, 1, 1, 1, 5, 5, 3, 3, 4, 2, 3, 3, 10, 10];
const expected = counts.flatMap((n, i) => Array.from({ length: n }, (_, j) => `V${String(i + 1).padStart(2, '0')}-${String.fromCharCode(65 + j)}`));
const common = ['G01', 'G02', 'G03', 'G04'];
const cases = [...prd.matchAll(/^\| ((?:T|BX|RT|AT|DT)\d{2}) \|/gm)].map(m => m[1]).sort();

function validate(text) {
  const groups = [...text.matchAll(/^## (V\d{2}) /gm)].map(m => m[1]);
  assert.deepEqual(groups, Array.from({ length: 23 }, (_, i) => `V${String(i + 1).padStart(2, '0')}`), 'all PRD page groups in order');
  const headings = [...text.matchAll(/^### ((?:V\d{2}-[A-Z])|(?:G\d{2})) /gm)].map(m => m[1]);
  assert.deepEqual(headings, [...expected, ...common], 'every reviewed subpage and shared state has its own drawing');
  assert.equal((text.match(/^```/gm) || []).length % 2, 0, 'paired fences');
  for (const id of headings) {
    const heading = text.indexOf('### ' + id + ' ');
    const next = text.indexOf('\n### ', heading + 1);
    const section = text.slice(heading, next === -1 ? undefined : next);
    assert.match(section, /```text\n\+-+\+\n\|[\s\S]*?\n\+-+\+\n```/, id + ' has a closed ASCII screen');
  }
  const mapped = [...text.matchAll(/^\| ((?:T|BX|RT|AT|DT)\d{2}) \| ([^\n]+) \|$/gm)];
  assert.equal(cases.length, 82, 'source acceptance inventory');
  assert.deepEqual(mapped.map(m => m[1]).sort(), cases, 'exact acceptance coverage without duplicates');
  const known = new Set(headings);
  for (const row of mapped) {
    const refs = row[2].match(/V\d{2}-[A-Z]|G\d{2}/g) || [];
    assert(refs.length > 0, row[1] + ' maps to a drawing');
    for (const id of refs) assert(known.has(id), row[1] + ' unknown screen ' + id);
  }
  const matrix = [...text.matchAll(/^\| (V\d{2}) \| ([^\n]+) \| ([^\n]+) \|$/gm)];
  assert.equal(matrix.length, 23, '23 page-group coverage rows');
  for (const row of matrix) {
    assert.deepEqual(row[2].match(/V\d{2}-[A-Z]/g), expected.filter(id => id.startsWith(row[1] + '-')), row[1] + ' matrix matches drawings');
  }
  return true;
}

test('ASCII design covers every PRD group, all subpages, shared surfaces and 82 current acceptance cases', () => assert.equal(validate(document), true));
test('coverage rejects missing group, missing drawing, removed acceptance or broken target', () => {
  for (const changed of [
    document.replace(/^## V23 .+$/m, ''),
    document.replace(/^### V07-R .+$/m, ''),
    document.replace(/^\| BX17 \|.+\n/m, ''),
    document.replace(/^\| BX17 \|.+$/m, '| BX17 | V99-A |'),
    document.replace(/(### V01-A[\s\S]*?```text\n)\+/, '$1!'),
  ]) assert.throws(() => validate(changed));
});

test('local source links resolve and every ASCII screen has aligned outer borders', () => {
  for (const match of document.matchAll(/\]\(([^)]+)\)/g)) {
    assert(fs.existsSync(path.resolve(root, 'docs', match[1].split('#')[0])), match[1]);
  }
  const width = value => [...value].reduce((n, c) => n + (/[^\x00-\x7f\u00a0-\u024f\u2000-\u206f]/u.test(c) ? 2 : 1), 0);
  for (const block of document.matchAll(/```text\n(.*?)\n```/gs)) {
    const lines = block[1].split('\n');
    if (!lines[0].startsWith('+-')) continue;
    const expectedWidth = lines[0].length;
    for (const line of lines) assert.equal(width(line), expectedWidth, line);
  }
});

test('current completion, permission, finance and deferred-scope boundaries stay visible', () => {
  for (const phrase of [
    '无接单员“提交完成/已办完”', '客户“确认完成/收到”',
    '联系获准仍打码', 'max(有效到期,恢复成功+24小时)',
    '首次补费申报截止', '特定窗口普通改价', '部分缴纳不重置剩余期限',
    '旧理由材料重复不重停', '只争议部分暂缓', '不建0元支付',
    '核准抵扣分开', '多收待核对', '不恢复地址/旧凭据',
    '八组', '无全站混合总分', 'AG01前无真实模型', 'DG01前仅合成演示',
    'V11 商家Banner投放方向（延后记录）', 'VP01', 'VP02', 'VP03', 'VP04', 'VP05',
  ]) assert(document.includes(phrase), phrase);
  // No manual completion action may appear as a button in a drawing.
  for (const action of document.matchAll(/\[([^\]\n]+)\]/g)) {
    assert(!/^(提交完成|已办完|确认完成|确认收到|收到)$/.test(action[1]), action[1]);
  }
});

function screen(id) {
  const start = document.indexOf('### ' + id + ' ');
  assert(start >= 0, id);
  const end = document.indexOf('\n### ', start + 1);
  const section = document.slice(start, end < 0 ? undefined : end);
  return section.match(/```text\n([\s\S]*?)\n```/)[1];
}

test('homepage and search share explicit multi-category filtering without a redundant section heading', () => {
  const home = screen('V01-A');
  assert(!home.includes('最新需求'));
  for (const category of ['维修', '跑腿', '闲置', '其它']) assert(home.includes('[ ]' + category));
  assert(screen('V01-B').includes('分类多选'));
  for (const source of [prd, read('docs/structured-design.md')]) {
    for (const term of ['多选', '按“或”匹配', '关键词', '村社区', '点击“全部”清除分类勾选', '全部取消勾选']) {
      assert(source.includes(term), term);
    }
  }
  assert(document.includes('首页与搜索使用同一规则'));
  assert(home.includes('以下两行滚动吸顶'));
  assert(home.includes('[维修] 图片标签'));
  assert(home.includes('[跑腿] 图片标签'));
  assert(home.includes('最新发布'));
  assert(!home.includes('[最新 v]'));
  assert(screen('V01-B').includes('双列瀑布流结果'));
  assert(!screen('V01-B').includes('[最新]'));
});

test('public contact rows and review links remain separate on every affected detail page', () => {
  for (const id of ['V02-A', 'V02-B', 'V02-C', 'V02-D', 'V10-B']) {
    const lines = screen(id).split('\n');
    const phone = lines.findIndex(line => line.includes('电话：'));
    const wechat = lines.findIndex(line => line.includes('微信：'));
    assert(phone >= 0 && wechat === phone + 1, id + ' phone and WeChat use adjacent separate rows');
    assert(!lines[phone].includes('微信：'), id);
    if (id !== 'V10-B') {
      const review = lines.findIndex(line => /\[(?:对方的评价|卖方评价) >\]/.test(line));
      assert.equal(review, wechat + 1, id + ' review gets its own row below contact fields');
      assert(!/昵称|公开信息|核验/.test(lines[review]), id + ' no crowded identity row');
    }
  }
});

test('publication metadata and requested service time remain distinct and visible before applying', () => {
  for (const id of ['V02-A', 'V02-B', 'V02-C', 'V02-D']) {
    const drawing = screen(id);
    assert(drawing.includes('发布时间：<系统记录的原始发布时间>'), id);
    if (id === 'V02-D') {
      assert(!drawing.includes('期望服务时间'), 'idle listing must not inherit demand scheduling');
      continue;
    }
    assert(drawing.indexOf('发布时间：') < drawing.indexOf('-- 时间要求'), id);
    const lines = drawing.split('\n');
    const requested = lines.findIndex(line => line.includes('期望服务时间：'));
    assert(requested > 0 && lines[requested + 1].includes('服务到期时间：'), id);
    assert(!lines[requested].includes('发布时间：'), id);
  }
  for (const id of ['V04-B', 'V04-C', 'V04-D']) {
    assert(screen(id).includes('期望服务时间(*)：<开始日期/时间>'), id);
    assert(screen(id).includes('不是发布时间'), id);
    assert(!screen(id).includes('发布时间(*)'), id);
  }
  assert(!screen('V04-E').includes('期望服务时间(*)'));
  assert(screen('V03-B').includes('期望服务时间：<当前开始日期/时间>'));
  for (const source of [prd, read('docs/structured-design.md')]) {
    for (const term of ['原始发布时间', '时间要求', '期望服务时间', '申请', '720小时', '168小时']) {
      assert(source.includes(term), term);
    }
  }
  assert(prd.includes('需求发布由发布者填写“期望服务时间”'));
  assert(!document.includes('本轮尚未替换开始时间或取消其填写规则'));
});

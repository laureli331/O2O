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
const counts = [2, 4, 4, 9, 5, 3, 19, 2, 4, 4, 1, 1, 1, 5, 5, 3, 3, 4, 2, 3, 3, 10];
const expected = counts.flatMap((n, i) => Array.from({ length: n }, (_, j) => `V${String(i + 1).padStart(2, '0')}-${String.fromCharCode(65 + j)}`));
const common = ['G01', 'G02', 'G03', 'G04'];
const cases = [...prd.matchAll(/^\| ((?:T|BX|RT|AT|DT)\d{2}) \|/gm)].map(m => m[1]).sort();

function validate(text) {
  const groups = [...text.matchAll(/^## (V\d{2}) /gm)].map(m => m[1]);
  assert.deepEqual(groups, Array.from({ length: 22 }, (_, i) => `V${String(i + 1).padStart(2, '0')}`), 'all PRD page groups in order');
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
  assert.equal(cases.length, 74, 'source acceptance inventory');
  assert.deepEqual(mapped.map(m => m[1]).sort(), cases, 'exact acceptance coverage without duplicates');
  const known = new Set(headings);
  for (const row of mapped) {
    const refs = row[2].match(/V\d{2}-[A-Z]|G\d{2}/g) || [];
    assert(refs.length > 0, row[1] + ' maps to a drawing');
    for (const id of refs) assert(known.has(id), row[1] + ' unknown screen ' + id);
  }
  const matrix = [...text.matchAll(/^\| (V\d{2}) \| ([^\n]+) \| ([^\n]+) \|$/gm)];
  assert.equal(matrix.length, 22, '22 page-group coverage rows');
  for (const row of matrix) {
    assert.deepEqual(row[2].match(/V\d{2}-[A-Z]/g), expected.filter(id => id.startsWith(row[1] + '-')), row[1] + ' matrix matches drawings');
  }
  return true;
}

test('ASCII design covers every PRD group, all subpages, shared surfaces and 74 current acceptance cases', () => assert.equal(validate(document), true));
test('coverage rejects missing group, missing drawing, removed acceptance or broken target', () => {
  for (const changed of [
    document.replace(/^## V22 .+$/m, ''),
    document.replace(/^### V07-R .+$/m, ''),
    document.replace(/^\| BX17 \|.+\n/m, ''),
    document.replace(/^\| BX17 \|.+$/m, '| BX17 | V99-A |'),
    document.replace('```text\n+', '```text\n!'),
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

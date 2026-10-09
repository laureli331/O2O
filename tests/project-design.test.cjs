'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repo = path.resolve(__dirname, '..');
const decoder = new TextDecoder('utf-8', { fatal: true });
const read = relative => decoder.decode(fs.readFileSync(path.join(repo, relative)));
const document = read('design.md');
const tokens = JSON.parse(read('assets/ui/v2/design-tokens.json'));
const selection = JSON.parse(read('assets/ui/approved-selection.json'));
const expectedScope = { post01: [1, 2, 3, 4], post02: [1, 2, 3, 4, 5, 6, 7], post03: [1, 3, 5] };

function validateProjectStyle(text) {
  assert(text.includes('湘邻湘友'), 'Missing project context');
  const colors = [...text.matchAll(/#[0-9a-f]{6}\b/gi)].map(match => match[0].toUpperCase());
  const approved = Object.values(tokens.palette).map(color => color.toUpperCase());
  assert.deepEqual([...new Set(colors)].sort(), [...approved].sort(), 'Unapproved palette');
  assert(text.includes(`assets/ui/${selection.image}`), 'Wrong approved visual reference');
  assert(text.includes('docs/prd.md'), 'Missing business contract');
  assert(text.includes('尚未修改或实现产品页面'), 'Document cannot certify implementation');
  for (const row of text.matchAll(/^\| \[(post\d{2})\].*?\| ([\d、]+) \|/gm)) {
    assert.deepEqual(row[2].split('、').map(Number), expectedScope[row[1]], 'Incorrect source scope');
  }
  const scope = [...text.matchAll(/^\| \[(post\d{2})\]/gm)].map(match => match[1]);
  assert.deepEqual(scope, Object.keys(expectedScope), 'Missing source scope');
}

test('project style preserves the approved palette, selected image, PRD and source scope', () => {
  validateProjectStyle(document);
  assert(document.includes('docs/ui-design-v2.md'), 'Reference must identify the active UI specification');
  assert(document.includes('14 张图片、3 份文字'));
});

test('source files match the confirmed image coverage and JPEG boundary markers', () => {
  let total = 0;
  for (const [folder, expected] of Object.entries(expectedScope)) {
    const directory = path.join(repo, 'redbook', folder);
    const images = fs.readdirSync(directory).filter(name => name.endsWith('.jpg'));
    const numbers = images.map(name => Number(name.match(/_(\d+)_/)[1])).sort((a, b) => a - b);
    assert.deepEqual(numbers, expected);
    for (const image of images) {
      const bytes = fs.readFileSync(path.join(directory, image));
      assert(bytes.length > 1000, `Empty or truncated image: ${image}`);
      assert.equal(bytes.readUInt16BE(0), 0xffd8, `Invalid JPEG: ${image}`);
      assert.equal(bytes.readUInt16BE(bytes.length - 2), 0xffd9, `Incomplete JPEG: ${image}`);
    }
    assert(read(`redbook/${folder}/text.txt`).trim().length > 0);
    total += images.length;
  }
  assert.equal(total, 14);
});

test('page guidance covers the approved visual pages and current AI and operations pages', () => {
  const prd = read('docs/prd.md');
  const covered = new Set([...document.matchAll(/V\d{2}/g)].map(match => match[0]));
  for (const range of document.matchAll(/V(\d{2})—V(\d{2})/g)) {
    for (let page = Number(range[1]); page <= Number(range[2]); page++) covered.add(`V${String(page).padStart(2, '0')}`);
  }
  for (const id of [...new Set(tokens.screens.flatMap(screen => screen.prd)), 'V04', 'V21']) {
    assert(covered.has(id), `Missing page guidance: ${id}`);
    assert(prd.includes(`| ${id} |`), `Unknown PRD page: ${id}`);
  }
  for (const boundary of ['双方直接结算', '三维未预选', '第一版只整理本次文字', '仅两位运营者']) {
    assert(document.includes(boundary), `Missing relevant business boundary: ${boundary}`);
  }
});

test('the new reference document has valid local references and balanced Markdown tables', () => {
  for (const relative of ['design.md']) {
    const text = read(relative);
    assert(!text.includes('\uFFFD'), `Invalid text encoding: ${relative}`);
    for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
      const target = match[1];
      if (/^(https?:\/\/|#)/.test(target)) continue;
      assert(fs.existsSync(path.resolve(path.dirname(path.join(repo, relative)), decodeURIComponent(target.split('#')[0]))), `Broken reference: ${target}`);
    }
    assert.equal([...text.matchAll(/^```/gm)].length % 2, 0);
    let previous = 0;
    for (const line of text.split(/\r?\n/)) {
      if (!line.startsWith('|')) { previous = 0; continue; }
      const count = [...line.matchAll(/\|/g)].length;
      if (previous) assert.equal(count, previous, `Malformed table: ${relative}`);
      previous = count;
    }
  }
});

test('validation rejects replacing approved decisions or overstating material and implementation', () => {
  assert.throws(() => validateProjectStyle(document.replace('#618872', '#007AFF')), /Unapproved palette/);
  assert.throws(() => validateProjectStyle(document.replace(selection.image, selection.nonselectedCandidate)), /Wrong approved visual reference/);
  assert.throws(() => validateProjectStyle(document.replace('1、3、5', '1、2、3、4、5')), /Incorrect source scope/);
  assert.throws(() => validateProjectStyle(document.replace('尚未修改或实现产品页面', '页面已完成')), /cannot certify implementation/);
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const repo = path.resolve(__dirname, '..');
const directory = path.join(repo, 'assets/ui/development-handoff-20261009');
const documentDirectory = path.join(repo, 'docs/ui-development-handoff');
const decoder = new TextDecoder('utf-8', { fatal: true });
const read = file => decoder.decode(fs.readFileSync(file));
const json = name => JSON.parse(read(path.join(directory, name)));
const hash = data => crypto.createHash('sha256').update(data).digest('hex').toUpperCase();
const clone = data => JSON.parse(JSON.stringify(data));
const tokens = json('design-tokens.json');
const coverage = json('coverage.json');
const decisions = json('decisions.json');
const manifest = json('manifest.json');
const content = json('content.json');
const components = json('components.json');
const prd = read(path.join(repo, 'docs/prd.md'));
const expectedHash = 'A73C4D802FBE91900CF9D1E751AB1C45391B7FD10C1868476BDF392605EEE011';

function validateCoverage(value) {
  const ids = value.items.map(item => item.id);
  assert.equal(new Set(ids).size, 21, 'page groups must be unique');
  assert.deepEqual([...ids].sort(), Array.from({ length: 21 }, (_, i) => `V${String(i + 1).padStart(2, '0')}`));
  assert.equal(value.overviewCount, 5);
  for (const item of value.items) {
    assert(prd.includes(`| ${item.id} |`), `Unknown page ${item.id}`);
    assert(['partial-visual', 'entry-only', 'not-drawn'].includes(item.status), 'cannot certify full design');
    assert(item.gap.length > 0);
    for (const ref of [...item.fields, ...item.acceptance]) assert(prd.includes(`| ${ref} |`), `Unknown reference ${ref}`);
    for (const screen of item.visualPages) assert(/^UI0[1-5]$/.test(screen));
  }
  for (const ref of [...value.modules, ...value.extensions]) assert(prd.includes(`| ${ref} |`), `Unknown module ${ref}`);
}

function validateDecisions(value) {
  const byId = new Map(value.items.map(item => [item.id, item]));
  assert.equal(byId.size, 8);
  assert.equal(byId.get('HD01').userReply, '扩展维修接单流程，另行讨论并补齐业务规则');
  assert.equal(byId.get('HD02').userReply, '按已确认完成的跑腿服务费累计，排除垫付款，注明非到账金额');
  assert.equal(byId.get('HD03').userReply, '优选就是付费推广');
  assert.equal(byId.get('HD05').userReply, '只显示“服务时间”，暂不填值');
  for (const id of ['HD01', 'HD02', 'HD03', 'HD04', 'HD07', 'HD08']) {
    assert.equal(byId.get(id).productionAllowed, false, `Unresolved ${id} cannot become production-approved`);
  }
  assert.equal(byId.get('HD02').confirmed.wallet, false);
  assert.equal(byId.get('HD02').confirmed.disclosure, '非到账金额');
  assert(byId.get('HD03').pending.includes('付费推广识别文案与位置'));
}

function luminance(color) {
  assert(/^#[0-9A-Fa-f]{6}$/.test(color));
  const values = color.slice(1).match(/../g).map(v => parseInt(v, 16) / 255)
    .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return values.reduce((total, v, i) => total + v * [0.2126, 0.7152, 0.0722][i], 0);
}

function validateTextContrast(value) {
  for (const [foreground, background] of value.contrastPolicy.pairs) {
    const a = luminance(value.palette[foreground]);
    const b = luminance(value.palette[background]);
    const contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    assert(contrast >= value.contrastPolicy.minimumTextOnDeclaredSolidBackground,
      `${foreground} on ${background}: ${contrast.toFixed(2)}`);
  }
}

function validateSafeSVG(svg) {
  assert(svg.includes('xmlns="http://www.w3.org/2000/svg"'));
  assert.equal((svg.match(/<svg\b/g) || []).length, 1);
  assert.equal((svg.match(/<\/svg>/g) || []).length, 1);
  assert(!/<(?:script|foreignObject|iframe|image)\b|\bon\w+\s*=|<!DOCTYPE|<!ENTITY/i.test(svg), 'unsafe SVG content');
  for (const ref of svg.matchAll(/(?:href|xlink:href)="([^"]+)"/g)) {
    assert(ref[1].startsWith('#'), 'external SVG link');
    assert(svg.includes(`id="${ref[1].slice(1)}"`), 'unresolved SVG symbol');
  }
}

test('selected attachment is byte-identical and source artifacts remain traceable', () => {
  const selectedPath = path.join(directory, manifest.selectedImage);
  const bytes = fs.readFileSync(selectedPath);
  assert.equal(hash(bytes), expectedHash);
  assert.equal(manifest.selectedImageSha256, expectedHash);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16), 1086);
  assert.equal(bytes.readUInt32BE(20), 1448);
  assert.equal(manifest.selectedImageModified, false);
  assert.equal(manifest.editableLayerFile, null);
  for (const source of manifest.sources) assert.equal(hash(fs.readFileSync(path.join(repo, source.path))), source.sha256);
  assert(fs.existsSync(path.join(directory, manifest.priorBrandAvatar.path)));
  const selection = JSON.parse(read(path.join(repo, 'assets/ui/selected-20261009/selection.json')));
  assert.equal(selection.transformed, false);
  assert.equal(selection.imageSha256, expectedHash);
});

test('all 21 page groups and their real PRD references are covered without pretending they are fully drawn', () => {
  validateCoverage(coverage);
  assert.equal(coverage.items.find(item => item.id === 'V04').status, 'not-drawn');
  assert.equal(coverage.items.find(item => item.id === 'V21').status, 'not-drawn');
  assert(coverage.items.find(item => item.id === 'V02').gap.includes('维修订单扩展待定义'));
  const missing = clone(coverage);
  missing.items = missing.items.filter(item => item.id !== 'V21');
  assert.throws(() => validateCoverage(missing));
  const fabricated = clone(coverage);
  fabricated.items[0].fields.push('F99');
  assert.throws(() => validateCoverage(fabricated));
});

test('human approvals are recorded separately from unresolved rules and production gates', () => {
  validateDecisions(decisions);
  const unsafe = clone(decisions);
  unsafe.items.find(item => item.id === 'HD01').productionAllowed = true;
  assert.throws(() => validateDecisions(unsafe), /Unresolved HD01/);
  const misread = clone(decisions);
  misread.items.find(item => item.id === 'HD03').userReply = '免费目录';
  assert.throws(() => validateDecisions(misread));
});

test('exact copy preserves new visual decisions, placeholders and qualification separation', () => {
  assert.deepEqual(content.labels.navigation, ['首页', '服务', '发布', '消息', '我的']);
  assert.deepEqual(content.labels.dimensions, ['态度', '效率', '沟通']);
  assert.equal(content.labels.brand, '湘邻湘友');
  assert.equal(content.labels.ratingPlaceholder, '说说这次服务的感受吧...');
  assert.equal(content.labels.serviceTime, '服务时间');
  assert.equal(content.labels.earningsDisclosure, '非到账金额');
  assert.equal(content.labels.earningsTemplate, '在湘邻湘友赚了{amount}元');
  assert.equal(content.preview.synthetic, true);
  assert.equal(content.preview.notProductionDefaults, true);
  assert.equal(content.rasterOnlyOrGated.earnings.placeholderForbiddenInProduction, true);
  assert.equal(content.rasterOnlyOrGated.earnings.amountMustNotDefaultToZeroWhenUnknown, true);
  assert.equal(tokens.semanticRoles.qualificationPending, 'hintText');
  assert.equal(tokens.semanticRoles.qualificationHelper, 'mutedText');
  assert.equal(tokens.semanticRoles.earningsAllCharacters, 'hintText');
  assert.equal(tokens.semanticRoles.earningsAlignment, 'right');
});

test('candidate text colors are readable on declared solid surfaces and still require device review', () => {
  validateTextContrast(tokens);
  assert.equal(tokens.valuePolicy.deviceValidationPassed, false);
  assert.equal(tokens.contrastPolicy.notMeasuredOnGlassOrDevice, true);
  const tooLight = clone(tokens);
  tooLight.palette.hintText = '#FCFBF7';
  assert.throws(() => validateTextContrast(tooLight), /hintText/);
});

test('SVG icons are safe, standalone, complete and use a single service bag identity', () => {
  assert.equal(manifest.iconCount, 22);
  assert.equal(manifest.standaloneIconCount, 44);
  assert.equal(new Set(manifest.icons.map(item => item.id)).size, 22);
  assert.equal(manifest.navigation.find(item => item.label === '服务').icon, 'icon-services-bag');
  assert.deepEqual(tokens.icons.nav, manifest.navigation.map(item => item.icon));
  for (const item of manifest.files.filter(item => item.path.endsWith('.svg'))) validateSafeSVG(read(path.join(directory, item.path)));
  const inherited = read(path.join(repo, 'assets/ui/v2/icons.svg'));
  const normal = read(path.join(directory, 'icons/icon-home.svg'));
  assert(inherited.includes(normal.match(/(<path[^>]+\/>)<\/svg>/)[1]));
  assert.throws(() => validateSafeSVG('<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>'), /unsafe/);
  assert.throws(() => validateSafeSVG('<svg xmlns="http://www.w3.org/2000/svg"><use href="https://example.test/a.svg"/></svg>'), /external/);
});

test('component states reference real groups and acceptance cases, including failure and unknown states', () => {
  assert.equal(new Set(components.items.map(item => item.id)).size, components.items.length);
  for (const component of components.items) {
    assert(component.states.length > 1);
    for (const ref of [...component.pages, ...component.acceptance]) assert(prd.includes(`| ${ref} |`), `Unknown component reference ${ref}`);
  }
  assert(components.items.find(item => item.id === 'C07').states.includes('unknown'));
  assert(components.items.find(item => item.id === 'C13').states.includes('valid-zero'));
  assert(components.items.find(item => item.id === 'C13').states.includes('unknown'));
  assert.equal(components.gates.repairOrder, 'HD01');
});

test('handoff Markdown links resolve and current source takes precedence without mutating old documents', () => {
  const files = fs.readdirSync(documentDirectory).filter(file => file.endsWith('.md'));
  assert(files.length >= 7);
  for (const file of files) {
    const absolute = path.join(documentDirectory, file);
    const document = read(absolute);
    assert(!document.includes('\uFFFD'), `${file} invalid text`);
    for (const match of document.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^https?:\/\//.test(match[1])) continue;
      const target = path.resolve(path.dirname(absolute), match[1].split('#')[0]);
      assert(fs.existsSync(target), `${file}: unresolved ${match[1]}`);
    }
  }
  const entry = read(path.join(documentDirectory, 'README.md'));
  assert(entry.includes('2026-10-09 选定五页图为准'));
  assert(entry.includes('没有伪称交付 Figma 源文件'));
  const business = read(path.join(documentDirectory, 'business-addendum.md'));
  assert(business.includes('优选就是付费推广'));
  assert(business.includes('非到账金额'));
});

test('generated outputs and manifest are reproducible and no assets drift silently', () => {
  execFileSync(process.execPath, [path.join(repo, 'scripts/prepare-ui-development-handoff.cjs'), '--check'], { cwd: repo, encoding: 'utf8' });
  for (const item of manifest.files) {
    const bytes = fs.readFileSync(path.join(directory, item.path));
    assert.equal(bytes.length, item.bytes, item.path);
    assert.equal(hash(bytes), item.sha256, item.path);
  }
  const theme = read(path.join(directory, 'theme.wxss'));
  assert(theme.includes('.ui-earnings { text-align: right;'));
  assert(!/^.*backdrop-filter\s*:/m.test(theme));
  assert(theme.includes(`.ui-earnings-amount, .ui-earnings-unit { color: ${tokens.palette.hintText}; }`));
});

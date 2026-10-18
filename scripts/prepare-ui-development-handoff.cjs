'use strict';

// Rebuild only this handoff's generated files; never edit the selected artwork.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const repo = path.resolve(__dirname, '..');
const directory = path.join(repo, 'assets/ui/development-handoff-20261009');
const check = process.argv.includes('--check');
const hash = data => crypto.createHash('sha256').update(data).digest('hex').toUpperCase();
const sourceTextHash = file => hash(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
const read = name => fs.readFileSync(path.join(directory, name), 'utf8');
const tokens = JSON.parse(read('design-tokens.json'));
const content = JSON.parse(read('content.json'));
const selected = fs.readFileSync(path.join(directory, tokens.visualSource));
const expected = 'A73C4D802FBE91900CF9D1E751AB1C45391B7FD10C1868476BDF392605EEE011';
if (hash(selected) !== expected) throw new Error('Selected attachment differs; refusing generation');
const sourcePath = path.join(repo, 'assets/ui/v2/icons.svg');
const source = fs.readFileSync(sourcePath, 'utf8');
const symbols = [...source.matchAll(/<symbol id="([^"]+)" viewBox="0 0 24 24">([\s\S]*?)<\/symbol>/g)]
  .map(([, id, body]) => ({ id, body, origin: 'assets/ui/v2/icons.svg' }));
if (symbols.length !== tokens.icons.inheritedCount) throw new Error('Unexpected source icon library');
symbols.push(
  { id: 'icon-services-bag', body: '<rect x="5" y="7" width="14" height="14" rx="2"/><path d="M9 9V5a3 3 0 0 1 6 0v4"/>', origin: 'new deterministic SVG in inherited 24px/1.75 family' },
  { id: 'icon-info', body: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7" r=".6" fill="currentColor" stroke="none"/>', origin: 'new deterministic SVG in inherited 24px/1.75 family' },
  { id: 'icon-discover', body: '<circle cx="12" cy="12" r="8.5"/><path d="M14.75 9.25 13.2 13.2l-3.95 1.55 1.55-3.95 3.95-1.55Z"/><circle cx="12" cy="12" r="1"/>', origin: 'approved option A deterministic compass in inherited 24px/1.75 family' }
);
const outputs = new Map();
const svg = (body, color, size = 24) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" color="${color}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${body}</svg>\n`;
for (const symbol of symbols) {
  outputs.set(`icons/${symbol.id}.svg`, svg(symbol.body, tokens.palette.ink));
  outputs.set(`icons/${symbol.id}-green.svg`, svg(symbol.body, tokens.palette.sage));
}
const defs = symbols.map(s => `<symbol id="${s.id}" viewBox="0 0 24 24">${s.body}</symbol>`).join('');
const rows = Math.ceil(symbols.length / 4);
const preview = symbols.map((s, i) => {
  const x = 10 + (i % 4) * 154;
  const y = 20 + Math.floor(i / 4) * 64;
  return `<g transform="translate(${x} ${y})"><use href="#${s.id}" x="48" width="24" height="24"/><text x="60" y="43" text-anchor="middle" stroke="none" fill="${tokens.palette.ink}" font-size="10">${s.id}</text></g>`;
}).join('');
outputs.set('icons.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="636" height="${rows * 64 + 20}" viewBox="0 0 636 ${rows * 64 + 20}" color="${tokens.palette.ink}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" font-family="system-ui, Microsoft YaHei, sans-serif"><title>湘邻湘友：${symbols.length}个可编辑图标，设计交接</title><rect width="636" height="${rows * 64 + 20}" fill="${tokens.palette.ivory}" stroke="none"/><defs>${defs}</defs>${preview}</svg>\n`);
outputs.set('image-placeholder.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="192" viewBox="0 0 256 192"><title>图片占位</title><rect width="256" height="192" rx="8" fill="${tokens.palette.placeholderSurface}"/><g transform="translate(98 66)" fill="none" stroke="${tokens.palette.ivory}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><rect width="60" height="60" rx="5"/><circle cx="18" cy="18" r="5"/><path d="M0 47 18 29 31 43 43 25 60 47"/></g></svg>\n`);
const user = symbols.find(s => s.id === 'icon-user').body;
outputs.set('avatar-placeholder.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><title>通用头像占位，非用户真实照片</title><circle cx="48" cy="48" r="44" fill="${tokens.palette.badgeSurface}" stroke="${tokens.palette.ivory}" stroke-width="3"/><g transform="translate(24 22) scale(2)" color="${tokens.palette.ink}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${user}</g></svg>\n`);
let seed = 71;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const dots = Array.from({ length: 60 }, () => `<circle cx="${(random() * 32).toFixed(2)}" cy="${(random() * 32).toFixed(2)}" r=".45"/>`).join('');
outputs.set('noise-tile.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><title>静态装饰噪点，使用时透明度0.015</title><g fill="${tokens.palette.ink}">${dots}</g></svg>\n`);

const p = tokens.palette;
const unit = value => `${value * 2}rpx`;
const theme = `/* Generated from design-tokens.json; not imported by a product project. */
/* At 375 logical px reference width only: value * 2 gives the 750 rpx scale. */
/* No unverified backdrop-filter, custom-property or safe-area assumption. */
.ui-page { background: ${p.ivory}; color: ${p.ink}; font-family: ${tokens.typography.family}; font-size: ${tokens.typography.body}px; }
.ui-page-padding { padding-left: ${unit(tokens.layout.pagePadding)}; padding-right: ${unit(tokens.layout.pagePadding)}; }
.ui-page-title { font-size: ${tokens.typography.pageTitle}px; font-weight: 600; }
.ui-section-title { font-size: ${tokens.typography.sectionTitle}px; font-weight: 600; }
.ui-metadata { font-size: ${tokens.typography.metadata}px; color: ${p.mutedText}; }
.ui-card { padding: ${unit(tokens.layout.cardPadding)}; border-radius: ${unit(tokens.layout.cardRadius)}; background: ${p.ivory}; }
.ui-card-compact { padding: ${unit(tokens.layout.compactCardPadding)}; }
.ui-section-gap { margin-top: ${unit(tokens.layout.sectionGap)}; }
.ui-demand-grid { display: flex; flex-wrap: wrap; justify-content: space-between; }
.ui-demand-grid-item { width: calc((100% - ${unit(tokens.layout.gridGap)}) / 2); margin-bottom: ${unit(tokens.layout.gridGap)}; }
.ui-price { color: ${p.priceText}; font-weight: 600; }
.ui-hint, .ui-qualification-pending { color: ${p.hintText}; }
.ui-qualification-helper { color: ${p.mutedText}; }
.ui-earnings { text-align: right; font-size: ${tokens.typography.metadata}px; color: ${p.hintText}; }
.ui-earnings-amount, .ui-earnings-unit { color: ${p.hintText}; }
.ui-advance-tag { color: ${p.badgeText}; background: ${p.badgeSurface}; border-radius: ${unit(tokens.layout.controlRadius)}; padding: 8rpx 16rpx; font-size: ${tokens.typography.metadata}px; }
.ui-primary-action { min-height: ${unit(tokens.layout.touchTargetMin)}; color: ${p.ivory}; background: linear-gradient(135deg, ${p.primaryStart}, ${p.primaryEnd}); border-radius: ${unit(tokens.layout.controlRadius)}; font-size: ${tokens.typography.body}px; }
.ui-glass-fallback { background: rgba(252,251,247,0.76); border: 1px solid ${p.border}; box-shadow: 0 16rpx 48rpx rgba(38,58,49,0.08); }
.ui-icon { width: 24px; height: 24px; }
.ui-touch-target { min-width: ${unit(tokens.layout.touchTargetMin)}; min-height: ${unit(tokens.layout.touchTargetMin)}; }
.ui-pressable { transition: transform ${tokens.motion.releaseDurationMs}ms ease; transform-origin: center; }
.ui-pressable--pressed { transform: scale(${tokens.motion.pressScale}); transition-duration: ${tokens.motion.pressDurationMs}ms; }
@media (prefers-reduced-motion: reduce) { .ui-pressable, .ui-pressable--pressed { transition: none; transform: none; } }
.ui-noise-decoration { opacity: ${tokens.effects.noise.opacity}; pointer-events: none; }
/* Add real runtime bottom safe-area padding and measured action-tray height in the product. */
`;
outputs.set('theme.wxss', theme);
for (const [name, value] of outputs) {
  const file = path.join(directory, name);
  if (check) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== value) throw new Error(`Generated file is stale: ${name}`);
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, value, 'utf8');
  }
}
const trackedNames = ['design-tokens.json', 'components.json', 'coverage.json', 'content.json', 'decisions.json', ...outputs.keys()];
const manifest = {
  schemaVersion: 1,
  date: '2026-10-09',
  selectedImage: tokens.visualSource,
  selectedImageSha256: expected,
  selectedImageModified: false,
  editableLayerFile: null,
  generator: 'scripts/prepare-ui-development-handoff.cjs',
  sources: [
    { path: 'assets/ui/v2/icons.svg', sha256LfNormalized: sourceTextHash(sourcePath), usage: '20 inherited SVG symbols; original unchanged' },
    { path: 'assets/ui/v2/design-tokens.json', sha256LfNormalized: sourceTextHash(path.join(repo, 'assets/ui/v2/design-tokens.json')), usage: 'historical numerical baseline' }
  ],
  priorBrandAvatar: { path: '../../branding/miniapp-avatar-v4/avatar-144.png', note: 'Prepared prior upload candidate; latest UI selection does not newly approve a brand-avatar change' },
  iconCount: symbols.length,
  standaloneIconCount: symbols.length * 2,
  icons: symbols.map(s => ({ id: s.id, source: s.origin, normal: `icons/${s.id}.svg`, green: `icons/${s.id}-green.svg` })),
  navigation: tokens.icons.nav.map((id, index) => ({ label: content.labels.navigation[index], icon: id })),
  files: trackedNames.sort().map(name => ({ path: name, bytes: fs.statSync(path.join(directory, name)).size, sha256: hash(fs.readFileSync(path.join(directory, name))) })),
  limitations: ['No Figma/native layered source reconstructed', 'SVG display and any PNG export not yet verified on WeChat runtime', 'Leaf decoration editable source not available', 'Styles and candidate colors require device review']
};
const serialized = JSON.stringify(manifest, null, 2) + '\n';
const manifestPath = path.join(directory, 'manifest.json');
if (check) {
  if (fs.readFileSync(manifestPath, 'utf8') !== serialized) throw new Error('Asset manifest is stale');
} else fs.writeFileSync(manifestPath, serialized, 'utf8');
process.stdout.write(`Handoff ${check ? 'verified' : 'generated'}: ${outputs.size} generated resources, ${symbols.length} icon identities. Selected image unchanged.\n`);

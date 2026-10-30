'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { verifyArchive } = require('../sp01-taro-probe/verify-archive-compatibility.cjs');

async function verify(candidate, baseline, outputParent) {
  const resolveCandidate = createRequire(path.join(candidate, 'package.json'));
  const fromPackage = name => createRequire(resolveCandidate.resolve(`${name}/package.json`));
  const copyRequire = fromPackage('copy-webpack-plugin');
  const cssRequire = fromPackage('css-minimizer-webpack-plugin');
  const serialize = copyRequire('serialize-javascript');
  assert.equal(copyRequire('serialize-javascript/package.json').version, '7.1.4');
  assert.equal(cssRequire('serialize-javascript/package.json').version, '7.1.4');
  const normalOptions = { pattern: /synthetic/gi, date: new Date('2026-10-30T00:00:00Z'),
    transform(value) { const suffix = () => '-normal'; return value + suffix(); } };
  const restored = vm.runInNewContext(`(${serialize(normalOptions)})`, {}, { timeout: 1000 });
  assert.equal(restored.transform('synthetic'), 'synthetic-normal');
  assert.equal(restored.date.toISOString(), normalOptions.date.toISOString());
  assert.equal(restored.pattern.test('SYNTHETIC'), true);

  const archive = await verifyArchive(path.dirname(resolveCandidate.resolve('adm-zip/package.json')),
    path.join(baseline, 'node_modules/adm-zip'), outputParent);
  assert.equal(archive.version, '0.6.1');
  const work = fs.mkdtempSync(path.join(outputParent, 'build-plugin-compat-'));
  fs.writeFileSync(path.join(work, 'entry.js'), "import './probe.css'; export const synthetic = 2;");
  fs.writeFileSync(path.join(work, 'probe.css'), '/* normal synthetic CSS */ .probe { color: #ff0000; margin: 0px 0px 0px 0px; }');
  fs.writeFileSync(path.join(work, 'normal.txt'), 'synthetic normal content');
  const webpack = resolveCandidate('webpack');
  const CopyPlugin = resolveCandidate('copy-webpack-plugin');
  const CssMinimizer = resolveCandidate('css-minimizer-webpack-plugin');
  const MiniCssExtract = resolveCandidate('mini-css-extract-plugin');
  let transformCalls = 0;
  const compiler = webpack({ mode: 'production', context: work, entry: './entry.js',
    output: { path: path.join(work, 'dist'), filename: 'bundle.js' }, cache: { type: 'memory' },
    module: { rules: [{ test: /\.css$/, use: [MiniCssExtract.loader, resolveCandidate.resolve('css-loader')] }] },
    plugins: [new MiniCssExtract({ filename: 'style.css' }), new CopyPlugin({ patterns: [
      { from: 'normal.txt', to: 'copy.txt', transform: { cache: true,
        transformer(content) { transformCalls++; return content.toString().toUpperCase(); } } },
    ] })],
    optimization: { minimize: true, minimizer: [new CssMinimizer({ parallel: 1 })] },
  });
  const run = () => new Promise((resolve, reject) => compiler.run((error, stats) => {
    if (error) return reject(error);
    if (stats.hasErrors()) return reject(Error(stats.toString({ all: false, errors: true })));
    resolve(stats);
  }));
  let closed = false;
  try {
    await run();
    const firstCalls = transformCalls;
    assert.equal(firstCalls, 1);
    await run();
    assert.equal(transformCalls, firstCalls, 'COPY_TRANSFORM_CACHE_NOT_REUSED');
    assert.equal(fs.readFileSync(path.join(work, 'dist/copy.txt'), 'utf8'), 'SYNTHETIC NORMAL CONTENT');
    const css = fs.readFileSync(path.join(work, 'dist/style.css'), 'utf8');
    assert.ok(css.includes('color:red') || css.includes('color:#f00'));
    assert.ok(css.includes('margin:0'));
    assert.equal(css.includes('normal synthetic CSS'), false);
  } finally {
    await new Promise((resolve, reject) => compiler.close(error => error ? reject(error) : resolve()));
    closed = true;
  }
  return { success: true, scope: 'ordinary-synthetic-compatibility-only',
    archive, serialize: { version: '7.1.4', normalOptionsRoundTrip: true, copyAndCssConsumersResolvedSameVersion: true },
    buildPlugins: { copyTransform: true, repeatedBuildCacheReused: true, cssMinified: true,
      cssWorkerParallelism: 1, compilerClosed: closed, outputDirectory: work },
    cloudChanged: false, vulnerabilityReproductionPerformed: false };
}
module.exports = { verify };
if (require.main === module) {
  const [candidate, baseline, outputParent, report] = process.argv.slice(2).map(value => path.resolve(value));
  verify(candidate, baseline, outputParent).then(result => {
    fs.writeFileSync(report, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  }).catch(error => { console.error(error.stack); process.exitCode = 1; });
}

'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const vm = require('node:vm');

function evaluate({ validStatus, invalidStatus, invalidOutput, validEmitted, invalidEmitted, runtimeMatched }) {
  return validStatus === 0 && Number.isInteger(invalidStatus) && invalidStatus !== 0
    && /\bTS2322\b/.test(invalidOutput) && validEmitted === true
    && invalidEmitted === false && runtimeMatched === true;
}

function runProbe() {
  const root = path.resolve(__dirname, '../..');
  const runtime = path.join(root, '.local/sp01-toolchain-probe');
  const compiler = path.join(runtime, 'node_modules/typescript/bin/tsc');
  const runRoot = path.join(root, '.local/sp01-toolchain-runs');
  fs.mkdirSync(runRoot, { recursive: true });
  const run = fs.mkdtempSync(path.join(runRoot, 'compile-'));
  const outcomes = {};
  for (const name of ['valid', 'invalid']) {
    const outDir = path.join(run, name);
    const config = path.join(run, `${name}.json`);
    fs.writeFileSync(config, JSON.stringify({
      compilerOptions: {
        target: 'ES2018', module: 'Node16', moduleResolution: 'Node16',
        strict: true, skipLibCheck: false, noEmitOnError: true,
        lib: ['ES2020'], types: ['miniprogram-api-typings'],
        typeRoots: [path.join(runtime, 'node_modules')],
        rootDir: path.join(__dirname, 'fixtures'), outDir,
      },
      files: [path.join(__dirname, `fixtures/${name}.ts`)],
    }, null, 2));
    const compilation = spawnSync(process.execPath, [compiler, '--project', config, '--pretty', 'false'], { encoding: 'utf8', timeout: 30000 });
    outcomes[name] = { status: compilation.status, output: `${compilation.stdout || ''}${compilation.stderr || ''}`,
      emitted: fs.existsSync(path.join(outDir, `${name}.js`)), path: path.join(outDir, `${name}.js`) };
  }
  let runtimeMatched = false;
  if (outcomes.valid.emitted && outcomes.valid.status === 0) {
    let app;
    vm.runInNewContext(fs.readFileSync(outcomes.valid.path, 'utf8'), {
      exports: {}, App: (definition) => { app = definition; },
      wx: { getSystemInfoSync: () => ({ SDKVersion: 'synthetic-sdk' }) },
    }, { timeout: 1000 });
    app.onLaunch.call(app);
    runtimeMatched = app.globalData.sdkVersion === 'synthetic-sdk';
  }
  const version = spawnSync(process.execPath, [compiler, '--version'], { encoding: 'utf8', timeout: 10000 });
  const report = {
    source: 'local-real-compiler/synthetic-wx-runtime', nodeVersion: process.version,
    typescriptVersion: version.stdout.trim(), typingsVersion: require(path.join(runtime, 'node_modules/miniprogram-api-typings/package.json')).version,
    validStatus: outcomes.valid.status, invalidStatus: outcomes.invalid.status,
    invalidError2322: /\bTS2322\b/.test(outcomes.invalid.output),
    validEmitted: outcomes.valid.emitted, invalidEmitted: outcomes.invalid.emitted, runtimeMatched,
    formalProjectCreated: false, devtoolsCompilationVerified: false, realDeviceVerified: false,
  };
  report.success = evaluate({ ...report, invalidOutput: outcomes.invalid.output });
  fs.writeFileSync(path.join(root, '.local/sp01-toolchain-last.json'), JSON.stringify(report, null, 2));
  if (!report.success) {
    console.error(outcomes.valid.output);
    console.error(outcomes.invalid.output);
  }
  return report;
}
module.exports = { evaluate, runProbe };
if (require.main === module) {
  const report = runProbe();
  console.log(JSON.stringify(report));
  if (!report.success) process.exitCode = 1;
}

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function checkOwnDeclarations(root, run = spawnSync) {
  const files = [];

  function visit(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('UNVERIFIED_DECLARATION_SYMLINK');
      if (entry.isDirectory()) visit(file);
      else if (/\.d\.(?:ts|mts|cts)$/.test(entry.name)) files.push(file);
    }
  }

  for (const directory of ['src', 'config', 'types']) visit(path.join(root, directory));
  if (files.length === 0) {
    return { success: true, declarationCount: 0, compilerExecuted: false, compilerExitCode: null };
  }

  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'o2o-own-declarations-'));
  const config = path.join(temporaryDirectory, 'tsconfig.json');
  const compiler = path.resolve(root, '../../node_modules/typescript/bin/tsc');
  try {
    fs.writeFileSync(config, JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        types: [],
        lib: ['ES2022', 'DOM'],
        jsx: 'react-jsx',
        esModuleInterop: true,
      },
      files: files.sort(),
    }, null, 2));

    const result = run(process.execPath, [compiler, '--project', config, '--pretty', 'false'], {
      encoding: 'utf8',
      timeout: 30000,
    });
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    return {
      success: result.status === 0,
      declarationCount: files.length,
      compilerExecuted: true,
      compilerExitCode: result.status,
      compilerError: result.error?.code ?? null,
    };
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

module.exports = { checkOwnDeclarations };

if (require.main === module) {
  const result = checkOwnDeclarations(__dirname);
  console.log(JSON.stringify(result));
  if (!result.success) process.exitCode = 1;
}

'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function checkOwnDeclarations(root, run = spawnSync) {
  const files = [];
  function visit(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw Error('UNVERIFIED_DECLARATION_SYMLINK');
      if (entry.isDirectory()) visit(file);
      else if (/\.d\.(?:ts|mts|cts)$/.test(entry.name)) files.push(file);
    }
  }
  for (const directory of ['src', 'config', 'types']) visit(path.join(root, directory));
  if (!files.length) return { success: true, declarationCount: 0, compilerExecuted: false, compilerExitCode: null };
  const config = path.join(root, '.own-declarations-check.json');
  fs.writeFileSync(config, JSON.stringify({ compilerOptions: {
    target: 'ES2018', module: 'ESNext', moduleResolution: 'node', strict: true,
    skipLibCheck: false, noEmit: true, types: [], lib: ['ES2020', 'DOM'],
    jsx: 'react-jsx', esModuleInterop: true,
  }, files: files.sort() }, null, 2));
  const result = run(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '--project', config, '--pretty', 'false'],
    { encoding: 'utf8', timeout: 30000 });
  if (result.stdout) process.stderr.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return { success: result.status === 0, declarationCount: files.length, compilerExecuted: true, compilerExitCode: result.status };
}
module.exports = { checkOwnDeclarations };
if (require.main === module) {
  const result = checkOwnDeclarations(__dirname);
  console.log(JSON.stringify(result));
  if (!result.success) process.exitCode = 1;
}

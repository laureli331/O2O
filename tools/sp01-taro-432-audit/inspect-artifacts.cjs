'use strict';
const fs = require('node:fs');
const path = require('node:path');

function inspectArtifacts(files) {
  const read = (name) => {
    if (!Object.hasOwn(files, name) || !files[name]?.length) throw Error(`MISSING_ARTIFACT:${name}`);
    return files[name].toString();
  };
  read('app.js');
  const app = JSON.parse(read('app.json'));
  if (!Array.isArray(app.pages) || app.pages.length !== 1 || app.pages[0] !== 'pages/index/index') throw Error('UNEXPECTED_PAGES');
  for (const page of app.pages) {
    read(`${page}.js`);
    JSON.parse(read(`${page}.json`));
    read(`${page}.wxml`);
  }
  // This checks only static import/include references in this generated fixture, not arbitrary XML.
  for (const [name, bytes] of Object.entries(files)) {
    if (!name.endsWith('.wxml')) continue;
    for (const match of bytes.toString().matchAll(/<(?:import|include)\b[^>]*\bsrc=['"]([^'"]+)['"]/g)) {
      const target = path.posix.normalize(match[1].startsWith('/') ? match[1].slice(1) : path.posix.join(path.posix.dirname(name), match[1]));
      if (target.startsWith('../') || target === '..' || target.includes('{{')) throw Error('UNVERIFIED_WXML_IMPORT');
      read(target);
    }
  }
  return { artifactsPresent: true, pages: app.pages, fileCount: Object.keys(files).length,
    totalBytes: Object.values(files).reduce((sum, value) => sum + Buffer.byteLength(value), 0),
    devtoolsCompilationVerified: false, realDeviceVerified: false, productAcceptancePassed: false };
}
function inspectDirectory(directory) {
  const files = {};
  function visit(relative = '') {
    for (const entry of fs.readdirSync(path.join(directory, relative), { withFileTypes: true })) {
      const name = path.posix.join(relative, entry.name);
      if (entry.isSymbolicLink()) throw Error('UNEXPECTED_SYMLINK');
      if (entry.isDirectory()) visit(name);
      else files[name] = fs.readFileSync(path.join(directory, name));
    }
  }
  visit();
  return inspectArtifacts(files);
}
module.exports = { inspectArtifacts, inspectDirectory };
if (require.main === module) {
  const directory = path.resolve(__dirname, '../../.local/sp01-taro-probe/dist');
  console.log(JSON.stringify(inspectDirectory(directory)));
}

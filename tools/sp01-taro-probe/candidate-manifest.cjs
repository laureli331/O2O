'use strict';
function createManifest(base, candidate = 'baseline') {
  if (!['baseline', 'peer-fix'].includes(candidate)) throw Error('UNKNOWN_CANDIDATE');
  if (candidate === 'baseline') return JSON.parse(JSON.stringify(base));
  const patch = require('./variants/peer-fix.json');
  return { ...base, dependencies: { ...base.dependencies, ...patch.dependencies },
    devDependencies: { ...base.devDependencies, ...patch.devDependencies }, overrides: { ...patch.overrides } };
}
module.exports = { createManifest };

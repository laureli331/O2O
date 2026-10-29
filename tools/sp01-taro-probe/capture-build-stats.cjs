'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Uses Webpack's public done/Stats APIs; never includes module source text.
class CaptureBuildStats {
  apply(compiler) {
    compiler.hooks.done.tap('SP01CaptureBuildStats', stats => {
      const directory = path.join(compiler.context, 'build-evidence');
      fs.mkdirSync(directory, { recursive: true });
      const result = stats.toJson({
        all: false, errors: true, warnings: true,
        modules: true, nestedModules: true, chunks: true, chunkModules: true,
        orphanModules: true, runtimeModules: true,
        modulesSpace: Infinity, nestedModulesSpace: Infinity, chunkModulesSpace: Infinity,
        groupModulesByAttributes: false, groupModulesByCacheStatus: false,
        groupModulesByExtension: false, groupModulesByLayer: false,
        groupModulesByPath: false, groupModulesByType: false,
        source: false,
      });
      fs.writeFileSync(path.join(directory, 'webpack-stats.json'), JSON.stringify(result));
    });
  }
}
module.exports = CaptureBuildStats;

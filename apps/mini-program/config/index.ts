const path = require('node:path');
import { defineConfig } from '@tarojs/cli';

export default defineConfig({
  projectName: 'xianglin-mini-program',
  sourceRoot: 'src',
  outputRoot: 'dist',
  framework: 'react',
  compiler: 'webpack5',
  designWidth: 750,
  deviceRatio: { 640: 1.17, 750: 1, 375: 2, 828: 1.81 },
  cache: { enable: false },
  mini: {
    compile: { include: [path.resolve(__dirname, '../../../packages/shared/src')] },
    postcss: {
      pxtransform: { enable: true },
      cssModules: { enable: false },
    },
  },
});

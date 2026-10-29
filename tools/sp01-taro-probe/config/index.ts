// Adapted from @tarojs/cli 4.3.1 templates/default/config/index.js; see THIRD-PARTY-NOTICES.md.
import { defineConfig } from '@tarojs/cli'

export default defineConfig({
  projectName: 'sp01-taro-probe',
  sourceRoot: 'src',
  outputRoot: 'dist',
  framework: 'react',
  compiler: 'webpack5',
  designWidth: 750,
  deviceRatio: { 640: 1.17, 750: 1, 375: 2, 828: 1.81 },
  cache: { enable: false },
  mini: {
    postcss: {
      pxtransform: { enable: true },
      cssModules: { enable: false },
    },
  },
})

# Taro Vite runner 4.3.1: isolated R01 comparison

This is a reuse investigation only. It did not change the selected project toolchain, create the SP07 project, deploy cloud code, or modify the user's QuickStart.

## Reuse checked

- Repository: reused the existing `tools/sp01-taro-probe` minimal app and its confirmed React 18.3.1 / TypeScript 5.9.3 versions.
- Official platform: Taro's compiler configuration says Taro v4 supports `vite`; `@tarojs/vite-runner@4.3.1` is the current npm `latest` tag and is MIT-licensed. The runner peers on Vite `^4`, PostCSS `^8`, and the exact matching Taro runtime `4.3.1`. The React framework package also peers on `@vitejs/plugin-react ^4`; that plugin was needed for the minimal build.
- Maintainer evidence: the official Taro 4.3.1 release lists Vite runner fixes. The Taro Webpack 5.91.0 issue remains open, with no linked fix/PR in its issue record.
- Sources: [Taro compiler configuration](https://docs.taro.zone/docs/config-detail/), [official npm package](https://www.npmjs.com/package/@tarojs/vite-runner), [Taro 4.3.1 release](https://github.com/NervJS/taro/releases/tag/v4.3.1), [Taro Webpack 5.91.0 issue](https://github.com/NervJS/taro/issues/19275).

## Isolated compatibility result

The local ignored candidate used Taro and its Vite runner 4.3.1, Vite 4.5.14, `@vitejs/plugin-react` 4.3.4, React/ReactDOM/types 18.3.1, and TypeScript 5.9.3. Strict application typechecking passed. A minimal synthetic WeChat build transformed 144 modules and completed in 19.47 seconds. `npm ls` showed no Webpack, `@tarojs/webpack5-runner`, or `@tarojs/taro-loader` in this candidate.

The full candidate audit still reported 45 affected package entries: 4 critical, 16 high, 23 moderate, and 2 low. The Taro CLI's template-fetcher chain and Taro Components' Swiper dependency remain. These counts are registry audit entries, not findings that the product is exploitable.

## Decision

Do not adopt this candidate. It removes Webpack from this isolated Taro build but requires Vite 4 beside the Web admin candidate's Vite 8.3.5, increasing build-tool version overhead. It also leaves important audited paths and does not clear R01. Keep the user's confirmed Taro 4.3.1 + Webpack 5.91.0 exact-peer choice. R01 stays pending until the real product lock and `weapp` module graph can be checked.

The dependency install was isolated under ignored `.local` and skipped eight install scripts under the local npm policy. Typechecking/build succeeded without approving those scripts. No formal dependency files, QuickStart files, CloudBase resources, or production data changed. Structured evidence: [JSON](sp01-taro-vite-runner-comparison-20261102.json).

# SP01 Taro 候选锁剩余依赖风险：运行路径核对

对象是用户已采用的[局部维护候选](sp01-maintenance-candidate-20261030.md)，不是正式产品依赖锁。候选的 npm audit 仍报告 **32 个受影响包条目**（15 moderate、13 high、4 critical）；条目数不等于独立漏洞数，也不等于当前小程序可触达漏洞数。底层原始结果保存在 `.local/shared18-maintenance-final-audit.json`。本轮只读本地已安装源码和既有构建证据，未运行漏洞利用或远程模板下载。

| 风险链 | 本地实际来源/路径 | 当前判断与保留动作 |
| --- | --- | --- |
| `download-git-repo` → `download`/`decompress` | 已安装 `@tarojs/cli/dist/create/fetchTemplate.js` 第16行直接导入 `download-git-repo`；该链供远程模板创建。此前普通小程序构建只加载模块，未下载或解压模板。 | 创建阶段风险仍在；正式建工程不得把来源不明模板交给此链，优先使用已核验的本地工程。不能因本次构建未触发就删除审计项。 |
| `@tarojs/components` → `swiper` | 已安装 `@tarojs/components/mini/index.js` 第25–26行把 `Swiper`/`SwiperItem` 映射成微信原生标签字符串。 | 当前 mini 入口未证明会执行第三方 Swiper 运行时代码；Web/H5 路径另判，不能把这条映射当成包已修复。 |
| `webpack-dev-server` 及中间依赖 | [已执行的入口加载对照](sp01-maintenance-candidate-20261030.md)中 `weapp` 未加载 H5 入口/DevServer，`web` 入口加载了它。 | 首版仅微信小程序端走 Taro `weapp`，网页后台走 Vite；仍需约束不要暴露本地开发服务，并在正式构建验证实际加载路径。 |
| `webpack@5.91.0`、`esbuild@0.21.5` | 候选安装目录的实际版本；Webpack 在 Taro 编译链，esbuild 在 helper/编译链。audit 中 Webpack 含 DOM clobbering 与 `buildHttp` 相关公告，esbuild 含开发服务跨站读取公告。 | 编译工具确实被使用，不能一概标“不适用”。正式工程须锁定构建输入、不启用未经核验的远程 `buildHttp` 导入，开发服务仅本机访问；更新路径和剩余公告需继续核对。 |

公告来源由本机 npm audit 指向：[Webpack DOM clobbering](https://github.com/advisories/GHSA-4vvj-4cpr-p986)、[Webpack buildHttp allowlist](https://github.com/advisories/GHSA-8fgc-7cc6-rx7x)、[Swiper prototype pollution](https://github.com/advisories/GHSA-hmx5-qpq5-p643)、[decompress 路径越界](https://github.com/advisories/GHSA-mp2f-45pm-3cg9)、[esbuild 开发服务](https://github.com/advisories/GHSA-67mh-4wv8-2f99)。这些链接描述公告范围；本文件不声称逐个漏洞已在项目里复现或修复。

复用判断：沿用已通过普通兼容验证的 Taro 4.3.1 + React 18.3.1 候选、只做局部维护锁，不引入额外框架或复制 Taro 实现。CLI 远程创建能力和 H5 开发服务不是首版必需，先限制使用；构建器仍是必需依赖，不能靠“没在业务包里看到”判安全。本机对应 `package.json` 中 Taro CLI/组件/Runner、Webpack、esbuild、Swiper、decompress、download-git-repo 均声明 MIT；这只核对声明，不代替发布时的完整许可清单。局部维护候选的安装/双端构建已通过，剩余上游包的维护解决状态未证实。下一步按当前首版命令和最终锁复核实际加载/构建路径，形成残余风险决定供用户确认。**R01 与 SP01 仍未通过。**

# SP01 Taro 候选锁剩余依赖风险：运行路径核对

对象是用户已采用的[局部维护候选](sp01-maintenance-candidate-20261030.md)，不是正式产品依赖锁。候选的 npm audit 仍报告 **32 个受影响包条目**（15 moderate、13 high、4 critical）；条目数不等于独立漏洞数，也不等于当前小程序可触达漏洞数。底层原始结果保存在 `.local/shared18-maintenance-final-audit.json`。本轮只读本地已安装源码和既有构建证据，未运行漏洞利用或远程模板下载。

按该 2026-10-30 原始报告中的公告 URL 去重后，共有 **23 个不同公告 URL**（5 critical、13 high、5 moderate）；逐条清单见[审计公告清单](sp01-r01-advisory-inventory-20261030.json)。这是同一份本地 npm audit 快照的派生索引，不是重新查询注册表，也不代表漏洞已触达或修复。包条目数与公告数不能互换；例如 `decompress` 一个包条目对应多个严重公告。

| 风险链 | 本地实际来源/路径 | 当前判断与保留动作 |
| --- | --- | --- |
| `download-git-repo` → `download`/`decompress` | 已安装 `@tarojs/cli/dist/create/fetchTemplate.js` 第16行直接导入 `download-git-repo`；该链供远程模板创建。此前普通小程序构建只加载模块，未下载或解压模板。 | 创建阶段风险仍在；正式建工程不得把来源不明模板交给此链，优先使用已核验的本地工程。不能因本次构建未触发就删除审计项。 |
| `@tarojs/components` → `swiper` | 实际候选锁为 `@tarojs/components@4.3.1` + `swiper@11.1.15`。本机 `mini/index.js` 第25–26行把 `Swiper`/`SwiperItem` 映射成微信原生标签字符串；同包 `dist/hydrate/index.js` 则 `require('swiper/bundle')`。上游[GHSA-hmx5-qpq5-p643](https://github.com/advisories/GHSA-hmx5-qpq5-p643)列出受影响范围 `>=6.5.1, <12.1.2`。 | 源码显示小程序和 H5 hydrate 路径不同。2026-11-01 在 `.local/sp01-shared-react18-maintenance-probe/apps/miniapp` 对最小隔离 weapp 样例运行 `SP01_CAPTURE_STATS=1 npm run build:weapp`：Webpack 成功，0 错误/警告，模块清单含139个模块、0 个名称匹配 Swiper 的模块；产物未发现 `swiper/bundle` 或 `SwiperJS` 标记。`taro.js` 仍含 Taro 原生 `Swiper` 属性元数据。该页只用 View/Text/Button，不含真实产品页面，证据只说明这份样例构建路径没有打入 Swiper 运行库，不能外推正式产品。Taro 4.3.1 固定依赖 11.1.15，改为12.1.2属主版本升级；尚未做升级适配测试或依赖变更。正式页面建立后需对真实产品包重复模块清单检查；在此之前继续保留公告风险，不把映射或样例结果写成漏洞已修复。 |
| `webpack-dev-server` 及中间依赖 | [已执行的入口加载对照](sp01-maintenance-candidate-20261030.md)中 `weapp` 未加载 H5 入口/DevServer，`web` 入口加载了它。 | 首版仅微信小程序端走 Taro `weapp`，网页后台走 Vite；仍需约束不要暴露本地开发服务，并在正式构建验证实际加载路径。 |
| `webpack@5.91.0`、`esbuild@0.21.5` | 候选安装目录的实际版本；Webpack 在 Taro 编译链，esbuild 在 helper/编译链。audit 中 Webpack 含 DOM clobbering 与 `buildHttp` 相关公告，esbuild 含开发服务跨站读取公告。 | 编译工具确实被使用，不能一概标“不适用”。正式工程须锁定构建输入、不启用未经核验的远程 `buildHttp` 导入，开发服务仅本机访问；更新路径和剩余公告需继续核对。 |

公告来源由本机 npm audit 指向：[Webpack DOM clobbering](https://github.com/advisories/GHSA-4vvj-4cpr-p986)、[Webpack buildHttp allowlist](https://github.com/advisories/GHSA-8fgc-7cc6-rx7x)、[Swiper prototype pollution](https://github.com/advisories/GHSA-hmx5-qpq5-p643)、[decompress 路径越界](https://github.com/advisories/GHSA-mp2f-45pm-3cg9)、[esbuild 开发服务](https://github.com/advisories/GHSA-67mh-4wv8-2f99)。这些链接描述公告范围；本文件不声称逐个漏洞已在项目里复现或修复。Swiper 上游公告当前标注修复版本为 12.1.2；与 Taro 4.3.1 固定的 11.1.15 存在主版本差异，尚未验证替换兼容性。

复用判断：沿用已通过普通兼容验证的 Taro 4.3.1 + React 18.3.1 候选、只做局部维护锁，不引入额外框架或复制 Taro 实现。CLI 远程创建能力和 H5 开发服务不是首版必需，先限制使用；构建器仍是必需依赖，不能靠“没在业务包里看到”判安全。本机对应 `package.json` 中 Taro CLI/组件/Runner、Webpack、esbuild、Swiper、decompress、download-git-repo 均声明 MIT；这只核对声明，不代替发布时的完整许可清单。局部维护候选的安装/双端构建已通过，剩余上游包的维护解决状态未证实。真实产品页面建立后需检查其 weapp 模块图；如果不含 Swiper 运行库，也要记录审查边界，不能仅凭最小样例免除公告风险。**R01 与 SP01 仍未通过。**

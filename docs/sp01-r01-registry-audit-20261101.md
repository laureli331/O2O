# SP01/R01 当前 Taro 候选注册表审计

检查日期：2026-11-01。对象为已经隔离并获用户采用的 Taro 4.3.1 / React 18.3.1 准备候选，不是正式产品依赖锁。原候选依赖锁保持不变；Webpack 覆盖仅在两个可丢弃的 `.local` 副本试验。没有启动开发服务器、下载模板、部署云资源或运行漏洞利用。原始审计输出留在本机忽略目录，摘要和校验值见[配套 JSON](sp01-r01-registry-audit-20261101.json)。

## 当前注册表结果

通过 `https://registry.npmjs.org` 对候选锁执行只读 `npm audit --package-lock-only`，命令以 1 退出，表示锁中仍有公告匹配。审计报告为48个受影响包条目、4 critical、13 high、31 moderate；按公告 URL 去重为25条。`--omit=dev`仍报告19个包条目（3 critical、2 high、14 moderate）。包条目和唯一公告都不是可利用产品缺陷的数量；`--omit=dev`也不能证明具体代码是否进小程序包。

配置的 npm 镜像对 audit endpoint 返回404 `NOT_IMPLEMENTED`，这次计数改由官方 npm registry 请求取得。旧的2026-10-30快照32条仍保留在[候选记录](sp01-maintenance-candidate-20261030.md)，不覆盖成新数字。新报告中新增告警使当前计数升高；两份快照不能直接当成同一时点或同一公告集合比较。

## 有证据的依赖路径与适用边界

| 路径 | 核验事实 | 当前处理与限制 |
| --- | --- | --- |
| 远程模板下载 | 本地 Taro CLI `fetchTemplate.js` 调用 `download-git-repo`；其压缩包分支通过 `download` 的 `extract: true` 到 `decompress@4.2.1`，clone 分支用 `git-clone@0.1.0`。GitHub 公告分别记录旧 `decompress` 无修复版及 `git-clone` 注入问题：[decompress](https://github.com/advisories/GHSA-mp2f-45pm-3cg9)、[symlink 绕过](https://github.com/advisories/GHSA-hrh2-vp3x-79xf)、[git-clone](https://github.com/advisories/GHSA-8jmw-wjr8-2x66)。 | 这是远程模板创建路径，不是普通本地 weapp build 路径；本轮未调用或下载模板。维护中的 `@xhmikosr/decompress@11.1.4` 是 MIT、ES module、要求 Node≥20。现有 `download@7.1.0` 是 CommonJS，`require('decompress')` 后按函数调用；仅换包名或 npm alias 不能当作兼容证明。没有加入 override，也没有称风险已修复。 |
| Taro Swiper | `@tarojs/components@4.3.1` 固定 `swiper@11.1.15`；公告将 `<12.1.2` 列为受影响：[GHSA-hmx5-qpq5-p643](https://github.com/advisories/GHSA-hmx5-qpq5-p643)。本地源码中 mini 入口把 `Swiper` 映射到微信原生组件名，H5 hydrate 入口则导入 `swiper/bundle`。既有合成 weapp 样例构建成功，139个模块里0个名称匹配 Swiper；页面不是产品页面。 | 样例结果只说明该样例没把 Swiper JS 运行库打进去。它没有修复依赖公告，也不能外推产品页面。官方 npm 元数据显示 `4.3.2-beta.2` 仍 pin `11.1.15`；没有采用 beta 或强制换到12.x。 |
| Webpack 与 H5开发服务器 | 候选含 `webpack@5.91.0`、`webpack-dev-server@4.15.2`、`webpack-dev-middleware@5.3.4`。Taro runner 的 `webpack` peer 版本精确声明为 `5.91.0`。官方公告要求 Webpack 至少达到5.94.0、5.104.0及5.104.1：[DOM clobbering](https://github.com/advisories/GHSA-4vvj-4cpr-p986)、[buildHttp重定向](https://github.com/advisories/GHSA-38r7-794h-5758)、[userinfo绕过](https://github.com/advisories/GHSA-8fgc-7cc6-rx7x)。因此本轮试验的最小共同修复候选为5.104.1。 | 在隔离副本试了两个版本：5.112.2的安装成功，但 Taro 加载时因找不到内部 `EntryDependency` 模块导致 weapp 构建失败；5.104.1成功完成 strict shared 检查、合成 weapp 类型检查与构建、Web类型检查与构建。5.104.1仍与Taro公布的精确 peer `5.91.0`不符，也未测产品页面或真机交互；不改采用锁、不当作正式兼容或已修复公告。现有CLI跟踪显示，普通 weapp build 启动时载入模板下载模块，但没有给出远程模板源或执行模板抓取；Swiper 与 H5 dev-server/middleware 未载入。这只限定当前命令路径，正式包仍待产品构建复核。 |

官方 npm registry 在检查时仍将 Taro 4.3.1 标记为 `latest`，4.3.2只有 alpha/beta dist-tag。检查的 beta 包元数据仍保留 `swiper@11.1.15`、`webpack@5.91.0` 精确 peer 和 `download-git-repo` 模板链，不能作为已修复的稳定版本。

## 复用结论与下一步

沿用已完成普通兼容验证的官方 Taro候选，不另换框架；问题集中在依赖版本和触发路径，没有找到可直接换用且已验证的成熟实现。Webpack 5.104.1现在是可继续验证的候选，但需要用户确认是否接受偏离 Taro 精确 peer 的窄范围覆盖，再做小程序交互验证；在此之前，原采用锁不变。对 `decompress`、Swiper和 H5开发服务器的公告仍按调用边界记录，正式产品 bundle 要在产品页面建立后复核。开源包的 MIT 声明已核查，发布包仍需独立生成完整许可清单。

**R01继续pending，SP01未通过。** 当前候选只用于隔离准备；Webpack 5.104.1覆盖的合成构建通过，但没有满足已发布的精确 peer 声明，也没有小程序交互证据。下一项是确认是否继续验证这条隔离覆盖路径。没有因此开始SP07，也未修改用户QuickStart。

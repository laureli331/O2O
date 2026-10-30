# SP01：局部维护候选与采用比较

本轮只在 `.local/sp01-shared-react18-maintenance-probe` 做隔离对照，原共享实验、用户 QuickStart 和云资源保持原状。候选不等于正式版本冻结，不启动SP07。

## 改什么与为什么

| 项目 | 原组合 | 候选 | 成本和边界 |
| --- | --- | --- | --- |
| Taro CLI使用的ZIP包 | adm-zip0.5.18，父包范围^0.5.12 | 0.6.1，限定旧父范围override | 超出父范围；每次升级Taro需复验普通解压契约。沿用上游实现，无自有解压器或fork |
| 复制/CSS压缩插件使用的序列化包 | serialize-javascript6.0.2，父范围^6.0.2 | 7.1.4，限定该范围override | 跨主版本；需保留普通选项/函数往返、真实缓存转换与CSS工作线程回归 |
| 网页Vite的构建peer | 可选esbuild，未直接声明 | 仅网页显式devDependency esbuild0.28.2 | 在Vite8.3.5声明支持范围内；用于保证重装后正确解析。Taro内部esbuild0.21.5仍按其范围保留，不做全局替换 |

React、React-DOM及相关类型仍18.3.1，TypeScript仍5.9.3；没有改变已确认的业务架构或运行时依赖方向。esbuild是Web专用构建依赖，与既有Vite/webpack分工一致，不是共享业务库。

## 复用调查

复用项目已有共享workspace、普通ZIP验证器、浏览器回归和已安装webpack插件。读取安装包调用点：Taro `fetchTemplate` 使用同步构造及extractAllTo；copy-webpack-plugin用序列化函数生成转换缓存键，css-minimizer-webpack-plugin向工作线程传递压缩参数。本轮用真实插件和它们解析到的新包验证，没有手改node_modules、造替代接口或用假插件替代实际调用。

[adm-zip发布记录](https://github.com/cthackers/adm-zip/releases)列出0.6.1及修复；包许可MIT、Node要求>=14。[serialize-javascript发布记录](https://github.com/yahoo/serialize-javascript/releases)显示7.1.4（2026-10-23）修正嵌套函数/箭头函数的普通方法序列化；包许可BSD-3-Clause、Node要求>=20，本地Node20.19.3满足。元数据和许可文件均已核对。esbuild0.28.2许可MIT、Node>=18；读取Vite8.3.5实际peer声明 `^0.27.0 || ^0.28.0` 后选用，不凭最新版标签推断兼容。

没有执行漏洞输入。ZIP只测试小型普通文本、中文路径、空文件和覆盖参数；序列化只使用固定自有普通数据和函数。Webpack夹具验证复制转换、连续两次构建复用缓存、CSS压缩工作线程（parallel=1）和关闭编译器。没有请求远程模板、云API或付费服务。

## 失败与复验不能省略

1. 沿用旧锁安装首次exit0，但实际仍是旧包；普通兼容测试首先失败，`npm ls`也报invalid。失败安装保留在候选 `node_modules.seeded`，锁保留 `seeded.package-lock.json`。后续生成器将原锁仅作为baseline证据，不当作新override已经生效。
2. 重新解析后两项实际版本正确，但首次 `npm ci` 让Web Vite的可选esbuild解析到Taro旧版，完整依赖树exit1。不能拿当时仍成功的build遮盖它。因此仅Web补显式peer锁定，再重新锁重放、检查依赖树和构建。
3. 所有证据以[最终JSON](sp01-maintenance-candidate-20261030.json)的最终复验为准；旧失败日志继续保留，不合并成一次全绿安装。

## 取舍建议与回退

最终复验：npm ci退出0、完整npm ls退出0、shared完整strict退出0、Web及微信目标构建退出0；同一实验锁下普通调用验证和Chrome1280/360宽度的递增/重置/刷新均通过，浏览器与服务关闭。最终审计仍退出1：15 moderate、13 high、4 critical，共32条；对照原37条移出adm-zip、serialize-javascript及两项受传播影响的插件条目、旧vite条目，新增0条。旧vite及其内嵌esbuild依赖链在重新解析时不再安装，randombytes也随序列化包更新移除；不将这些变化都归因于两个包各修了一个漏洞。

原锁SHA256核对一致，基线未变。新锁仅两个已存在包的版本发生变化，额外显式声明Web构建peer；React/DOM/类型和TS不变。完整日志/JSON保存在项目.local下，路径及实验锁哈希在配套记录中。不是供应商、真机或正式产品验收。

建议在确认后将此局部维护组合用于后续候选：保留Taro4.3.1及统一React18方向，有限修补上游传递依赖；每次升级父包时复跑保留的普通契约检查。相比保留旧候选，它减少已知受影响依赖；相比自建解压器/序列化器或维护Taro fork，长期代码和测试负担更小。

保留旧组合的短期迁移成本最低，但旧问题仍在；本轮查询npm dist-tags，Taro最新稳定版仍4.3.1，4.3.2只显示alpha/beta，不能声称存在已验证的稳定升级替代。切换预发布或架构需另做更大比较，本轮未采用。

采用前需确认的实际变化是“两个跨父范围override＋仅Web的显式构建peer”。这是[AGENTS.md](../AGENTS.md)所要求关键依赖采用前的具体比较；当前只准备可审阅候选，没有擅自冻结。回退只需继续使用未改的原实验锁和原目录；实验工具及记录可按本次Git提交回退，无数据迁移、采购或云端回滚。

审计计数是受影响包条目，不能当独立漏洞数。仍有未关闭条目；不把32项全部忽略，也不把此候选的普通兼容通过当产品安全、真机性能或SP01整卡通过。

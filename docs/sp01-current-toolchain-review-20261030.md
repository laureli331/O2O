# 当前共享实验锁：依赖核查续记

本轮只查询 npm 官方审计、读取公告及安装包源码，并采集一次普通微信目标构建的模块清单；没有执行漏洞复现、远程模板下载、解压或自动修复。没有更换已确认架构或升级依赖。

## 当前锁与历史计数的区别

审计对象为 `tools/sp01-shared-core-probe/workspace.package-lock.json`，Node20.19.3/npm11.16.0，registry.npmjs.org。`npm audit --json --ignore-scripts`退出1：moderate17、high16、critical4，共37个受影响包条目。原始报告在 `.local/shared18-audit-current.json`。本轮是新的双端workspace锁与当前数据库，不是旧archive-fix锁；即使总数同为37，也不能说是同一批问题，更不能把数字减少解释为已修复。

## 已定位的具体来源

| 包/路径 | 实际源码依据 | 目前能得出的结论 |
| --- | --- | --- |
| adm-zip0.5.18 | Taro CLI `dist/create/fetchTemplate.js` 引入该包，URL模板分支读取ZIP并调用extractAllTo | 远程模板获取链存在；普通build加载模块不等于执行解压。旧0.6.1候选有普通兼容证据，但尚未批准冻结，不偷偷应用到当前锁 |
| decompress4.2.1 | 同一创建器使用download-git-repo，后者默认download选项extract:true；download/index.js在相应条件调用decompress | 与远程仓库模板解包链有关；不能因为小程序产物没出现它就忽略开发主机风险 |
| swiper11.1.15 | @tarojs/components/package.json精确依赖；components/mini/index.js输出原生组件名，dist下另有swiper实现 | 包在安装树中；不能从npm critical标签直接推断微信原生Swiper路径受影响。仍需对实际编译/输入路径核对，当前不关闭 |
| 旧vite | @tarojs/plugin-framework-react的optional peer要求vite^4，普通安装树包含旧版本；其源码按compiler.type区分webpack5/vite分支 | 后台直接使用的Vite8.3.5不等于Taro插件的旧vite。不能全局强推8.x覆盖^4并破坏兼容，也不能把optional当成未安装 |

查阅[Swiper公告](https://github.com/advisories/GHSA-hmx5-qpq5-p643)、[decompress公告](https://github.com/advisories/GHSA-mp2f-45pm-3cg9)、[adm-zip公告](https://github.com/advisories/GHSA-7q85-xj36-vmfc)，与当前安装版本及调用来源相互核对；没有运行公告中的利用输入。公告用于判断受影响范围，不替代本项目路径证据。

普通构建复用已有 `CaptureBuildStats`（Webpack公开Stats API），`SP01_CAPTURE_STATS=1`只在该次命令进程启用。构建成功，156个不同名称条目、0错误、0顶层折叠模块；包含shared/react.ts和shared/model.ts。未出现swiper/、adm-zip/、decompress/、vite/模块名称。该结果只描述此合成入口的模块图，既不是运行时完整调用跟踪，也不能为未来页面、watch、模板创建、H5或开发主机安全背书。原始文件为 `.local/sp01-shared-react18-probe/apps/miniapp/build-evidence/webpack-stats.json`。

## 下一步范围

本轮完成“问题从哪条依赖链进入”的核实，没有关闭全部37项。后续应优先对可替换构建依赖提出局部升级/适配对照，并将模板获取与正式构建分开验证；不能使用npm建议的Taro1.x/3.x降级、自动audit fix或强制跨主版本来制造全绿。跨范围替换冻结之前给用户具体成本与回退比较；不重启漏洞复现。

用户无需为这次源码核查登录云端或操作手机。正式产品、SP01整卡和安全验收均未放行。源码及锁与本轮审计依据分开保留，不覆盖历史。

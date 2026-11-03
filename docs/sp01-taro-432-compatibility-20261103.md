# Taro 4.3.2 隔离候选复核

日期：2026-11-03。任务：SP01 / R01。结论：本地兼容候选可继续保留；**尚未采用为正式工程依赖，R01 pending，SP01 未通过**。

## 复用调查

- 项目内：复用既有隔离 SP01 Taro 样例形状与类型检查脚本，不建立正式工程，不改 QuickStart 或产品页面。
- 官方来源：[Taro 4.3.2 发布记录](https://github.com/NervJS/taro/releases/tag/v4.3.2)（2026-11-02）与[4.3.1 发布记录](https://github.com/NervJS/taro/releases/tag/v4.3.1)。检查了 CLI 4.3.2 随附默认模板；本候选仍从此前审查的 4.3.1 模板适配，只升级隔离工具链，避免将模板变化和工具链变化混在一轮。默认模板额外包含可选样例/平台配置，并出现 `PropsWithChildren<any>`，与项目 no-any 约束冲突，因此没有复制该模板。
- 依赖与许可：未新增第三方库。抽查已安装的 `@tarojs/cli`、`@tarojs/webpack5-runner` 元数据均为 MIT、Node `>=18`；runner 对 Webpack 的 peer 精确为 `5.91.0`，候选按用户决定保留该版本。测试使用 Node `20.19.3`、npm `10.8.2`。
- 成本与回退：候选位于独立目录，可删除该隔离目录回退；没有增加正式应用依赖或产生云端/采购费用。审计风险和全量第三方类型失败仍需在冻结前处理。

## 版本与审计比较

| 项目 | 4.3.1 对照 | 4.3.2 隔离候选 |
|---|---:|---:|
| React 18.3.1 / React DOM / 类型 | 18.3.1 | 18.3.1 |
| TypeScript | 5.9.3 | 5.9.3 |
| Webpack | 5.91.0 | 5.91.0 |
| public npm audit 受影响包条目 | 55 | 54 |
| Critical / High / Moderate / Low | 4 / 18 / 32 / 1 | 4 / 18 / 31 / 1 |
| `npm audit --omit=dev` 受影响包条目 | 21 | 21 |
| 其中 Critical / High / Moderate / Low | 3 / 2 / 15 / 1 | 3 / 2 / 15 / 1 |

两份报告均在 2026-11-03 从 `https://registry.npmjs.org` 刷新。差异为受影响包键 `stylus` 从候选报告消失，未新增键；已复核的 Taro CLI、components、webpack runner、adm-zip、decompress、download-git-repo、git-clone、swiper 严重度未变。npm audit 的“包条目”不是唯一公告数、可利用漏洞数或产品漏洞数；本次没有证据证明风险已修复，也没有把审计失败包装成通过。

另按 npm 的生产依赖分类执行 `npm audit --omit=dev --json --registry=https://registry.npmjs.org/`。基线与候选各有479个生产依赖，报告结果相同：21个受影响包条目（3 critical、2 high、15 moderate、1 low）。三个 critical 条目对应 `@tarojs/components`、`@tarojs/taro`、`swiper`；报告内可见的直接 critical 公告为 Swiper 原型污染 [GHSA-hmx5-qpq5-p643](https://github.com/advisories/GHSA-hmx5-qpq5-p643)。包条目可能沿依赖链传播，不能将三条当作三个独立公告。`--omit=dev` 只按这份隔离 manifest 的依赖分类过滤；它没有证明这些包能进入已发布小程序包、可被利用或构成产品漏洞，当前没有产品产物模块图可查。命令因报告漏洞返回1，原始报告分别保存在配套 baseline/candidate 目录。本次没有提出风险修复结论。

## 实际验证

| 检查 | 实际结果 |
|---|---|
| `npm run typecheck` | 退出码 0；应用 TS/TSX strict 检查通过。自有声明库存为 0，因此没有执行自有声明编译。 |
| `npm run typecheck:vendor` | npm 脚本退出码 2；TypeScript 退出码 2；108 个声明文件中报告 1,056 条诊断；`skipLibCheck` 保持关闭。失败保留。 |
| `npm ls --all --depth=0` | 退出码 0，无顶层依赖不匹配。 |
| `npm run build:weapp` | 退出码 0，编译约 3.47 秒；仅为隔离合成样例。 |
| 产物清点 | 17 个文件，共 307,122 字节；未验证开发者工具编译、真机或产品验收。 |

## 处理决定

该复核只说明 Taro 4.3.2 在当前锁定版本下可以构建隔离合成样例。它没有解决完整第三方声明诊断；全量 audit 有4个、omit-dev审计有3个 critical 受影响包条目，且本轮没有证明产品包可达性或风险已修复。候选不转为正式锁，不开始 SP07，不据此放行 SP01。R01 仍 pending；正式产品工程建立后须按实际模块图、开发者工具和真机证据重新评估。

机器可读结果与精确命令数据见 [配套 JSON](sp01-taro-432-compatibility-20261103.json)。

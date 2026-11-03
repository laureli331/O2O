# SP01/R01 官方 npm 注册表复核更正

日期：2026-11-03。范围：只读 npm 注册表元数据复核；未安装依赖、修改 manifest/lock、运行构建或改变云资源。

## 复核结果

使用 `npm view` 直查 `https://registry.npmjs.org/`：

| 包 | 当日查询结果 | 对 R01 的影响 |
| --- | --- | --- |
| `@tarojs/components@4.3.2` | 已发布；MIT；依赖 `swiper@11.1.15` | 4.3.2 稳定组件包现已可查。 |
| `@tarojs/helper@4.3.2` | 已发布；MIT | 稳定发布组缺包状态已变化。 |
| `@tarojs/runtime@4.3.2` | 已发布；MIT | 稳定发布组缺包状态已变化。 |
| `@tarojs/cli@4.3.2` | 已发布；MIT；仍依赖 `download-git-repo@^3.0.2` | CLI 元数据仍保留已审查的远程模板下载链。 |
| `download-git-repo` | latest `3.0.2` | 远程模板下载器版本未见变化。 |
| `decompress` | latest `4.2.1` | 已审查的归档解压依赖仍在该链中；见 [GitHub 安全公告](https://github.com/advisories/GHSA-mp2f-45pm-3cg9)。 |

这条记录更正 11 月 2 日 `sp01-r01-registry-follow-up-20261102` 中“4.3.2 稳定发布组缺包”的时点结论；不改写历史快照，也不推断当日查询返回 E404 的原因。Taro 4.3.2 的隔离兼容与审计结果仍以[兼容性记录](sp01-taro-432-compatibility-20261103.md)为准：候选未采用，应用 strict 检查、合成构建通过，但第三方声明全检失败，审计仍有受影响包条目。可查到完整稳定版本组本身不能证明安全风险已处理。

## 复用与风险边界

- 复用现有 Taro 4.3.2 隔离候选和发布复核，不另装包或重跑构建。
- 官方 Taro 源码显示，内置默认模板分支会在远程模板抓取前返回；GitHub/Gitee 远程模板会进入 `fetchTemplate`。来源：[Taro 4.3.2 project.ts](https://raw.githubusercontent.com/NervJS/taro/v4.3.2/packages/taro-cli/src/create/project.ts)。
- 该路径区分了“CLI 安装了下载链”和“某次使用实际触发下载/解压”。本次只更新注册表状态，不声称产品运行时可达、漏洞可利用或风险已修复。
- 使用已审查的 Taro CLI 4.3.2、`download-git-repo` 3.0.2 与 `decompress` 4.2.1，没有引入新的依赖候选。MIT 许可来自当日 npm 包元数据；此元数据查询不替代源码/产品包风险评估。

## 决定与后续

稳定依赖组现可查，但 CLI 下载链、npm 审计结果、第三方声明全检失败及尚无正式产品模块图的问题仍未闭环。**R01 继续 pending，SP01 未通过，SP07 不启动。**下一步继续基于现有锁和源码证据处理剩余审计风险；不得再把 11 月 2 日的 E404 作为当前发布阻塞，也不得据此直接冻结正式锁。

回退方式：该日期快照、索引引用和对应测试可随本记录的 Git commit 一并回退；未改依赖或云端状态。

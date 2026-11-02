# SP01/R01 官方 npm 注册表复核（2026-11-02）

## 核查方法

通过 `npm view` 查询 `registry.npmjs.org` 的 dist-tag、版本依赖、peerDependencies 和许可字段。只读取包元数据；没有安装 Taro 4.3.2、修改 manifest/lock、运行构建或重做安全审计。

## 结果

| 相关包 | 当前注册表结果 | 对 R01 的影响 |
| --- | --- | --- |
| `@tarojs/taro` | `latest=4.3.2` | 已有新的稳定版本，需要看整组依赖是否修复已识别路径。 |
| `@tarojs/cli@4.3.2` | MIT；仍依赖 `download-git-repo@^3.0.2` | `download-git-repo` 的 latest 仍为 `3.0.2`，远程模板下载路径没有变化。 |
| `@tarojs/components` | latest 稳定版仍为 `4.3.1`，依赖 `swiper@11.1.15`；查询 `4.3.2` 返回 E404 | 已审查的 Swiper 依赖路径没有新的稳定组件包证据可以消除。 |
| `@tarojs/webpack5-runner@4.3.2` | MIT；`webpack` peer 仍精确为 `5.91.0`，runtime peer 为 `4.3.2` | 与用户已确认的 Webpack 5.91.0 选择一致；没有理由改用 peer override。 |
| Taro 4.3.2 稳定依赖组 | `@tarojs/taro@4.3.2` 要求 `@tarojs/components@4.3.2`、`@tarojs/helper@4.3.2` peer，并依赖 `@tarojs/runtime@4.3.2`；对后面三个精确版本的注册表查询均返回 E404。它们当前 latest stable 均为4.3.1。组件 `4.3.2-beta.2` 存在，但绑定同号 beta Taro/runtime，且仍用 Swiper 11.1.15。 | 4.3.2 的稳定发布组在本次查询时不完整，不能按项目要求组成全套精确对齐的稳定锁。E404 是该时点的注册表观察，不推断发布原因。 |

可复查的注册表端点：[`@tarojs/taro@4.3.2`](https://registry.npmjs.org/@tarojs%2ftaro/4.3.2)、[`@tarojs/cli@4.3.2`](https://registry.npmjs.org/@tarojs%2fcli/4.3.2)、[`@tarojs/webpack5-runner@4.3.2`](https://registry.npmjs.org/@tarojs%2fwebpack5-runner/4.3.2)、[`@tarojs/components`](https://registry.npmjs.org/@tarojs%2fcomponents/latest)、[`@tarojs/components@4.3.1`](https://registry.npmjs.org/@tarojs%2fcomponents/4.3.1)、[`@tarojs/components@4.3.2` 查询](https://registry.npmjs.org/@tarojs%2fcomponents/4.3.2)、[`@tarojs/runtime@4.3.2` 查询](https://registry.npmjs.org/@tarojs%2fruntime/4.3.2)、[`@tarojs/helper@4.3.2` 查询](https://registry.npmjs.org/@tarojs%2fhelper/4.3.2)、[`download-git-repo`](https://registry.npmjs.org/download-git-repo)。

## 复用决定与边界

继续复用当前 Taro 依赖方向；用官方 npm 注册表核对新稳定版，不引入替代框架或新依赖。4.3.2 的元数据没有解决已审查的 CLI 下载器与 Swiper 路径，而且其稳定依赖组当前有精确版本缺包，无法按项目的版本一致要求形成完整发布组合。因此不更新现有锁文件，也不混用 beta/stable。Taro 核心、CLI 和 webpack runner 的注册表许可字段为 MIT；本次没有审阅 4.3.2 源码、验证维护质量、复现漏洞或检查产品包。

R01 继续 pending，SP01 不通过。正式页面建立后，要对实际锁文件及 weapp 模块图复核，再评估完整且兼容的依赖组合。不能将 registry 查询、旧样例构建或审计条目数表述为产品可利用性结论或漏洞修复证明。

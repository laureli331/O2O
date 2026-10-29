# SP01 编译工具候选验证

隔离的版本兼容性检查，不是SP07正式工程。尚未将这组候选冻结为产品依赖，也未选择网页后台框架。

候选：TypeScript 7.0.2、微信官方 miniprogram-api-typings 5.2.3。npm元数据与仓库关联已核对，完整依赖由本目录package-lock.json固定。

## 复现（仓库根目录，PowerShell）

将本目录package.json和package-lock.json复制到 `.local/sp01-toolchain-probe/`，执行：

```powershell
npm ci --ignore-scripts --no-audit --no-fund --prefix .local/sp01-toolchain-probe
& '.local\node-v20.19.3-win-x64\node.exe' tools/sp01-toolchain-probe/check.cjs
```

Node20二进制来自此前经官方SHA256校验的本地下载；本机Node24的结果另列，不能冒充云运行时。

输入与预期：

1. `fixtures/valid.ts` 使用原生App和wx类型，strict、完整声明检查、ES2018输出；编译成功、生成JS。
2. `fixtures/invalid.ts` 把数值作为wx.request的url，必须得到TS2322且不生成JS。编译器崩溃或其它错误不能算负例通过。
3. 将正确输出放入仅含合成App/wx的隔离VM，onLaunch写入预期SDK字符串。它只证明输出可执行，不是微信运行时。

每次编译生成项目内独立 `.local/sp01-toolchain-runs/compile-*` 目录，不覆盖原文件，不自动删除历史下载；最新摘要存 `.local/sp01-toolchain-last.json`。无云端或网络业务调用。测试 `node --test tests/sp01-toolchain-probe.test.cjs` 检查判定逻辑，实际编译由上面的命令独立执行；全量测试不依赖机器已有隔离依赖或下载的Node。

## 实际结果与限制

2026-10-29，Windows11、Node20.19.3：TypeScript7.0.2和类型5.2.3正例/负例/合成运行检查全部符合预期。该结果不证明开发者工具内置TS编译器版本、模板编译、手机兼容性、基础库最低支持范围或产品性能。正式采用需用户确认；SP07再通过锁文件复现并验证真实工程。

[TypeScript官方安装说明](https://www.typescriptlang.org/download/)、[微信官方类型仓库](https://github.com/wechat-miniprogram/api-typings)支持使用方式与来源。准确版本、engines及完整性通过npm只读元数据和本地安装核对，不凭文档首页猜版本。

回退仅按Git提交还原本目录和关联记录；生成目录与用户已有工程不混入提交，不重置或清理用户改动。

# SP01：单份共享核心的隔离验证

这里是合成计数器和假传输契约，不能作为正式产品业务、网络、权限或性能验收。运行目录为 `.local/sp01-shared-react18-probe`，不修改用户 QuickStart，不调用云服务。

`shared/` 中只有四份源码：契约、纯 reducer、注入传输的请求编排、React Hook。Web 和 Taro 分别用自己的标签绑定同一个 Hook。`useReducer` 是本次最小验证使用的现有 React 能力，不代表已经冻结正式产品的状态库。

## 准备与实际命令

从仓库根目录运行 `node tools/sp01-shared-core-probe/prepare.cjs`，生成隔离 npm workspace，恢复本目录的实验锁。**它会刷新隔离目录的夹具和游客 AppID 配置，不要在正在运行模拟器测试时重跑。**源码只保存在 workspace 的 `packages/shared/src`；两端通过同名包导出引用，没有复制业务核心到各端。

以下为已实际执行的安装、检查、构建命令。Node20.19.3 配合已安装 npm11.16.0；旧 npm10.8.2 首次解析发生内部错误，不能标为通过。

```powershell
$env:PATH='E:\O2O\.local\node-v20.19.3-win-x64;'+$env:PATH
# 在 E:\O2O\.local\sp01-shared-react18-probe 中执行
& E:\O2O\.local\node-v20.19.3-win-x64\node.exe 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' ci --ignore-scripts --no-audit --no-fund --cache E:\O2O\.local\npm-tool-cache
& E:\O2O\.local\node-v20.19.3-win-x64\node.exe 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run check:shared
& E:\O2O\.local\node-v20.19.3-win-x64\node.exe 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run build:web
& E:\O2O\.local\node-v20.19.3-win-x64\node.exe 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run build:weapp
```

仓库根目录执行实际编译器/模型检查与浏览器交互：

```powershell
& .local/node-v20.19.3-win-x64/node.exe --test tools/sp01-shared-core-probe/boundaries.real.test.cjs tools/sp01-shared-core-probe/core.real.test.cjs
& .local/node-v20.19.3-win-x64/node.exe tools/sp01-shared-core-probe/check-boundaries.cjs .local/sp01-shared-react18-probe/node_modules/typescript .local/sp01-shared-react18-probe/packages/shared/src
& .local/node-v20.19.3-win-x64/node.exe tools/sp01-shared-core-probe/browser.real.cjs
```

浏览器脚本使用本机已安装的 Chrome 和 Playwright Core，仅监听回环地址，拒绝外部请求，验证1280/360宽度的递增、重置和刷新，最后关闭临时浏览器及服务。脚本中的依赖路径是这台机器的实际路径，换机器需重新核实。

模拟器通过开发者工具 CLI 打开此隔离项目。测试时只在该目录绑定已确认目标 AppID，不上传、不预览、不部署。查询页面文本和按钮，再真实点击，不能用 `setData` 伪造状态。Taro 当前产物的按钮 WXML 使用内部 sid；先查询页面合成数据确定本轮实际 id，不能把 `_AJ`、`_AL` 视作稳定选择器。测试后只关闭该隔离窗口。

## 检查边界

共享层完整 strict 检查且不跳过第三方声明；Taro 应用沿用已批准拆分检查，第三方声明全检失败仍单独保留。AST检查复用 TypeScript Compiler API，拒绝显式any、所列平台全局、跨界模块和类型抑制，补查变量/参数/绑定及数组中的推断any；UI检查拒绝自有Interface、类型别名和显式any。它不是全部数据流、业务位置或副作用的完整证明，不能替代后续 lint、代码审查和服务端测试。

原始失败、修复、复用来源、许可和证据范围见 [验证记录](../../docs/sp01-shared-core-evidence-20261030.md)。实验锁不是正式工程依赖冻结，也不表示 Taro 安全项已经解决。

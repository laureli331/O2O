# SP01：React18单版本与共享核心验证

本轮验证用户已批准的架构在本机能否运行，结果见[JSON记录](sp01-shared-core-evidence-20261030.json)。正式工程仍未建立；用户 QuickStart、视觉资料和云资源没有修改。

## 实际结果与修复

隔离 npm workspace 包含两端 UI 和一份 `@o2o/sp01-shared` 源码；Web、Taro及共享包均解析到同一个共享文件和同一个根 React 实例。两端 React/DOM/类型18.3.1、TypeScript5.9.3，与批准策略一致。

第一次 Taro 构建失败：外部共享包的 TypeScript 没进入编译规则。查阅实际安装的 `@tarojs/webpack5-runner/dist/webpack/MiniWebpackModule.js` 第164—169行，确认官方实现支持 `mini.compile.include`，随后仅将共享源码目录加入该规则，两端构建通过。没有改写依赖源码、复制共享逻辑或手改产物。首次失败日志保留在 `.local/shared18-miniapp-build.log`，复验为 `shared18-miniapp-build-fixed.log` 和 `shared18-miniapp-build-final.log`。

Chrome156.0.8078.73在1280和360逻辑宽度实测：Count0→三次按钮点击→Count3→重置→Count0，刷新后仍为Count0；无横向溢出、页面错误、错误响应或外部请求。浏览器和预览服务已关闭。

微信开发者工具恢复登录后，隔离项目实际渲染Count0，点击递增后读到Count1、Count3，再点击重置读到Count0；没有调用云API。用 JSX id 等待按钮曾超时，查询 WXML 后发现实际 id 为Taro内部sid，按本轮实际id操作成功。这是测试选择器适配，不能视为正式页面稳定定位方案。已关闭本轮隔离窗口。

共享规则专项验证输入不变、正常/重置、非法负数和安全整数溢出；注入传输测试正常值、非法输入/返回值和离线异常。两个传输标签是同一接口的合成假实现，不能冒充 Web/微信真实网络。

## 复用调查与成本

| 需求 | 已查来源与本地实现 | 采用及范围 |
| --- | --- | --- |
| 同一状态逻辑供两个渲染器使用 | [React useReducer](https://react.dev/reference/react/useReducer)，已安装React18.3.1实现/许可 | 使用现有Hook和纯reducer，不新增状态库；文档网站当前版本较新，18.3.1兼容以本轮实际构建与运行确认。React许可MIT |
| 编译workspace外部TS | [Taro配置文档](https://docs.taro.zone/en/docs/config-detail/)，Taro4.3.1实际编译器源码 | `mini.compile.include` 局部适配，无补丁；Taro许可MIT。本轮网页抓取超时，具体行为由本地源码和失败/成功对照证实，不声称成功读取该网页 |
| 平台边界及any检查 | [TypeScript官方Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)，TypeScript5.9.3实际AST和类型检查器 | 自有薄规则复用官方解析器；许可Apache-2.0。项目现有检查没有覆盖这组shared边界，使用已有编译器比引入整套额外lint工具链成本更低；不自造解析器，不宣称覆盖所有类型流 |
| 浏览器回归 | 项目已有 `tools/sp01-web-react-probe/browser-smoke.cjs` | 增加可选文本/容器/交互回调，保留原默认流程；复用现有安装的Playwright和Chrome，无新增产品依赖 |

React、Taro、TypeScript是既有已批准候选，不新增关键依赖；本轮核对其安装包版本、许可和所用源码，记录可独立替换的适配。锁重放、双端构建和交互只是本组合的普通兼容证据，不证明全部上游维护风险已消除。

## 验证限制

React Doctor的changed模式跳过隔离目录；full模式报告扫描0文件，其100分不算有效代码扫描证据，不据此放行。有效证据是实际严格编译、负例、模型测试、Chrome与微信模拟器操作。

未执行真机页面、弱网、帧率、性能、业务权限、并发金额、恢复或生产测试。没有冻结正式状态库；没有解决Taro剩余依赖安全项或第三方声明问题。SP01仍未通过，SP07未开始。源码、生成器和实验锁单独提交，可按对应提交回退，用户文件不纳入提交。

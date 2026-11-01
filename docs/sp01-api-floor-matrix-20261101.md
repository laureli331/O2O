# SP01 微信 API 最低版本证据矩阵

日期：2026-11-01。本文只整理首版需求对应的 API 版本依据，不冻结小程序最低支持基础库，也不代表产品验收通过。结构化记录见 [JSON](sp01-api-floor-matrix-20261101.json)。

## 复用调查

- **项目现有依据**：核对 PRD、确认范围、规划、外部能力台账、SP01 技术环境和设备能力证据。业务要求已有来源，不另造功能。
- **平台官方来源**：采用微信小程序维护的 [API typings 仓库](https://github.com/wechat-miniprogram/api-typings)作为版本注记证据。审阅的固定提交为 `6092df9100c73b84e140c20b9a42a8e8799e0660`，包版本 5.2.3，MIT 许可；仓库说明 API 定义与文档同步生成，变更日志标注 API 定义更新至基础库 3.17.0。它适合查找显式版本注记，但不证明项目账号权限、真实运行结果或所有 API 的最低版本。
- **已选框架复用核查**：检查 Taro `v4.3.1` 固定版本（MIT，提交 `18ea23fc9031f5868a3f07bf895b9da6488b590e`）的云 API 类型和微信平台适配源码。类型将 `Taro.cloud.uploadFile`、`Taro.cloud.callFunction` 标为支持 weapp；适配源码直接赋值 `taro.cloud = wx.cloud`。这复用已选 Taro/CloudBase 路径，不引入额外依赖或复制代码。CloudBase 的 `2.2.3` 因而是该路径的条件性基础库下限，不是全局下限。
- **上传接口区分**：`Taro.cloud.uploadFile` 上传到 CloudBase 云存储；`Taro.uploadFile` 是向开发者服务器 URL 发起 HTTP 上传，若采用它需要自有服务器端点及相应授权设计。二者不能互换。产品文件授权和私有/公开副本规则仍需落实，故只记录首选 API 候选，不提前冻结产品存储流程。
- **维护与兼容**：本次不引入依赖、不复制第三方实现。微信开发者文档发布的 Markdown 版本已于 2026-11-01 直接读取；登录和普通文件上传 API 页没有给出通用小程序最低版本，插件专用版本注记不用于推算。对确实没有明确下限的 API 保留未知。
- **第三方方案**：当前任务是版本证据梳理，未发现需要第三方库解决的问题；不增加运行时依赖。

## API 与版本

| 首版能力 | API 候选 | 版本证据 | 采用状态与边界 |
| --- | --- | --- | --- |
| 登录态 | `wx.login` | 微信官方 API 页未声明普通小程序通用最低版本；页面中的 2.3.1 注记仅适用于插件。函数超时选项的版本要求不等于 API 下限 | 规划中引用该 API，但正式登录流程尚未实现验证，最低版本未知 |
| 已验证手机号 | `button open-type="getPhoneNumber"` | 按钮回调类型注记为 1.2.0；微信官方手机号指南明确，安全动态 `code` 流程从 2.21.2 起 | 业务要求已确认；将 2.21.2 记录为该手机号流程的**条件性下限**。账号适用资格、服务开通、费用和真机成功/失败仍由 E02 验证 |
| 隐私授权 | `button open-type="getPhoneNumber|agreePrivacyAuthorization"` 组合按钮 | 微信官方隐私指南明确隐私 API 和该组合按钮从 2.32.3 起支持；Taro 4.3.1 精确类型声明确认该组合语法。单独先同意再验证的按钮路径未在已审阅来源中找到普通小程序最低版本 | 用户已确认保留 V05 一键“同意并验证手机号”流程；组合按钮路线已锁定，路线最低基础库为 2.32.3。它不单独决定全局最低版本 |
| 图片选择 | `wx.chooseMedia`（`mediaType: ['image']`） | 微信官方 API 页明确普通小程序从基础库 2.10.0 起支持；2.11.1 是插件使用限制 | 图片能力已纳入 PRD，具体选择/裁剪/失败保留流程未锁定，需按已定图片数量和大小约束验证 |
| CloudBase 业务调用 | `Taro.cloud.callFunction`（weapp） | Taro 4.3.1 类型标为支持 weapp，平台适配源码直接映射到 `wx.cloud`；CloudBase 教程给 `wx.cloud` 的条件下限为 2.2.3 | 已有可复用适配候选；产品调用封装和真实业务流程未实现，不能据此冻结全局下限 |
| 图片上传 | `Taro.cloud.uploadFile`（weapp，首选现有适配候选） | Taro 4.3.1 类型标为支持 weapp，平台适配源码直接映射到 `wx.cloud`；CloudBase 教程给 `wx.cloud` 的条件下限为 2.2.3。另一接口 `Taro.uploadFile` 向开发者服务器 URL 发送 HTTP 上传；原生 `wx.uploadFile` 文档未给普通小程序通用最低版本，1.9.6 仅是插件使用注记 | 复用现有框架云存储适配，不另加上传 SDK。产品路径仍未冻结：须符合逐请求服务端授权和私有/公开副本设计，并验证弱网恢复 |
| 支付 | `wx.requestPayment` | 类型文件未标普通小程序最低基础库 | E04 能力/费用未核实；暂不纳入本轮运行下限 |
| 性能探针 | `wx.getPerformance` | 基础库 2.11.0 | 仅 SP01 诊断用途，不是首版产品能力，也不提供 FPS，因此不纳入产品下限 |

GPS 选点不列为必需项：确认的地址流程没有要求强制定位或调用 `wx.chooseLocation`。

## 下限结论

目前记录 API 路线级条件下限。手机号快速验证动态 code 流程为 2.21.2；用户已选择 V05 一键“同意并验证手机号”流程，采用 `getPhoneNumber|agreePrivacyAuthorization` 组合按钮，其路线最低基础库为 2.32.3。官方隐私指南与 Taro 4.3.1 声明相互印证；这个数值只约束已选流程，不是全局最低版本。复用 Taro 4.3.1 微信适配层的 `Taro.cloud.callFunction` / `Taro.cloud.uploadFile` 会直接调用 `wx.cloud`，对应 CloudBase 条件下限为 2.2.3。上传 API 候选因此已明确，但产品端权限、文件副本和恢复流程仍未验证。微信官方 `wx.login` 与 `wx.uploadFile` 页面没有声明普通小程序通用最低版本，不能用插件注记补齐。正式 Taro 工程尚不存在可用于验证完整运行路径的产品包。

四台测试设备最近提供的基础库报告都是 3.17.5。这是当前设备样本，不是最低支持承诺。iPhone 的该报告早于用户后来更新 iOS；备用华为较早一次报告为 3.17.4，后续报告为 3.17.5，历史值保留。

**结论：全局最低基础库和支持设备组继续留空，R03 仍为 pending。** 后续需以实际选定的登录、图片上传和 CloudBase 适配 API，核对其官方版本条件，并在形成产品包后做最低版本运行验证；E02 的账号能力也须单独核实。此结论不阻止不依赖该决定的本地工程准备，但 SP01 未通过前不启动 SP07。

## 来源

- [微信小程序 API typings 仓库](https://github.com/wechat-miniprogram/api-typings)
- [固定版本变更日志](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/CHANGELOG.md)
- [固定版本 API 类型定义](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts)
- [固定版本组件事件类型](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.event.d.ts)
- [固定版本云开发 API 类型](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.cloud.d.ts)
- [固定版本 Taro 4.3.1 Button 类型](https://github.com/NervJS/taro/blob/v4.3.1/packages/taro-components/types/Button.d.ts)（声明隐私同意与手机号按钮组合从基础库 2.32.3 起支持）
- [固定版本 Taro 4.3.1 Cloud API 类型](https://github.com/NervJS/taro/blob/v4.3.1/packages/taro/types/api/cloud/index.d.ts)（`uploadFile` 与 `callFunction` 均标记支持 weapp）
- [固定版本 Taro 4.3.1 微信平台适配源码](https://github.com/NervJS/taro/blob/v4.3.1/packages/taro-platform-weapp/src/apis.ts)（源码直接映射 `taro.cloud = wx.cloud`）
- [固定版本 Taro 4.3.1 HTTP 上传类型](https://github.com/NervJS/taro/blob/v4.3.1/packages/taro/types/api/network/upload.d.ts)（`Taro.uploadFile` 的 `url` 是开发者服务器地址）
- [微信 `wx.login` API 文档（Markdown）](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.login.md)（没有声明普通小程序通用最低版本；2.3.1 为插件专用）
- [微信 `wx.chooseMedia` API 文档（Markdown）](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/wx.chooseMedia.md)（普通小程序最低版本为 2.10.0）
- [微信 `wx.uploadFile` API 文档（Markdown）](https://developers.weixin.qq.com/miniprogram/dev/api/network/upload/wx.uploadFile.md)（没有声明普通小程序通用最低版本；1.9.6 为插件专用）
- [微信小程序隐私协议开发指南（Markdown）](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/PrivacyAuthorize.md)（隐私 API 及组合按钮从 2.32.3 起支持）
- [微信手机号能力指南（Markdown）](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getPhoneNumber.md)（安全动态 `code` 流程从 2.21.2 起）
- [CloudBase 官方小程序云函数接入教程（Markdown）](https://docs.cloudbase.net/recipes/add-cloud-function-wechat-miniprogram.md)（直接 `wx.cloud` 从基础库 2.2.3 起支持）
- [手机号 code 版本记录：维护仓库 issue #236](https://github.com/wechat-miniprogram/api-typings/issues/236)
- [微信小程序隐私协议开发指南（HTML）](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/PrivacyAuthorize.html)（canonical HTML 在本轮浏览器读取失败；同一官方文档的 Markdown 版本已直接读取）
- [微信手机号能力指南（HTML）](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getPhoneNumber.html)（canonical HTML 在本轮浏览器读取失败；同一官方文档的 Markdown 版本已直接读取）

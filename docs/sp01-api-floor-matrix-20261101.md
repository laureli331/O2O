# SP01 微信 API 最低版本证据矩阵

日期：2026-11-01。本文只整理首版需求对应的 API 版本依据，不冻结小程序最低支持基础库，也不代表产品验收通过。结构化记录见 [JSON](sp01-api-floor-matrix-20261101.json)。

## 复用调查

- **项目现有依据**：核对 PRD、确认范围、规划、外部能力台账、SP01 技术环境和设备能力证据。业务要求已有来源，不另造功能。
- **平台官方来源**：采用微信小程序维护的 [API typings 仓库](https://github.com/wechat-miniprogram/api-typings)作为版本注记证据。审阅的固定提交为 `6092df9100c73b84e140c20b9a42a8e8799e0660`，包版本 5.2.3，MIT 许可；仓库说明 API 定义与文档同步生成，变更日志标注 API 定义更新至基础库 3.17.0。它适合查找显式版本注记，但不证明项目账号权限、真实运行结果或所有 API 的最低版本。
- **维护与兼容**：本次不引入依赖、不复制第三方实现。微信官方文档直连在本次查询中无法取得正文；对没有明确标注的 API 保留未知，不用插件限定版本替代普通小程序下限。
- **第三方方案**：当前任务是版本证据梳理，未发现需要第三方库解决的问题；不增加运行时依赖。

## API 与版本

| 首版能力 | API 候选 | 版本证据 | 采用状态与边界 |
| --- | --- | --- | --- |
| 登录态 | `wx.login` | 维护版类型文件未标普通小程序最低版本；其中 2.3.1 是插件使用注记，不适用于本项目推算 | 规划中引用该 API，但正式登录流程尚未实现验证，最低版本未知 |
| 已验证手机号 | `button open-type="getPhoneNumber"` | 按钮回调类型注记为 1.2.0；动态 `code` 安全流程从 2.21.2 起的证据来自微信维护仓库 issue #236，官方指南页面本轮无法读取 | 业务要求已确认；将 2.21.2 记录为该手机号流程的**条件性下限**。账号适用资格、服务开通、费用和真机成功/失败仍由 E02 验证 |
| 隐私授权 | `button open-type="getPhoneNumber|agreePrivacyAuthorization"` 组合按钮 | Taro 4.3.1 精确类型声明将“同意隐私 + 获取手机号”组合按钮标为 2.32.3；微信维护版 API typings 也将 `wx.onNeedPrivacyAuthorization` 标为 2.32.3。单独先同意再验证的按钮路径未在已审阅来源中找到普通小程序最低版本 | 用户已确认保留 V05 一键“同意并验证手机号”流程；组合按钮路线已锁定，路线最低基础库为 2.32.3。它不单独决定全局最低版本 |
| 图片选择 | `wx.chooseMedia`（`mediaType: ['image']`） | 普通小程序最低基础库 2.10.0；2.11.1 是插件使用限制 | 图片能力已纳入 PRD，具体选择/裁剪/失败保留流程未锁定，需按已定图片数量和大小约束验证 |
| CloudBase 业务调用 | `wx.cloud.callFunction` 或批准的 Taro 平台适配路径 | CloudBase 官方小程序教程标注直接 `wx.cloud` 起步基础库为 2.2.3 | 仅适用于直接 `wx.cloud.*` 路径；正式适配路径尚未锁定，不能推算全局下限 |
| 图片上传 | `wx.cloud.uploadFile`、`wx.uploadFile` 或服务端中转 | 直接 `wx.cloud.uploadFile` 候选继承 2.2.3 条件下限；`wx.uploadFile` 类型注记 1.9.6 只适用于插件，普通小程序最低版本未标 | 图片权限方向已确认，上传路径仍未选定；需验证最终 API 与弱网恢复 |
| 支付 | `wx.requestPayment` | 类型文件未标普通小程序最低基础库 | E04 能力/费用未核实；暂不纳入本轮运行下限 |
| 性能探针 | `wx.getPerformance` | 基础库 2.11.0 | 仅 SP01 诊断用途，不是首版产品能力，也不提供 FPS，因此不纳入产品下限 |

GPS 选点不列为必需项：确认的地址流程没有要求强制定位或调用 `wx.chooseLocation`。

## 下限结论

目前记录 API 路线级条件下限。手机号快速验证动态 code 流程为 2.21.2；用户已选择 V05 一键“同意并验证手机号”流程，采用 `getPhoneNumber|agreePrivacyAuthorization` 组合按钮，其路线最低基础库为 2.32.3。这个数值只约束已选流程，不是全局最低版本。直接 `wx.cloud.*` 的 CloudBase 调用/上传候选条件下限为 2.2.3；图片上传路径仍未选定，`wx.login` 也没有在本次查阅的维护版类型资料中标注普通小程序最低版本。正式 Taro 工程尚不存在可用于验证完整运行路径的产品包。

四台测试设备最近提供的基础库报告都是 3.17.5。这是当前设备样本，不是最低支持承诺。iPhone 的该报告早于用户后来更新 iOS；备用华为较早一次报告为 3.17.4，后续报告为 3.17.5，历史值保留。

**结论：全局最低基础库和支持设备组继续留空，R03 仍为 pending。** 后续需以实际选定的登录、图片上传和 CloudBase 适配 API，核对其官方版本条件，并在形成产品包后做最低版本运行验证；E02 的账号能力也须单独核实。此结论不阻止不依赖该决定的本地工程准备，但 SP01 未通过前不启动 SP07。

## 来源

- [微信小程序 API typings 仓库](https://github.com/wechat-miniprogram/api-typings)
- [固定版本变更日志](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/CHANGELOG.md)
- [固定版本 API 类型定义](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts)
- [固定版本组件事件类型](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.event.d.ts)
- [固定版本云开发 API 类型](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.cloud.d.ts)
- [固定版本 Taro 4.3.1 Button 类型](https://github.com/NervJS/taro/blob/v4.3.1/packages/taro-components/types/Button.d.ts)（声明隐私同意与手机号按钮组合从基础库 2.32.3 起支持）
- [微信小程序隐私协议开发指南](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/PrivacyAuthorize.html)（本轮页面直连无法读取；API 版本依据来自固定版微信维护 typings，组合按钮依据来自固定版 Taro 声明）
- [CloudBase 官方小程序云函数接入教程](https://docs.cloudbase.net/recipes/add-cloud-function-wechat-miniprogram)（列出 `wx.cloud` 起步基础库 2.2.3；页面直开本轮超时，依据搜索返回的官方页面内容记录）
- [手机号 code 版本记录：维护仓库 issue #236](https://github.com/wechat-miniprogram/api-typings/issues/236)
- [微信手机号能力指南](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getPhoneNumber.html)（本轮链接正文无法读取，故不把其内容称为本轮直接核验）

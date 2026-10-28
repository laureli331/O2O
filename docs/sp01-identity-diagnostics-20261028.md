# SP01 身份调用诊断修复 — 2026-10-28

范围仅为身份调用与存储验证的当前阻塞。分支 `codex/miniapp-planning`，起点 `c4325f1`；未修改用户已有的项目配置、QuickStart、原型或素材改动。SP01 仍未通过，未进入 SP07。

## 已证实与未证实

- 用户最近真实客户端结果为 `IDENTITY_CALL_FAILED`、外层 `-1`、无请求 ID。日志无记录、函数 Active 都不足以证明调用停在哪一层。
- 本地缺陷：`identityCallDiagnostics` 只读取顶层错误码/请求 ID，丢弃 `errMsg` 和 `message`。对合成输入 `errCode: -1`、内层 `errCode: -504002`，旧代码无法保留内层码；修正后保留两者且不输出原始错误正文。这里的 `-504002` **是测试输入，不是用户这次调用的实测结果**。
- 真实云端失败原因仍未知；没有证据据此要求更换运行时、升级套餐、开启 CLS 或修改存储规则。此前跨账号可读写的原因也尚未确定。
- 官方 [运行环境表](https://docs.cloudbase.net/cloud-function/runtime-support) 列出 Node.js 16.13。微信 [SDK 官方仓库更新记录](https://github.com/wechat-miniprogram/wx-server-sdk) 确认 4.0.x 使用 `@cloudbase/node-sdk` 3.17.2；本地锁文件与已安装包一致。该依赖清单中所有声明的 `engines.node` 均不排斥 16.13；没有声明不等于已证明兼容。
- 腾讯托管的 [CloudBase 社区原始问题](https://cnb.cool/tencent/cloud/cloudbase/community/-/issues/969) 包含外层 `-1`、错误说明中嵌套数值码的调用者报错样本。仅用于设计合成回归输入，不采信其中 AI 回复的根因推断，不当作本项目真实调用证据。微信接口文档本次抓取失败，没有据此声称其保证固定错误文本格式。

## 本地改动及验证

1. 从错误说明中提取最多 8 个去重数值码和固定白名单标记；每段检查长度最多 8192 字符。保留外层码与独立的请求 ID，缺字段保持未知，不把未知结果当作权限拒绝。
2. 新增“仅诊断身份调用（不写文件）”按钮，沿用原按钮样式、按压反馈和禁用状态。复用既有 `workflow.identify`，成功和失败均不触发文件接口；不自动重试。没有调整正式产品页面或设计。
3. 增加本地运行时检查脚本 `tools/sp01-storage-probe/check-runtime.cjs`：子进程只接收合成上下文，加载真实锁定 SDK 和函数入口，拦截外连，检查合成身份摘要、错误 AppID 和缺失上下文分支。它不能证明云端上传包、Linux 环境或真实微信身份注入与本地一致。

测试环境为 Windows 11、本机 Node.js v24.18.0。输入及预期先写入 `tests/sp01-storage-probe.test.cjs`，再改实现：

| 检查 | 实际结果 | 原始本地证据 |
| --- | --- | --- |
| 新增用例在修复前 | 29 项中原 25 项通过、新 4 项失败；缺少内层码及独立身份入口 | `.local/sp01-diagnostic-red.log` |
| 修复后专项 | 29/29，通过；覆盖消息脱敏、非法/缺失字段、数值边界、去重、成功/失败无文件调用、并发重复点击不重复调用 | `.local/sp01-diagnostic-targeted.log` |
| 开发计划检查 | 43/43，通过 | `.local/sp01-diagnostic-plan.log` |
| 全量回归 | 1451/1451，通过；无跳过或删减断言 | `.local/sp01-diagnostic-full.log` |
| 真实 SDK/入口本地加载，Node.js 16.13.0 | 通过；合成身份摘要、错误 AppID 和缺失上下文分支均符合预期 | `.local/sp01-runtime-node16.json` |
| 同一入口，本机 Node.js 24.18.0 | 通过，同上 | `.local/sp01-runtime-node24.json` |

Node.js 16.13.0 检查命令：`node tools/sp01-storage-probe/check-runtime.cjs E:\O2O\.local\sp01-node16-check\node.exe`。运行时从 Node.js 官方 `https://nodejs.org/dist/v16.13.0/win-x64/node.exe` 下载至项目内独立目录，与同版本官方 `SHASUMS256.txt` 对照 SHA-256 为 `7fca04f83b0e2169e41b2e1845e8da0f07d66cf9c3a1b4150767bf3ffddccf62`；没有安装或替换系统 Node。

两次本地加载都拦截了一次 SDK 外连尝试，记录为 `blockedNetworkAttempts: 1`，没有发送该网络请求。锁定 SDK 的 `dist/utils/cloudplatform.js` 与 `metadata.js` 会在缺少云平台标记的本地环境中尝试查询元数据；此受阻尝试不影响上述合成身份检查。不要据此推断真实云端也发生相同尝试或超时。

结论仅为：**此本地包在 Windows / Node.js 16.13.0 下可加载并执行身份处理入口**。未验证云端实际代码包与本地逐文件一致、实际 Node.js 补丁版本、云平台身份注入或部署后的完整兼容性；不能把本地检查扩大成云端根因已排除。

新增按钮尚未刷新到真实手机，真机编译、布局和调用结果未执行，不冒充真机通过。本次没有任何云端调用、部署、设置修改或数据写入。

## 唯一下一步（待新的具体授权）

用户在隔离工程 `E:\O2O\tools\sp01-storage-probe` 刷新预览，账号 A 进入后只点击一次“仅诊断身份调用（不写文件）”，回传本机结果。固定 AppID `wx2414399d423dfb65`、环境 `cloud1-d2gjahlq39bf141c7`、函数 `sp01IdentityProbe`。不部署或改动该函数，不操作存储设置和文件。

这一步区分“身份调用可成功但原文件流程另有问题”和“身份调用本身仍失败”；若失败，可取得原来被丢弃的内层错误码/标记进一步缩小原因。若依然没有可提取信息，必须记录证据不足，不从 `-1` 猜原因。成功也只证明一次身份调用，不放行存储隔离或 SP01 整卡。

回退：使用本次独立提交的反向提交恢复探针本地改动；不重置工作区，不涉及云资源回滚。用户未提交文件不纳入本次提交。

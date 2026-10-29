# SP01 服务端条件分段读取探针

临时能力实验，不是产品接口，不证明用户身份授权、性能达标或 SP01 整卡通过。

## 验证与范围

- 固定 AppID：`wx2414399d423dfb65`；环境：`cloud1-d2gjahlq39bf141c7`。
- 普通云函数 `sp01RangeProbe`，Node.js 20.19，建议本次实验超时 60 秒；超时值不是产品性能预算。
- `inspect` 不写数据。`run` 仅创建随机路径 `sp01_range_probe/range-<32位随机十六进制>.bin` 的一份 5MiB 合成文件。
- 获取该文件的服务端临时地址，在服务端请求首段、中段、末段各 256KiB，核对 HTTP 206、Content-Range、ETag 和实际字节；错误 ETag 必须返回 412。
- 地址不返回客户端、不记日志。失败不降级整文件下载，不跟随跳转。
- finally 只删除本轮确切 fileID。函数被平台强制终止时 finally 不保证运行，必须只读核对目录；未知清理结果不可算通过。
- 不改存储权限、不访问已有业务文件、不执行账号 B 测试。此函数使用服务端权限，不能替代用户授权层验收。

## 本地构建

在仓库根目录执行 `node tools/sp01-range-probe/build.cjs`，再执行 `npm ci --ignore-scripts --no-audit --no-fund --prefix .local/sp01RangeProbe`。构建目录 `.local/sp01RangeProbe` 包含已锁定依赖，部署前应核对，不提交生成目录。

测试：`node --test tests/sp01-range-probe.test.cjs tests/sp01-range-reader.test.cjs`。相同用例已在本地 Node.js 20.19.3 执行；替身测试不能替代下面的真实云端结果。

## 云端操作顺序

1. 在目标环境创建上述普通函数并设置 Node.js 20.19、超时 60 秒；不要运行默认示例。CLI 未提供运行时选择，不能沿用默认 Node.js 16.13。
2. 将构建目录完整部署到同名函数；部署完成后只读核对运行时、超时、状态。
3. 控制台测试事件 `{"action":"inspect"}`。必须返回 `version: "range-probe-v1"`、Node v20.19.x、`writes: false`，否则停止。
4. 仅运行一次 `{"action":"run"}`，只保留返回 JSON。成功需三段 `matches: true`、`wrongEtagRejected: true`、`cleanupConfirmed: true` 且总 `success: true`。
5. 只读确认测试目录没有本轮残留，再删除本轮临时函数。若失败或超时，先记录结果、核对确切路径；不要自动重跑、批量删除或修改权限。

## 依据与限制

[COS 条件分段读取](https://cloud.tencent.com/document/product/436/64981)是平台公开能力依据；本探针验证它是否适用于本环境实际返回的地址，不能提前认为兼容。
[SCF 配额](https://cloud.tencent.com/document/product/583/11637)限制同步请求/响应大小，5MiB 文件 Base64 JSON 超出 6MiB，因此不能用一次 callFunction 返回全部内容。

已选 SDK 为 `@cloudbase/node-sdk` 3.18.7；其 downloadFile 没有 Range 参数，本探针只在服务端对自己的临时地址执行条件 HTTPS GET。即使本次通过，端到端分段授权、撤权、客户端重组及性能仍须后续验证。

回退：本地按对应 Git 提交还原本轮文件；云端仅清理本轮确切合成对象与临时函数。用户其他改动、原函数和权限设置不在范围内。

## 2026-10-29 本地验证记录

- Windows 11；官方 Node.js 20.19.3 Windows x64 压缩包经官方 SHASUMS256 校验，SHA256 为 `ee50fe3af2e4b43aef655c5126e0e4d995a391a787a9327596563a722ada2aa9`。
- Node.js 20.19.3：专项 9/9 通过；完整构建包入口能加载已安装 SDK，inspect 返回预期版本、运行时及 writes:false，未调用云端。
- 系统 Node.js 24.18.0：计划检查 44/44，全量 1489/1489 通过。
- 以上仅本地证据。云端函数尚未部署，本轮合成云文件尚未创建；真实条件读取及清理未执行。

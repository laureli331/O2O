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
3. 控制台测试事件 `{"action":"inspect"}`。必须返回 `version: "range-entry-v3"`、Node v20.19.x、`writes: false`、`dependenciesLoaded: false`，否则停止。此入口不加载 SDK；随后通过 `{"action":"dependencies"}` 单独检查依赖加载和初始化，不访问云端资源；必须成功后才执行 run。
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

## 部署后启动失败与诊断改动

首次完整部署已由工具确认成功，函数 Active / Nodejs20.19 / 60 秒。用户 inspect 返回 `0 code exit unexpected`，请求 ID `2c00c5ce-58cc-4720-be32-b165ab19db7a`，未取得 inspect JSON；不能据此确认 SDK 是根因。用户配置截图确认执行入口 index.main、内存256MB，未显示启动堆栈。

range-entry-v2 将无依赖 inspect 与 dependencies、run 分离。新增入口隔离测试在旧实现下失败，证明旧 inspect 会提前加载 SDK；这是诊断耦合问题的复现，不是云端退出根因复现。需要云端新版本返回结果后才能缩小故障范围。不修改运行时、内存或权限；不自动重跑文件实验。

用户随后回传：range-entry-v2 inspect 成功，运行时 v20.19.3、dependenciesLoaded:false；dependencies 返回 INITIALIZATION_FAILED / sdk-load / writes:false。因此入口可执行，异常发生于 require SDK，尚未执行 init；缺失依赖或兼容性根因仍未知。range-entry-v3 仅增加白名单异常类型/标准码/安全包名，不输出堆栈、原始消息或路径。该异常诊断用例先失败后修复，不能当作真实云端问题已修复。

## 首次真实分段实验结果（2026-10-29）

用户回传 range-entry-v3 的 MODULE_NOT_FOUND，缺少包为 @cloudbase/node-sdk。随后启用远程 npm 安装的完整部署请求，任务包装状态 success，但函数内层错误为 FailedOperation.UpdateFunctionCode（Updating 状态）；不得将该请求记为完整部署成功。只读核对函数恢复 Active 后，用户 dependencies 实测成功、writes:false，证明当次依赖加载及初始化可用。

用户随后运行一次 run，返回 success:false / range-probe-v1；路径 `sp01_range_probe/range-e0aa22db61169ff71f272d7baf164fc3.bin`；原文件 5242880 字节。首、中、末三段各262144字节，均 matches:true，耗时分别484、318、126毫秒。wrongEtagRejected:false，cleanupConfirmed:true。随后 CLI 只读目录列表为0项，确认本轮无残留。

以上支持本环境本轮三段内容读取正确及清理完成，不证明条件头生效、用户授权正确或性能达标。v1 丢弃了错误 ETag 请求的实际状态码，不能从 false 判断是206、403、网络错误还是其它结果。官方 [GET Object](https://cloud.tencent.com/document/api/436/7753)规定不匹配 If-Match 返回412；不能假设 CloudBase 返回的地址等同原生 COS 端点。

range-probe-v2 只新增错误 ETag 的数值状态码和有限枚举诊断，仍要求412才通过；不输出地址、响应正文或身份。相关用例先失败后修复，不降低原断言。更新后尚未执行新云端实验，禁止将其写成已修复或通过。

## 第二次真实结果与后续边界

用户回传 range-probe-v2，路径 `sp01_range_probe/range-757624ca043ce7435602f302137e81bb.bin`，原文件5242880字节。三段各262144字节均 matches:true，耗时435、212、179毫秒；wrongEtagHttpStatus:206、wrongEtagOutcome:http-error、wrongEtagRejected:false、cleanupConfirmed:true、success:false。CLI 随后只读列表确认 `sp01_range_probe/` 为0项。

明确结论：本轮错误 If-Match 请求返回206，并未满足预期412。不能声称实际 CloudBase 下载地址具有原生 COS 的全部条件请求语义，也不能将此次探针改判通过。三段读取正确和清理完成分别留证；单次耗时不算产品性能验收。

现有 readRange 同时校验响应 ETag、范围与长度；即使上游返回206，响应 ETag 不匹配也会在消费正文前拒绝。本地新增明确206场景验证这一保护，不能冒充历史云端响应头取证（v2未返回该响应头），也不能代替实际对象换版本/撤权验收。

不再重复相同412实验。下一步本地验证既定服务端授权层与响应版本校验组合：授权前后核对、版本不一致无字节交付、撤权期间无字节交付；私密内容仍只在服务端读取，不分发存储地址。上游 If-Match 只能作为额外保护，不作为唯一版本保障。该组合的真实云端及真机验收未执行，SP01不因此自动通过；临时函数尚保留，后续清理须单独记录。

随后已完成本地组合测试：复用现有 createChunkExperiment 与 readRange，在合成替身中分别模拟206响应ETag变化、读取期间撤权、授权版本切换，均不返回 data；另断言206错误ETag在消费正文前销毁响应。仅验证小缓冲组合及授权保护，不证明5MiB端到端分段组装或真实权限后端。Node.js20.19.3专项17/17、计划44/44、系统Node全量1497/1497通过。没有新增云文件或云调用；未升级任何SP卡状态。

## guarded-range-v1 组合验证方案

沿用已确认的服务端逐段授权与版本校验方向，新增临时事件 `{"action":"run","mode":"guarded"}`；不替换或改判原有要求412的失败实验。仍仅创建本轮随机路径的一份5MiB合成文件并在 finally 精确清理，真实云存储读取，授权由本轮函数内部固定合成身份与内存状态提供。返回 `evidenceScope: real-storage/synthetic-grants`，绝不称作真实账号A/B权限、持久化授权数据库、真实客户端或正式产品验收。

输入及预期：

- 正常：20个256KiB段，服务端逐段核对当前授权、对象绑定、版本、ETag、长度；完整逐字节及SHA256对照。正常读取总字节必须为5242880，不能重复下载整图；每段JSON应在实验上限512KiB以内（这是实验包络，未设产品性能门槛）。最终只返回摘要，不返回正文或存储地址。
- 合成B伪造角色/文件标识：FORBIDDEN，源站请求0次，无data。
- 旧请求版本：VERSION_CONFLICT，源站请求0次，无data。
- 读取期间合成撤权、授权版本变化：读取后再次核对，分别FORBIDDEN/VERSION_CONFLICT，无data。
- 错误预期ETag：只有实际readRange确认206响应范围正确但ETag不匹配，才返回VERSION_CONFLICT；普通206异常或网络失败仍是UNCONFIRMED，不能算通过。
- 重复读取：结果一致；并发合成A/B：仅A获取内容，B不触发存储读取，不共用可变身份。
- 任一缺段、异常、未知或清理未确认，总success:false。平台硬超时可能跳过finally，仍须只读回查目录，禁止自动重跑。

实现复用原readRange并增加有限枚举ETAG_MISMATCH，新增createGuardedReader在读取前后冻结并比较授权快照；每次仅读所需范围。授权前置测试先失败后实现，覆盖可变对象原地修改、边界、重复、并发和异常。不新增业务角色、集合或存储规则；临时函数不接受客户端指定任意URL。

部署仅更新 handler.js 与 range-reader.cjs，保持已可用的入口、依赖、运行时20.19、60秒和256MB配置。使用同名函数目录内的两文件增量包；部署后才由用户在控制台运行一次上述事件。真实云端结果尚未执行，不修改SP01状态。

本轮本地验证：Node.js20.19.3专项25/25，计划44/44，系统Node全量1505/1505通过。只读复核目标函数仍为Active / Nodejs20.19 / 60秒。以上测试包含注入替身，不等于云端组合通过。

回退：本地对应提交；云端可恢复这两个文件的上一版本，依赖与权限不变。异常时先查报告的确切cloudPath再处理，不能批量清空目录或自动重新创建文件。

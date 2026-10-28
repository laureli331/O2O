# SP01 CloudBase 受控探针操作记录

日期：2026-10-28。状态：最新只读详情确认临时函数`sp01EnvProbe`为`Active / Nodejs20.19`、超时配置30秒；用户提供的最新30秒`run`已执行完毕，但事务验收失败且清理失败。修正后的本地代码尚未上传，云端原因尚未确认。SP01未通过，云端函数部署、遗留记录清理和新一轮事务测试须先获用户明确授权。

此前恢复包上传成功（4个文件、12.6 KB）；`inspect`结构化响应通过，返回Node.js v20.19.3和SDK 3.18.7；`prepare`结构化响应通过，固定集合`sp01_probe_20261028`已创建。之后用户将超时调为30秒。下面分开记录3秒历史超时和最新30秒失败结果。

3秒历史run使用runId `sp01_f4157fdc182bda6f9fd8e37395d4943e`，返回433超时：`{"errorCode":-1,"errorMessage":"Invoking task timed out after 3 seconds","requestId":"5f15ce84-6771-432e-8d22-1d10bc53babc","statusCode":433}`。该次超时后只读查询显示固定集合存在、当前记录数为0（listCollections requestId `7fb04c35-77aa-4f5f-bd6c-666a87db5b3d`；describeCollection requestId `dc470f28-3ec9-4b3f-a59d-63b972f74eb9`）。这是超时后的历史读取，不能证明调用期间未写入或自动清理完成。

## 最新 run（30秒配置）

用户提供的结构化返回对应事件`{"action":"run","runId":"sp01_f892f63b9fdc4c11ae1254800a9e83cf"}`。回滚注入异常被观察到且无部分写入；提交后的两份记录未全部可见；两个并发事务均以 `INVALID_PARAM` 拒绝，重叠屏障已成功、没有屏障超时；清理返回失败。用户没有提供清理失败的具体消息或错误码，也没有本次调用后的只读记录查询，因此调用后记录状态未知，不能声称为空或已清理。

```json
{"success":false,"runId":"sp01_f892f63b9fdc4c11ae1254800a9e83cf","collection":"sp01_probe_20261028","commit":{"allDocumentsVisible":false},"rollback":{"abortObserved":true,"noPartialWrites":true},"concurrency":{"overlapObserved":true,"startBarrierTimedOut":false,"outcomes":[{"status":"rejected","reasonName":"Error","reasonCode":"INVALID_PARAM"},{"status":"rejected","reasonName":"Error","reasonCode":"INVALID_PARAM"}],"finalValue":null,"successfulTransactions":0,"stateConsistent":false,"resultRequiresReview":true},"cleanup":{"success":false,"runId":"sp01_f892f63b9fdc4c11ae1254800a9e83cf","collection":"sp01_probe_20261028","deletedCount":null},"failures":[{"phase":"cleanup","name":"Error","code":null}]}
```

## 本地 SDK 契约诊断

目标工程锁定`@cloudbase/node-sdk` 3.18.7，其数据库依赖为`@cloudbase/database` 1.4.3。该依赖源码的文档`set`和`update`接口接收平铺字段对象；旧探针传入`{data: fields}`，会把业务字段嵌套到`data`属性。本地SDK接口形状契约模拟测试复现并修复了字段对象问题：旧形状导致提交标记不可见、并发读取`value`缺失后更新参数不合法；改为平铺字段后，本地模拟接受请求并清理本轮记录。该模拟只核对SDK调用字段形状，不模拟CloudBase事务隔离或云端实现，不能作为事务验收通过证据。清理逻辑也增加了对本轮旧格式嵌套记录的精确归属识别，只允许删除五个固定ID中归属本runId的文档并逐个回查。

这是受锁定SDK源码和本地回归支持的根因判断，**云端根因尚未确认**，因为修正代码还未上传，且最新云端清理失败没有带回详细错误消息。当前本地修复不会修改数据库集合、其他运行ID、QuickStart模板函数或存储。

腾讯云[函数概述](https://cloud.tencent.com/document/product/583/19805)说明普通事件函数默认超时3秒、可配置范围为1至900秒；[云函数测试文档](https://cloud.tencent.com/document/product/583/56125)说明433/TimeLimitReached表示函数执行超过超时配置。用户报告已调高此临时函数超时，安装目录CLI只读详情确认当前配置为30秒。配置查询未调用函数；不自动重试此前失败的run。

## 较早错误运行时部署与恢复（历史）

首次重建的部署尝试曾遇到FailedOperation.UpdateFunctionCode，函数当时处于Creating状态（requestId 791efa4d-518f-41dd-9d90-4a802704a22f）；之后只读状态是Active / Nodejs16.13，集合为空（requestId 870fb9ca-db84-48bc-8304-4035df9ecc4e）。这段是恢复前的历史状态，不能用来描述当前函数。随后用户删除并以Node.js 20.19重建，最新恢复部署、inspect、prepare和超时后的只读结果均见本文顶部。

## 首次部署证据

部署前通过真实安装目录的开发者工具 CLI，显式指定目标 AppID `wx2414399d423dfb65` 与 EnvID `cloud1-d2gjahlq39bf141c7`，只读查询到云函数列表为空、数据库集合列表为空。用户已明确授权本次临时函数部署和固定合成测试集合，并确认 CLI 的部署确认请求。部署后再次只读查询，函数列表为且仅为 `sp01EnvProbe`，集合列表仍为空（requestId `bcac1880-0142-43a8-8e5d-4bbfcd5a1ab6`）。部署任务先返回等待用户确认，确认后函数列表出现该函数；没有复用或部署 QuickStart 函数。此证据只证明部署可见，不证明函数实际运行或数据库事务通过。

## 首次云端测试尝试与处置

用户提供的三张控制台截图分别显示提交了 `inspect`、`prepare` 和指定 `runId` 的测试事件，测试面板均标记“成功”。但“返回结果”区域显示的是输入事件本身，而不是本地探针应返回的运行时、集合或事务结果；日志中还出现 `Hello World` 与完整运行上下文。这些表现与本地 `sp01EnvProbe` 入口和处理器不一致，因此不能证明本地探针代码已执行，也不能判定运行时、事务或清理通过。当前记录不把这三次面板状态计为测试通过。

截图日志包含云函数自动注入的临时授权凭据字段和值。腾讯云[云函数环境变量文档](https://cloud.tencent.com/document/product/583/30228)将这些字段说明为临时授权信息；[常见问题文档](https://cloud.tencent.com/document/product/583/9180)说明临时密钥有效期为8小时。用户已删除首次部署的临时函数；随后重建的当前函数为Nodejs20.19，运行时恢复与首次测试历史分开记录。函数删除不证明已签发凭据即时失效。不要复制或转发未遮挡日志，不在项目记录中保存凭据值。

首轮函数删除后，使用安装目录 CLI 对目标 AppID `wx2414399d423dfb65` 和 EnvID `cloud1-d2gjahlq39bf141c7` 执行只读查询：函数列表为空；删除后的只读查询返回数据库集合列表为空（requestId `cf8e9a09-ac8a-4d7a-8359-43886e31874c`），因此固定测试集合当时不存在、没有可见记录。该查询不证明 `prepare` 曾否短暂创建集合后又删除，但截图不支持本地探针的 `prepare`/`run` 响应。任何后续部署或写入之前，仍须再次检查固定集合；对本轮运行标识，删除后重新读取五个确切 ID，不得清空集合、复用未知记录或以新运行标识绕开检查。当前只读状态见顶部最新部署记录。

### 部署入口和本地包复核

只读查看当前安装目录 CLI 的 `cloud_fn_deploy --help`，其 `--path` 必须是函数目录的绝对路径，且函数名取该目录名、每次只部署一个函数目录。目标工程配置的云函数根目录为 `cloudfunctions/`；本地探针的预期目录是 `E:\O2O\miniprogram\cloudfunctions\sp01EnvProbe`，其中 `package.json` 的 `main` 指向 `index.js`，入口导出 `main` 并调用本地 `handler.js`，锁文件固定 `@cloudbase/node-sdk` 为 `3.18.7`。本地预检测试覆盖这些包入口和依赖约束，并确认探针源码不包含 `Hello World` 占位行为。

现存证据没有保留历史部署调用的完整--path参数或上传包内容摘要，因此尚不能断定首轮日志为何出现Hello World。当前恢复部署已成功上传四个文件，inspect结构化响应通过；这不追溯证明历史上传包内容。后续操作只在用户再次确认具体测试步骤后进行；先核实超时配置和集合状态，不重复执行prepare，不复用历史运行ID，也不删除集合。

## 后续测试门槛与恢复顺序

历史运行标识`sp01_f95243389fa9ca4f7a407c90ce2052ef`、3秒超时运行标识`sp01_f4157fdc182bda6f9fd8e37395d4943e`和最新失败运行标识`sp01_f892f63b9fdc4c11ae1254800a9e83cf`均不得复用。固定集合已由prepare创建，不得再次执行prepare，也不得删除集合。修正后的本地代码尚未上传。若后续获明确授权，先仅部署更新后的`sp01EnvProbe`，再以旧runId调用`cleanup`（仅清理本轮固定ID且归属标记匹配的记录、保留集合和其他记录），最后用全新唯一runId运行一次事务探针并检查结构化回包；若归属不明、遇到付费提示或出现新错误，立即停止。部署、清理和新一轮云端写入均不在当前授权内。结构化事件输入/输出契约由本地探针实现和测试定义；本地包检查不证明云端调用结果。

## 范围与隔离

- 目标小程序：`wx2414399d423dfb65`；目标环境：`cloud1-d2gjahlq39bf141c7`（环境名 `cloud1`）。用户已报告在 `E:\O2O\miniprogram\cloudfunctions` 的“当前环境”中选中 `cloud1`；该选择尚未通过开发者工具截图再次验证。
- 临时函数目录：`E:\O2O\miniprogram\cloudfunctions\sp01EnvProbe`。用户的 `quickstartFunctions` 目录和模板文件不属于本探针，不修改、不上传。
- 运行时按用户确认选用 Node.js 20.19；直接依赖 `@cloudbase/node-sdk` 固定为 `3.18.7`，完整传递依赖写入 `package-lock.json`。本机 Node 24.18.0 与云函数运行时分开记录。
- 数据库按用户查看后的报告记录为文档型数据库，尚未通过 API 复核。探针只在固定集合 `sp01_probe_20261028` 工作；若该集合已存在，`prepare` 会失败并停止，不能复用或清空已有集合。
- 只使用随机生成的 `sp01_` 加 32 位小写十六进制运行标识和不含个人信息的合成字段。测试前再次只读核对目标环境的函数与集合列表；若集合或函数状态与预期不符，停止并先审查。

## 测试输入与预期

此前授权覆盖临时函数、固定集合和随机合成记录的受控测试，不包括存储写入或生产操作。修正代码部署及后续云端清理/重跑仍需明确授权。腾讯云官方[事务文档](https://docs.cloudbase.net/database/transaction)说明事务只支持服务端 Node SDK，并列出 `runTransaction`、文档操作和限制；这些公开能力不能替代本环境实测。

| 顺序 | 操作与输入 | 预期与证据 |
| --- | --- | --- |
| 1 | **首轮历史已完成后已删除**：首次部署过 `sp01EnvProbe`，用户随后删除 | 首轮部署前函数/集合均为空；部署后列表曾仅有探针。首轮删除后函数与集合只读列表为空。之后的恢复部署当前为Active / Nodejs20.19；最新run返回433超时，见顶部状态。历史部署及删除不证明本地探针代码正确上传。 |
| 2 | **已尝试但未验证**：函数测试事件 `{"action":"inspect"}` | 截图返回区域显示输入事件，不含预期运行时与SDK字段；运行日志含 `Hello World` 和运行上下文。运行时验收未通过。 |
| 3 | **已通过**：函数测试事件 `{"action":"prepare"}` | 用户提供结构化响应 `{success:true,collection:"sp01_probe_20261028",created:true}`；固定测试集合已创建。 |
| 4 | **历史失败**：run事件，runId `sp01_f4157fdc182bda6f9fd8e37395d4943e`，超时3秒 | 用户返回433执行超时；事务未完成验证。超时后历史集合查询显示记录数0，自动清理仍未证明。该运行标识不复用。 |
| 5 | **失败，尚未复验**：run事件，runId `sp01_f892f63b9fdc4c11ae1254800a9e83cf`，超时30秒 | 回滚通过；提交记录不可见；并发事务均以`INVALID_PARAM`拒绝；清理失败。没有调用后的只读记录查询，记录状态未知。修正代码尚未部署，云端原因尚未确认。 |

`run` 在提交、回滚、并发任一验证抛错时仍尝试清理本轮文档；只要清理失败或回查发现遗留，响应必须是失败，且不得继续宣称通过。并发阶段有1.5秒启动屏障超时，且只有两个事务在超时前都完成首次读取才记录重叠；串行执行或屏障超时会作为未通过结果。探针只返回有限的状态摘要，不返回文档内容。不可将本地内存数据库结果当作云端事务证据。

## 恢复与已知限制

1. 若部署失败或函数测试返回未知结果，停止重复写入；保留脱敏错误码/请求 ID和控制台日志，不广泛重试。
2. 若记录未清理，先用同一运行标识调用 `cleanup`；仅当记录标记校验通过时才删除。如果不能确认归属，停止并保留现场供人工审查。
3. 按既定恢复边界保留 `sp01_probe_20261028` 为空集合，不删除集合或任何非本轮记录。
4. 当前安装目录的开发者工具 CLI没有云函数调用或删除命令；云端执行需通过开发者工具/控制台的函数测试入口，临时函数测试后需在函数管理页人工删除。删除动作只针对本轮创建的 `sp01EnvProbe`，不触碰其他函数。
5. 当前存储是空目录且权限配置为“仅创建者可读写”的截图证据；服务端管理员权限不等于客户端逐角色验收。匿名、所有者、其他用户、临时链接到期和撤权测试需要另行确认身份与具体云写入授权，本探针不测试存储权限。

## 本地验证证据

`node --test tests/sp01-environment-probe.test.cjs`：15项本地测试通过；`node --test tests/sp01-cloudbase-sdk-contract.test.cjs`：1项锁定SDK字段形状模拟测试通过。测试覆盖事件白名单、探针流程、异常后清理、旧格式本轮记录安全清理、集合保留、运行标识及凭据边界、部署包入口和字段对象契约。结果只证明本地逻辑和模拟行为，不替代云端复验。最新30秒run明确未通过，失败输出及调用后记录状态未知如上；本地SDK形状修复尚未上传。

## 参考

- [CloudBase 数据库事务](https://docs.cloudbase.net/database/transaction)：服务端 Node SDK、事务读写方法及公开限制。
- [CloudBase 测试云函数](https://docs.cloudbase.net/cloud-function/develop/how-test)：控制台与微信开发者工具均提供带自定义 JSON event 的函数测试入口。
- [CloudBase 云函数资源集成](https://docs.cloudbase.net/cloud-function/resource-integration/cloudbase)：普通云函数访问 CloudBase 资源的说明；部署后仍须本环境实测。
- [CloudBase Node SDK 3.18.7](https://www.npmjs.com/package/@cloudbase/node-sdk/v/3.18.7)：锁定版本；本地已按此版本生成锁文件并检查事务 API。

# SP01 CloudBase 受控探针操作记录

2026-10-28最新代码更新确认任务`confirmation_cloud_fn_deploy_666ced08-b2fa-49af-8c21-17857ea251ba`返回`success / execution_success`。安装目录CLI随后只读确认`sp01IdentityProbe`为Active / Nodejs16.13 / 3秒，并列出`sp01_permission_probe/`为0个文件。此次只读核对未调用函数，不证明小程序身份通路或存储权限。

初次代码更新任务`confirmation_cloud_fn_deploy_bf930b45-03a9-4b9b-841d-bf63d005d38b`返回`success / execution_success`，包统计为5833个文件、6.7 MB。之后最新代码更新任务`confirmation_cloud_fn_deploy_666ced08-b2fa-49af-8c21-17857ea251ba`也返回`success / execution_success`，包统计相同，更新后只读详情仍为`Active / Nodejs16.13 / 3秒`。这证明代码包已部署，不证明客户端调用成功；目前没有本轮云存储写入。便于手机扫码的预览二维码图片保存在本地忽略目录`tools/sp01-storage-probe/.local/sp01-identity-probe-preview-20261028.jpg`，未纳入版本控制。

紧邻手机验收前的只读预检再次确认目标环境函数列表仅含`sp01IdentityProbe`，详情为`Active / Nodejs16.13 / 3秒`；`sp01_permission_probe/`目录返回`totalCount: 0`。此快照证明开始测试前目录为空，尚无真实微信客户端函数调用或本轮文件写入。

2026-10-28预览推送与二维码生成已成功：安装目录CLI返回成功。独立工程`E:\O2O\tools\sp01-storage-probe`，目标AppID `wx2414399d423dfb65`，探针代码固定EnvID `cloud1-d2gjahlq39bf141c7`，入口`pages/index/index`，CLI报告预览包大小32120。此项只证明预览包生成/推送成功；尚无真实微信客户端打开、函数调用、身份比对或本轮文件写入证据。账号B未加入成员名单；若B无法打开预览，应先处理预览权限并停止，不将访问入口失败当作文件权限结论。

随后本地源码新增创建者临时文件清理保护：失败时不分享测试包，云端清理未确认时提示精确路径。上述既有预览包不包含该修正，账号A/B不可用旧二维码继续验证；需要先刷新独立探针预览。尚未生成新二维码，也没有新的云端写入或部署。

日期：2026-10-28。状态：目标环境`sp01EnvProbe`（Nodejs20.19 / 30秒）的最新事务探针通过：提交、回滚、并发一致性及清理均满足探针断言；清理后五个固定ID均无遗留。用户随后报告已删除该函数，之后只读函数列表确认目标环境为空。一次性文件权限探针曾显示第二测试账号成功读写合成文件；账号未加入管理员/开发者名单，测试文件已定向删除并验证目录为空，权限设置未修改。随后用户授权一次新的完整身份/存储验证：临时函数`sp01IdentityProbe`已部署，首次代码更新因函数处于Creating失败，Active后重试上传成功（5833个文件、6.7 MB）。只读详情为`Active / Nodejs16.13 / 3秒`，与此前选择的Node.js 20.19不同；运行时不能在创建后修改。探针页面已在独立模拟器编译打开。尚未从客户端调用身份函数，`sp01_permission_probe/`在账号A操作前为空；双账号身份比对和文件测试仍待执行。本次授权只覆盖这一轮身份/单文件验证，不改存储权限或其它云资源。

## 2026-10-28 最新身份探针部署与待执行步骤

部署前只读预检：目标AppID `wx2414399d423dfb65` 的环境列表仅含`cloud1-d2gjahlq39bf141c7`；云函数列表为0；只读列出`sp01_permission_probe/`为0个文件。此前一次性授权覆盖部署临时函数、账号A写一份合成文件、账号B先核对身份；若摘要相同立即停止，若不同才做读取/同路径写入并按确切fileID清理。本次不改权限设置、不触碰其他函数或数据。

首次`cloud_fn_deploy`创建函数后尝试代码更新，云端返回`FailedOperation.UpdateFunctionCode`并说明函数处于`Creating`。只读详情随后显示函数`Active / Nodejs16.13 / 3秒`。按锁文件在本地执行`npm ci --ignore-scripts --no-audit --no-fund`成功；第二次针对同一AppID、EnvID及函数目录的部署经用户确认后返回成功，包统计为5833个文件、6.7 MB。部署后只读复核仍为`Active / Nodejs16.13 / 3秒`。CloudBase官方[SCF更新函数配置文档](https://cloud.tencent.com/document/product/583/18580)明确运行时在创建时指定且当前不能修改；此临时身份函数与先前Nodejs20.19事务探针分开记录，不将前者运行时当作已验证通过。

微信开发者工具CLI已将独立工程模拟器打开至`pages/index/index`，返回成功。部署后没有从控制台测试入口调用身份函数，也未执行任何存储写入。用户需在真实微信客户端由账号A创建测试包并上传文件；账号B粘贴测试包后先比对摘要。若报告身份摘要相同，立刻停止，不进行读取/临时链接/写入；若不同，才按页面流程进行受限测试。只需回传页面的脱敏结果文本，不转发完整测试包、临时链接或开发者工具日志。若账号B写入明确被拒，由账号A按测试包内准确fileID完成删除；若账号B写入成功，由探针立即尝试删除自己刚写入的fileID。任何未知错误或清理未确认都停止，之后只读核对确切测试目录。

## 2026-10-28 存储跨账号权限探针（单文件隔离失败；文件已清理）

用户另行确认并授权一次隔离文件测试：仅在目标AppID `wx2414399d423dfb65`、EnvID `cloud1-d2gjahlq39bf141c7` 使用一份合成文件和第二个微信测试账号验证访问，测试后清理该确切文件。测试页面显示的合成云端路径为`sp01_permission_probe/owner-probe-20261028-a7c31e.txt`；测试账号为第二测试账号，不记录账号标识或真实用户资料。根据控制台先前显示的“仅创建者可读写”设置，预期第二账号读取和写入均被拒绝。

用户提供的两张测试截图显示：第二测试账号成功读取并写入合成文件，页面提示权限未隔离。用户确认该账号未加入目标小程序或CloudBase的管理员/开发者名单，且是另一个微信测试账号。CloudBase[存储基础权限说明](https://docs.cloudbase.net/storage/data-permission)说明，创建者规则允许管理员读写；排除管理员后，本次成功读写构成该测试文件的**跨账号隔离失败**。两个账号的`_openid`未直接采集，故结论限定在用户报告的第二测试账号与该文件，不外推到所有目录、用户或访问方式。没有更改CloudBase存储权限或其他云端设置。

清理时用户先在存储根目录未找到该文件。随后对确切路径发起删除，云端操作返回成功；只读查询`sp01_permission_probe/`返回0个文件，用户也再次报告根目录显示“暂无数据”。清理结果为**已验证无该测试文件**。未删除目录外文件，没有重建文件；匿名访问、临时链接到期、撤权及其他角色仍未测试。若需诊断、修改配置或复测，必须先形成明确步骤和回退办法，并取得新的具体云端写入授权。

## 最新恢复进度（授权后）

用户明确授权的范围仅为目标AppID `wx2414399d423dfb65`、EnvID `cloud1-d2gjahlq39bf141c7`、临时函数`sp01EnvProbe`与固定集合`sp01_probe_20261028`中的合成记录；不得改动其他函数、集合、记录或存储。通过微信开发者工具 CLI（项目`E:\O2O\miniprogram`）只读核对：环境列表仅含目标EnvID，函数列表仅含`sp01EnvProbe`；函数状态`Active`、运行时`Nodejs20.19`、超时30秒。CLI没有数据库记录查询或函数调用命令，不能据此判断旧run的记录是否仍存在。

为避免先清理再判断，已在本地探针加入`inspectRun`只读事件：只读取该runId对应的五个固定文档ID，返回存在状态、记录归属/格式摘要，不返回记录内容，也不写入或删除。`tests/sp01-environment-probe.test.cjs`及`tests/sp01-cloudbase-sdk-contract.test.cjs`本轮共17项通过。修正版已通过开发者工具CLI更新到目标环境，上传4个文件、13.0 KB；部署后只读复核函数为`Active / Nodejs20.19 / 30秒`，函数列表当时仅含`sp01EnvProbe`。用户提供的只读`inspectRun`返回`safeToClean:true`、`presentCount:3`；五个指定ID中三条均标记为`owned / legacy-nested`，其余两条为`missing`。定向`cleanup`删除旧run的3条自有记录，并回查确认五个固定ID均无遗留。随后使用全新runId `sp01_3db660bc5eb548559f4f6966a34209a2`执行一次事务探针，返回`success:true`：提交可见、注入异常触发回滚且无部分写入、并发事务重叠并均成功且最终值为2，自动清理删除3条记录并通过删除后回查。用户报告已删除临时函数；随后对目标AppID `wx2414399d423dfb65`、EnvID `cloud1-d2gjahlq39bf141c7`执行只读`cloud_fn_list`查询，返回`total:0`、`list:[]`。此次一次性新run授权已用完，不再进行云端写入或重跑。

用户提供的只读检查返回值：

```json
{"success":true,"runId":"sp01_f892f63b9fdc4c11ae1254800a9e83cf","collection":"sp01_probe_20261028","safeToClean":true,"presentCount":3,"documents":[{"id":"sp01_f892f63b9fdc4c11ae1254800a9e83cf_commit_a","state":"owned","format":"legacy-nested"},{"id":"sp01_f892f63b9fdc4c11ae1254800a9e83cf_commit_b","state":"owned","format":"legacy-nested"},{"id":"sp01_f892f63b9fdc4c11ae1254800a9e83cf_rollback_a","state":"missing"},{"id":"sp01_f892f63b9fdc4c11ae1254800a9e83cf_rollback_b","state":"missing"},{"id":"sp01_f892f63b9fdc4c11ae1254800a9e83cf_concurrency","state":"owned","format":"legacy-nested"}]}
```

用户提供的定向清理返回值：

```json
{"success":true,"runId":"sp01_f892f63b9fdc4c11ae1254800a9e83cf","collection":"sp01_probe_20261028","deletedCount":3}
```

此前恢复包上传成功（4个文件、12.6 KB）；`inspect`结构化响应通过，返回Node.js v20.19.3和SDK 3.18.7；`prepare`结构化响应通过，固定集合`sp01_probe_20261028`已创建。之后用户将超时调为30秒。下面分别记录3秒历史超时、修正前的30秒失败和修正后的30秒成功结果。

3秒历史run使用runId `sp01_f4157fdc182bda6f9fd8e37395d4943e`，返回433超时：`{"errorCode":-1,"errorMessage":"Invoking task timed out after 3 seconds","requestId":"5f15ce84-6771-432e-8d22-1d10bc53babc","statusCode":433}`。该次超时后只读查询显示固定集合存在、当前记录数为0（listCollections requestId `7fb04c35-77aa-4f5f-bd6c-666a87db5b3d`；describeCollection requestId `dc470f28-3ec9-4b3f-a59d-63b972f74eb9`）。这是超时后的历史读取，不能证明调用期间未写入或自动清理完成。

## 上一轮失败的30秒 run（修正部署前）

用户提供的结构化返回对应事件`{"action":"run","runId":"sp01_f892f63b9fdc4c11ae1254800a9e83cf"}`。回滚注入异常被观察到且无部分写入；提交后的两份记录未全部可见；两个并发事务均以 `INVALID_PARAM` 拒绝，重叠屏障已成功、没有屏障超时；清理返回失败。该回包当时没有清理错误细节或调用后读取，所以当时的记录状态未知；后续`inspectRun`和定向`cleanup`结果已另行记录，并确认清理完成。

```json
{"success":false,"runId":"sp01_f892f63b9fdc4c11ae1254800a9e83cf","collection":"sp01_probe_20261028","commit":{"allDocumentsVisible":false},"rollback":{"abortObserved":true,"noPartialWrites":true},"concurrency":{"overlapObserved":true,"startBarrierTimedOut":false,"outcomes":[{"status":"rejected","reasonName":"Error","reasonCode":"INVALID_PARAM"},{"status":"rejected","reasonName":"Error","reasonCode":"INVALID_PARAM"}],"finalValue":null,"successfulTransactions":0,"stateConsistent":false,"resultRequiresReview":true},"cleanup":{"success":false,"runId":"sp01_f892f63b9fdc4c11ae1254800a9e83cf","collection":"sp01_probe_20261028","deletedCount":null},"failures":[{"phase":"cleanup","name":"Error","code":null}]}
```

## 最新 run（30秒配置）

用户在CloudBase测试面板提交事件`{"action":"run","runId":"sp01_3db660bc5eb548559f4f6966a34209a2"}`，面板先因输入缺少`runId`结束引号而拒绝非法JSON；修正为合法JSON后，函数成功执行。返回值满足临时事务探针的全部断言：提交后文档可见；回滚观察到中止且无部分写入；并发屏障未超时、两笔事务均成功、最终值为2且状态一致；清理成功删除3条记录，函数执行删除后检查，返回`success:true`且无失败项。

```json
{"success":true,"runId":"sp01_3db660bc5eb548559f4f6966a34209a2","collection":"sp01_probe_20261028","commit":{"allDocumentsVisible":true},"rollback":{"abortObserved":true,"noPartialWrites":true},"concurrency":{"overlapObserved":true,"startBarrierTimedOut":false,"outcomes":[{"status":"fulfilled"},{"status":"fulfilled"}],"finalValue":2,"successfulTransactions":2,"stateConsistent":true,"resultRequiresReview":false},"cleanup":{"success":true,"runId":"sp01_3db660bc5eb548559f4f6966a34209a2","collection":"sp01_probe_20261028","deletedCount":3},"failures":[]}
```

## 本地 SDK 契约诊断

目标工程锁定`@cloudbase/node-sdk` 3.18.7，其数据库依赖为`@cloudbase/database` 1.4.3。该依赖源码的文档`set`和`update`接口接收平铺字段对象；旧探针传入`{data: fields}`，会把业务字段嵌套到`data`属性。本地SDK接口形状契约模拟测试复现并修复了字段对象问题：旧形状导致提交标记不可见、并发读取`value`缺失后更新参数不合法；改为平铺字段后，本地模拟接受请求并清理本轮记录。该模拟只核对SDK调用字段形状，不模拟CloudBase事务隔离或云端实现，不能作为事务验收通过证据。清理逻辑也增加了对本轮旧格式嵌套记录的精确归属识别，只允许删除五个固定ID中归属本runId的文档并逐个回查。

这是受锁定SDK源码和本地回归支持的根因诊断。修正版已上传，目标环境的新事务探针现已通过，支持平铺字段修复的判断；历史失败没有逐变量云端对照，故不把历史根因写成独立云端证实。当前上传只更新了`sp01EnvProbe`，没有修改QuickStart模板函数或存储；旧run和新run的固定记录已分别定向清理，集合保留。

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

历史运行标识`sp01_f95243389fa9ca4f7a407c90ce2052ef`、3秒超时运行标识`sp01_f4157fdc182bda6f9fd8e37395d4943e`、失败运行标识`sp01_f892f63b9fdc4c11ae1254800a9e83cf`和成功运行标识`sp01_3db660bc5eb548559f4f6966a34209a2`均不得复用。固定集合已创建并保留，不得再次执行`prepare`或删除集合。事务探针通过只证明该临时函数在目标CloudBase环境中的受控合成事务行为，不替代SP01整张技术规格卡、存储权限、实机/弱网及其他验收。2026-10-28用户回传`DescribeEnvs`结果，结合腾讯云官方资源字段定义与`flexdb`映射，支持将目标环境数据库模式确认为文档型数据库；API没有单一`DatabaseType`字段，完整回包与判读依据见[SP01技术环境记录](sp01-technical-environment-20261027.md)。存储权限探针观察到非管理员第二测试账号成功读取及写入测试文件，故该测试文件的跨账号隔离失败；账号`_openid`未直接采集，结论不外推。定向清理及目录空列表查询均通过。后续云端变更或复测须取得新的具体授权。结构化事件输入/输出契约由本地探针实现和测试定义；本地包检查不替代真实环境结果。

## 范围与隔离

- 目标小程序：`wx2414399d423dfb65`；目标环境：`cloud1-d2gjahlq39bf141c7`（环境名 `cloud1`）。用户已报告在 `E:\O2O\miniprogram\cloudfunctions` 的“当前环境”中选中 `cloud1`；该选择尚未通过开发者工具截图再次验证。
- 临时函数目录：`E:\O2O\miniprogram\cloudfunctions\sp01EnvProbe`。用户的 `quickstartFunctions` 目录和模板文件不属于本探针，不修改、不上传。
- 运行时按用户确认选用 Node.js 20.19；直接依赖 `@cloudbase/node-sdk` 固定为 `3.18.7`，完整传递依赖写入 `package-lock.json`。本机 Node 24.18.0 与云函数运行时分开记录。
- 数据库依据用户回传的`DescribeEnvs`结果及腾讯云官方资源定义，按文档型数据库（`flexdb`）记录；API未直接返回统一类型字段，判读依据见技术环境记录。探针只在固定集合 `sp01_probe_20261028` 工作；若该集合已存在，`prepare` 会失败并停止，不能复用或清空已有集合。
- 只使用随机生成的 `sp01_` 加 32 位小写十六进制运行标识和不含个人信息的合成字段。测试前再次只读核对目标环境的函数与集合列表；若集合或函数状态与预期不符，停止并先审查。

## 测试输入与预期

此前授权覆盖临时函数、固定集合和随机合成记录的受控测试，不包括存储写入或生产操作；修正版部署、旧run定向清理和一次新run已在该授权范围内完成。授权的一次新run已用完，不包括后续云端写入或重跑。腾讯云官方[事务文档](https://docs.cloudbase.net/database/transaction)说明事务只支持服务端 Node SDK，并列出 `runTransaction`、文档操作和限制；这些公开能力不能替代本环境实测。

| 顺序 | 操作与输入 | 预期与证据 |
| --- | --- | --- |
| 1 | **首轮历史已完成后已删除**：首次部署过 `sp01EnvProbe`，用户随后删除 | 首轮部署前函数/集合均为空；部署后列表曾仅有探针。首轮删除后函数与集合只读列表为空。该历史部署及删除不证明本地探针代码正确上传。 |
| 2 | **已尝试但未验证**：函数测试事件 `{"action":"inspect"}` | 截图返回区域显示输入事件，不含预期运行时与SDK字段；运行日志含 `Hello World` 和运行上下文。运行时验收未通过。 |
| 3 | **已通过**：函数测试事件 `{"action":"prepare"}` | 用户提供结构化响应 `{success:true,collection:"sp01_probe_20261028",created:true}`；固定测试集合已创建。 |
| 4 | **历史失败**：run事件，runId `sp01_f4157fdc182bda6f9fd8e37395d4943e`，超时3秒 | 用户返回433执行超时；事务未完成验证。超时后历史集合查询显示记录数0，自动清理仍未证明。该运行标识不复用。 |
| 5 | **修正前历史失败，已定向清理**：run事件，runId `sp01_f892f63b9fdc4c11ae1254800a9e83cf`，超时30秒 | 回滚通过；提交记录不可见；并发事务均以`INVALID_PARAM`拒绝；清理失败。随后`inspectRun`确认3条本轮自有记录、2条缺失，再由`cleanup`删除3条并回查无遗留。 |
| 6 | **最新云端事务探针已通过**：run事件，runId `sp01_3db660bc5eb548559f4f6966a34209a2`，超时30秒 | `success:true`；提交可见，回滚中止且无部分写入；两笔并发事务均成功、最终值2且状态一致；自动清理删除3条并回查通过。固定集合保留，运行ID不复用。 |

`run` 在提交、回滚、并发任一验证抛错时仍尝试清理本轮文档；只要清理失败或回查发现遗留，响应必须是失败，且不得继续宣称通过。并发阶段有1.5秒启动屏障超时，且只有两个事务在超时前都完成首次读取才记录重叠；串行执行或屏障超时会作为未通过结果。探针只返回有限的状态摘要，不返回文档内容。不可将本地内存数据库结果当作云端事务证据。

## 恢复与已知限制

1. 若部署失败或函数测试返回未知结果，停止重复写入；保留脱敏错误码/请求 ID和控制台日志，不广泛重试。
2. 若记录未清理，先用同一运行标识调用 `cleanup`；仅当记录标记校验通过时才删除。如果不能确认归属，停止并保留现场供人工审查。
3. 按既定恢复边界保留 `sp01_probe_20261028` 为空集合，不删除集合或任何非本轮记录。
4. 当前安装目录的开发者工具 CLI没有云函数调用或删除命令；云端执行需通过开发者工具/控制台的函数测试入口。用户报告已删除临时`sp01EnvProbe`；之后对目标AppID `wx2414399d423dfb65`、EnvID `cloud1-d2gjahlq39bf141c7`执行只读`cloud_fn_list`，返回`total:0`、`list:[]`。这确认当前目标环境没有列出的云函数；不表示固定测试集合已删除，按原边界保留空集合。一次性新run授权已使用，后续云端写入、删除或部署须重新取得具体授权。
5. 当前存储是空目录且权限配置为“仅创建者可读写”的截图证据；服务端管理员权限不等于客户端逐角色验收。匿名、所有者、其他用户、临时链接到期和撤权测试需要另行确认身份与具体云写入授权，本探针不测试存储权限。

## 本地验证证据

`node --test tests/sp01-environment-probe.test.cjs`：16项本地测试通过；`node --test tests/sp01-cloudbase-sdk-contract.test.cjs`：1项锁定SDK字段形状模拟测试通过。测试覆盖事件白名单、只读归属检查、探针流程、异常后清理、旧格式本轮记录安全清理、集合保留、运行标识及凭据边界、部署包入口和字段对象契约。结果只证明本地逻辑和模拟行为；最新修正版云端事务结果另见上表，已通过临时探针断言，不等于SP01整卡验收。

## 参考

- [CloudBase 数据库事务](https://docs.cloudbase.net/database/transaction)：服务端 Node SDK、事务读写方法及公开限制。
- [CloudBase 测试云函数](https://docs.cloudbase.net/cloud-function/develop/how-test)：控制台与微信开发者工具均提供带自定义 JSON event 的函数测试入口。
- [CloudBase 云函数资源集成](https://docs.cloudbase.net/cloud-function/resource-integration/cloudbase)：普通云函数访问 CloudBase 资源的说明；部署后仍须本环境实测。
- [CloudBase Node SDK 3.18.7](https://www.npmjs.com/package/@cloudbase/node-sdk/v/3.18.7)：锁定版本；本地已按此版本生成锁文件并检查事务 API。

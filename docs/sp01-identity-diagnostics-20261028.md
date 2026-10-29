# SP01 身份调用诊断修复 — 2026-10-28

## 2026-10-29 本轮清理执行已核实

用户确认删除卡片后，查询原任务`confirmation_cloud_manage_storage_11e84ff5-4383-48e0-9b0e-4a81e6d61bfe`返回`status:success`、`detail:execution_success`，结构化结果明确`deleted:true`，路径为`sp01_permission_probe/owner-probe-b4c8fb44dff8b553.txt`。随后按目标AppID/EnvID只读回查测试目录，返回`files:[]`、`totalCount:0`。该pendingTask已结束，无需重发删除。本轮文件清理完成；删除是合成数据清理，原文件所有者元数据不能保证通过重建恢复。未删除目录或其他文件，未修改权限。直接下载上游归因仍未解决，停止重复相同手机流程。

## 2026-10-29 手动真机调试与本轮清理待确认

用户确认手动真机调试Network中有身份调用且可见响应正文；随后B执行direct-only-v1，身份不同、直接下载仍为-403003且无权限标记。用户报告Network只见身份调用，未见下载内部响应。本轮不能从该面板取得所需上游证据，停止相同流程重试，不宣称平台内部请求未发生，也不将重启报告当作已证实根因。

用户报告已删除，回查仍有且仅有`sp01_permission_probe/owner-probe-b4c8fb44dff8b553.txt`。用户进一步说明点击删除没有本机结果。本地确认页面缺少showModal失败与取消反馈，先用回归测试复现，再补等待、失败、取消反馈与忙碌防重。此修复不证明手机本次具体失败原因，且尚未推送新预览。

只读核对确切文件原文为`SP01-SYNTHETIC-OWNER:b4c8fb44dff8b553`，UTF-8、37字节、无截断。沿用本轮清理授权提交该文件定向删除，未删除目录。pendingTask：`confirmation_cloud_manage_storage_11e84ff5-4383-48e0-9b0e-4a81e6d61bfe`；工具`cloud_manage_storage`；AppID`wx2414399d423dfb65`、环境`cloud1-d2gjahlq39bf141c7`、action`delete`、上述确切路径；返回`pending`，尚未轮询。需用户确认工具卡片后查询原taskId，再回查目录，不重发删除。

## 2026-10-29 真机调试取证通道准备

用户确认SDK组合并要求继续解决、必要支持直接提出。只读核对当前开发者工具随附调试技能及CLI，登录未过期、技能版本0.3.11一致。静态检查安装包`app.asar`：`js/d6d539cfa0c891e0ed30e883810ce030.js`的network工具读取workspace缓存；`js/c798bafdb858bb29290830b0a0766d89.js`的`buildInspectorNetworkMessage`只将wx.cloud请求/响应事件转换为`detail:params.request/response`，丢弃外层requestId，没有提供读取响应正文的工具操作。源码只读，不改安装目录。此证据解释现有CLI路径的限制，但不证明手动真机调试面板不能查看正文。

通过公开CLI尝试对隔离工程执行`automation_viewport_action --action remote --auto false`，返回`ok:false`，未取得成功结果或taskId。为避免输出调试连接可能携带的信息，首次输出仅保留状态，具体失败原因没有保留，不能归因为账号、网络或配置。未重复启动，不宣称手机调试已连接。接下来需要用户在现有隔离工程手动打开“真机调试”，用B扫码确认连接及Network面板可见性；本阶段只调用现有身份诊断，不新建文件、不重新执行存储测试。若界面已因前述尝试打开，应使用现有会话。只有证实响应取证能力后才设计下一次存储验证。

## 2026-10-29 后续只读诊断：现有通道无法恢复上游语义

重新运行`node tools/sp01-storage-probe/check-download-sdk.cjs`并传入本机官方3.17.5基础库包，四项回放全部通过，包与提取函数SHA-256均与原记录一致，外连数为0。空数据与携带`STORAGE_EXCEED_AUTHORITY`但没有URL的合成响应均产生相同`-403003`。因此继续修改外层错误显示不能恢复SDK已丢失的信息。对隔离工程执行只读`get_simulator_network`、过滤`tcbapi_downloadfile`，返回空字符串；该缓存属于模拟器，不是B手机请求记录，不能据此判定手机请求是否发生。

官方[SDK文件管理](https://docs.cloudbase.net/storage/sdk)提供`wx.cloud.downloadFile({fileID})`及临时文件路径示例，本轮未从该页面取得原始上游响应采集接口。微信官方远程调试与downloadFile页面本轮读取失败，不能据其内容承诺真机调试能看到内部请求。当前没有已验证可用的手机上游响应采集方法；如必须精确归因，仍需平台侧证据或先验证可用的调试采集通道，不再要求用户盲目重测，不私调`tcbapi_downloadfile`或替换身份。

阶段边界复核：质量合同SP01的`reviewPhaseOnly:true`及QM01规定当前核对环境、预算和测量方案，最终产品指标由后续里程碑验收。三类设备参数、测量方法及当前阶段应确认的参数仍有缺项，但正式产品最终性能结果不能反向作为SP01开工前置。此说明纠正此前对用户的过宽表述，不改动原计划、门槛或未通过状态。

## 最新结果：2026-10-29 direct-only-v1 真机复验仍无法判定

用户授权一次A创建、B仅直接下载及确切文件清理。隔离页面已暂停旧B读写入口，版本为`direct-only-v1`。用户回传截图显示：身份不同为是；直接下载返回`-403003`，内层码同为`-403003`，未提取到权限标记；本轮未请求临时链接或执行写入。此结果复现下载失败，但没有新增上游响应证据，不能唯一归因为权限拒绝。继续重复该入口无法弥补证据缺口；应停止重试。

用户随后确认核对确切文件并完成删除。再次通过目标AppID/EnvID的只读目录查询，返回`files:[]`、`totalCount:0`，确认本轮新文件已无目录遗留。此次授权流程清理完成；没有修改存储权限。直接下载归因仍未解决，不再重跑相同手机流程。

截图回传后只读列出目标环境`sp01_permission_probe/`，发现且仅发现`owner-probe-550ff89b608a45cc.txt`，37字节。此时尚未删除；下一步由A使用本轮保留的测试包删除确切fileID，再回查目录。旧七份清理证据不覆盖此新文件。SP01保持未通过。后续若需直接下载上游响应，必须先验证实际可用的采集方法，再安排手机操作；当前探针仅捕获SDK对外错误，不能承诺从相同错误中恢复已丢失的上游信息。

## 最新结果：2026-10-29 七份文件清理完成，下载 SDK 机制复现

用户明确授权七份文件删除并要求继续完成两项收尾。实际轮询首批七个任务：41a7ac8a59d4a79a、664a688b31b1b9fc、9eb3f08ccf06be87、ed4129f3c7ed102c 四份 execution_success/deleted:true；c23b0f90321a70bc、dfc480fd50595dbf、f9a399e299df644d 三份 user_denied/cancelled。此前脚本错误地仅检查 success:true，未将 pending 当作需要等待的状态，导致一次产生七张卡；pending 并非删除成功。未再沿用该批处理脚本。

后续按用户最新继续指令重新提交剩余三份的确切路径，用户确认工具卡后分别轮询为 execution_success/deleted:true。新任务 ID 为 `296cc52c-ee0b-48ba-a8fc-1b9c3f53c23f`、`6be606ef-4d47-4f86-ab9f-09adc7432a90`、`d5d46610-fc43-4556-a668-3363fb561ad0`（均带 confirmation_cloud_manage_storage_ 前缀）。最后 `cloud_query_storage action=list` 回包 `files:[]`、`totalCount:0`。七份合成文件清理与目录回查完成；未删除目录或其他文件，清理清单同步记录执行结果。

下载诊断新增一手依据：用户私有工程配置当前基础库为 3.17.5（公开配置另为 2.20.1，未修改用户配置），本机已缓存的官方 `WeappVendor/3.17.5.wxvpkg` 也将 -403003 定义为 SDK_STORAGE_INTERNAL_SERVER_ERROR_EMPTY_DOWNLOAD_URL。其下载地址解析器向 tcbapi_downloadfile 请求，在上游 data.download_url 为空时抛出该码，然后才可能调用底层下载。因此“地址缺失”的 SDK 机制已定位；这不是 HTTP 403，也不是单凭数字即可判定的权限拒绝。

`tools/sp01-storage-probe/check-download-sdk.cjs` 从实际官方包提取该解析函数，置于隔离 VM，拦截请求并注入四个合成回包：空 data、带 STORAGE_EXCEED_AUTHORITY 且无 URL、正常 URL、请求直接网络拒绝。前两项均产生 -403003，正常 URL 返回地址，网络拒绝保留原错误；4/4 断言通过，实际外连数为 0。包 SHA-256 为 `62516353cb6e85dfe680d80b3ea81c435b2ff8d7093ed55d023e68979e21b91b`，提取函数 SHA-256 为 `3aa4062b3815f6814b130c624765eb63be83532d4c682e1b1ec408fc9f92cc8c`，输出为 `.local/sp01-download-sdk-final-replay.json`。

证据边界仍然保留：此受控复现证明实际 SDK 的丢失上游错误语义机制，不能还原历史手机请求的上游原始回包，也未证明手机实际基础库版本。B 获取临时链接和写入的权限拒绝已确认；将 B 下载地址为空唯一归因于权限拒绝仍缺逐请求证据，不能把本地合成复现冒充真机验收通过。历史文件已清理，再次真机取证需要新的一份隔离测试文件及一次 B 只读下载，不得自动新建或重跑写入。SP01 整卡继续未通过。

身份调用与原始对象/字符串误比的缺陷均已修复且有真机成功证据；当前未解决范围仅为 B 历史下载失败的上游精确归因（不是身份连接失败）。以下为历史记录。

## 最新结果：2026-10-29 新测试路径确认，七份合成文件核验完成

用户提供新测试包的确切 `cloudPath`：`sp01_permission_probe/owner-probe-c23b0f90321a70bc.txt`。沿用只读授权，对此路径执行 read 成功，内容为 `SP01-SYNTHETIC-OWNER:c23b0f90321a70bc`，UTF-8、37 字节、未截断。随后 list 成功返回七份文件，包含前轮六份及这个新路径。前轮未完成的 `9eb3f08ccf06be87`、`dfc480fd50595dbf`、`ed4129f3c7ed102c`、`f9a399e299df644d` 四份本轮 read 均成功，内容各为 OWNER 标记加同名编号、37 字节、未截断；此前两份已成功 read 的证据继续保留。七份均已取得内容证据，前轮 TLS 失败不再阻塞清单核对。

确切清单见 [清理清单 JSON](sp01-storage-cleanup-manifest-20261029.json)。这证明查询时这些文件的合成内容与各自编号一致，不证明历史上从未变化，也不能替代新文件的账号 A 客户端复验；CLI 为管理通道，与用户角色权限验收分开记录。B 的两项明确权限拒绝及下载地址为空的边界仍按上节历史证据记录，SP01 整卡仍未通过。

本轮没有执行删除。待用户明确授权后才逐条删除清单中七个确切路径，并只读回查目录；不递归删除目录，不扩大到新出现的其他文件。任何失败或内容变化停止并保留证据。删除前合成文本和路径已有清单记录，必要时可重新生成同格式测试数据，但重建不保证恢复原文件所有者元数据，因此删除需单独确认。以下为历史记录。

## 最新结果：2026-10-29 只读清理盘点发现六份文件

用户授权只读列出测试目录并核对合成内容。目标 AppID/EnvID 不变，`cloud_query_storage action=list cloudPath=sp01_permission_probe/` 成功返回六份文件，均为 37 字节。此次未删除文件、未改权限。

| 文件名（均在 sp01_permission_probe/） | 本轮核验结果 |
| --- | --- |
| owner-probe-41a7ac8a59d4a79a.txt | read 成功；UTF-8 原文为 OWNER 标记加同名编号，37 字节、未截断 |
| owner-probe-664a688b31b1b9fc.txt | read 成功；UTF-8 原文为 OWNER 标记加同名编号，37 字节、未截断 |
| owner-probe-9eb3f08ccf06be87.txt | 本轮未完成内容核验 |
| owner-probe-dfc480fd50595dbf.txt | 本轮未完成内容核验 |
| owner-probe-ed4129f3c7ed102c.txt | 本轮未完成内容核验 |
| owner-probe-f9a399e299df644d.txt | 前轮已核验 OWNER，当前轮未取得新的完成结果 |

后续读取遇到 `getcosauth 请求失败: Client network socket disconnected before secure TLS connection was established`；不能把网络失败记为权限拒绝或文件不存在。未将最后修改时间最新的文件直接认定为用户最新测试包对应文件；仍需测试包路径或其他直接证据建立关联。盘点结果从预期两份修正为实际六份，清理清单尚不能整体放行。只读核验未完成，删除尚未授权；SP01 保持未通过。以下为历史记录。

## 最新结果：2026-10-29 B 返回明确权限标记，直接下载错误定义已定位

用户因丢失原测试包明确授权重建，随后按 A 创建一份新合成文件、保存新包、B 执行一次完整诊断的流程回传截图 `codex-clipboard-a12fe963-6929-4d81-915a-aebb953b9467.jpg`。截图显示 `storage-errors-v1`、身份不同为“是”、临时链接外层码 `1` 且标记 `STORAGE_EXCEED_AUTHORITY`、直接下载外层及内层码均 `-403003` 且未提取到标记、同路径写入外层及内层码均 `-503002` 且标记 `STORAGE_EXCEED_AUTHORITY`，本机临时文件清理为 removed。新文件路径未出现在本张截图中，不能把旧路径当作新路径。旧文件 `owner-probe-f9a399e299df644d.txt` 未获删除确认，新文件也未获清理确认。

依据 CloudBase 官方[HTTP 错误语义](https://docs.cloudbase.net/en/error-code/semantic-http-status)将 `STORAGE_EXCEED_AUTHORITY` 列为当前用户无权操作存储资源，本次用户结果支持“B 申请临时链接及同路径写入遭到权限拒绝”。界面仍显示无法判定，是因为当前自动分类只认外层符号码，提取到的消息标记仅作为人工复核证据；没有为了让界面通过而扩大数字码白名单。该结论仅限本次测试、两种操作及目标合成文件，不扩大为所有对象/角色通过。

通过本地只读检查 `E:\微信web开发者工具\resources\app.asar` 定位官方开发者工具随附 SDK 定义：`-403003` 对应 `SDK_STORAGE_INTERNAL_SERVER_ERROR_EMPTY_DOWNLOAD_URL`，描述为 `internal server error: empty download url`。包内 `js/vendor/2.25.3.wxvpkg` 的下载代码先请求 `tcbapi_downloadfile`，在 `!i.download_url` 时抛出该错误。提取摘要存于 `.local/sp01-sdk-empty-download-url-evidence.json`；该包 SHA-256 为 `b9ac41a8c04345b4434fad6b986e5ec6877554057eaf41b19b0ab4358c12d46a`。这提供错误机制的一手本地实现证据，但尚未证明手机当前运行包与 2.25.3 实现相同，不能把此数值码单独判成权限拒绝。

现有结果与“B 被拒绝获取地址，直接下载因此失败”相符，这仍是结合两项观测及本地 SDK 的推断，不是直接下载请求上游响应的完整追踪。直接下载没有成功读取的证据；其失败原因未达到与两项明确权限标记相同的确认程度。A 在前一份文件上的 37/37 字符核验通过不能冒充新文件的创建者复验。SP01 仍未通过，不再盲目重跑整套 B 写入测试。

本轮仅进行本地代码只读检查、公开文档核查和证据记录，没有发起云端请求或修改权限。下一步需具体授权后只读列出测试目录并核对新旧文件，形成确切清理清单；本节不授予删除权限。原始用户截图已原样保存在 `.local/sp01-storage-errors-v1-user-result.jpg`。以下为历史记录。

## 最新结果：2026-10-29 owner-read-v3 真机核验通过，B 错误诊断待复验

用户回传真机截图 `codex-clipboard-7411a7aa-7765-4d41-962d-efe5c4f6f8a8.jpg`，显示版本 `owner-read-v3`、创建者文件可以访问且内容与原证明一致、预期和实际字符数均为 37、文本类型 OWNER。这是本轮账号 A 使用原测试包的一次只读复验；与上一节 CLI 只读原文一致。当前创建者读取及内容一致性子项通过，先前“内容已变化”提示不再作为 B 覆盖成功的证据。此前手机包没有可识别版本标记，不能进一步断言那次一定使用了旧包或缓存。

仍待完成的是 B 的访问结果判读及后续清理，SP01 整卡未通过。本轮未执行 B 请求、云函数部署、权限修改或云文件删除。B 已有数字返回码 `1`、`-403003`、`-503002` 仍未取得足够的一手映射依据；微信旧文档地址返回页面已迁移/不存在，第三方转载不用于放行。CloudBase 官方[错误码说明](https://docs.cloudbase.net/error-code/basic)及[HTTP 语义分类](https://docs.cloudbase.net/en/error-code/semantic-http-status)说明符号权限码，但不证明上述三个数字码的对应关系。

本地确认存储错误分类只保存外层码，会丢弃 `errMsg/message` 中的诊断标记。补充 `storage-errors-v1`：每段最多读取 8192 字符，仅保留固定标记及最多 8 个内层数值码，不回显原始错误、身份、临时链接或正文；不增加请求、不改变权限拒绝判断，数值码即便伴随诊断标记仍保留无法判定供复核。新增两项测试先失败（39 项中原 37 项通过），修复后专项 39/39 通过；证据 `.local/sp01-storage-errors-red.log`、`.local/sp01-storage-errors-targeted.log`。这修复的是诊断信息丢失，不声称已查明云端权限根因。

计划检查 43/43、全量回归 1461/1461 通过，无跳过；记录为 `.local/sp01-storage-errors-plan.log`、`.local/sp01-storage-errors-full.log`。用户截图原样保存在 `.local/sp01-owner-v3-user-pass.jpg`。本地测试不替代 B 真机结果。

待新的具体授权后才刷新预览及由 B 对同一测试包执行一次完整诊断（身份、临时链接、下载、同路径合成写入；只有写入明确成功才尝试清理该次确切 fileID）。不新增第二份文件、不修改规则、不操作其他数据。若无法取得明确结果即停止，不循环重试。回退只反向提交本地诊断改动；A 本次通过证据保留。以下为历史记录。

## 最新结果：2026-10-29 云端原文一致，与手机提示矛盾

用户回复“继续”后，按上一节具体范围执行一次 CLI 只读查询：`cloud_query_storage --appid wx2414399d423dfb65 --env cloud1-d2gjahlq39bf141c7 --action read --cloud-path sp01_permission_probe/owner-probe-f9a399e299df644d.txt`。返回 `success:true`、`encoding:utf8`、`sizeBytes:37`、`truncated:false`，实际合成文本为 `SP01-SYNTHETIC-OWNER:f9a399e299df644d`。本次读取时文本与路径对应的原证明一致，没有观察到 OTHER 标记；这不证明文件在此前所有时刻均未变化，也不构成 B 权限隔离通过。

手机“不一致”提示与本次云端原文矛盾，尚不能在本地复现同一内容的误判。待区分：手机实际预览版本、手机下载文本是否不同、比较逻辑是否仍有遗漏；不从矛盾直接选定根因。为减少盲目重复测试，本地仅增加核验结果中的 `owner-read-v3` 版本标记、预期/实际字符数和严格匹配的 OWNER/OTHER/UNRECOGNIZED 类型，不输出文件原文或身份，不放宽通过条件，不改文件接口、权限、部署或业务功能。字符数为 JavaScript 字符串长度，不冒充字节数。

先写回调边界诊断断言：35 项中 7 项失败，证据 `.local/sp01-owner-v3-red.log`，这是诊断字段缺失的复现，不是云端矛盾根因的复现。实现后补充尾随回车及未知文本脱敏场景，专项 37/37、计划 43/43、全量 1459/1459 通过，无跳过；本地原始记录为 `.local/sp01-owner-v3-targeted.log`、`.local/sp01-owner-v3-plan.log`、`.local/sp01-owner-v3-full.log`。这些本地测试不替代手机证据。

用户已另行明确授权刷新一次隔离预览及一次账号 A 对原测试包的只读复验。手机复验尚未执行；不操作 B，不创建/覆盖/删除云文件。回退仅反向提交本次本地诊断改动。SP01 仍未通过，文件清理仍未完成。下文为历史证据。

## 最新结果：2026-10-29 修正版创建者复验仍报告内容不一致

用户按保留原测试包、刷新隔离预览、账号 A 核验创建者文件的步骤复验，先文字回传、随后提供截图：`创建者文件核验：可以访问，内容已变化。这里只比较合成证明文本，不显示文件内容。` 这是同一次复验的两种回传，不计为两次测试。前一张“测试包有效”截图显示本轮路径为 `sp01_permission_probe/owner-probe-f9a399e299df644d.txt`。版本依据为本地修复提交 `91107c8` 及用户按刷新流程操作的回传，未独立核对手机包哈希。

本地复核确认修正版页面适配器仅返回 `readFile` 回调中的字符串 `data`；工作流将该文本与有效测试包的 `ownerContent` 比较。本次结果支持“账号 A 能读取，但读取文本与包内原证明不一致”，不再把旧版对象与字符串比较的缺陷直接当作本次原因。当前尚未取得实际文件内容，不能断言内容就是 B 的 `SP01-SYNTHETIC-OTHER:` 标记，也不能从 B 的未知错误码断言写入未发生。账号 B 的权限结果仍无法判定；SP01 仍未通过。

下一步待具体授权：只读查看上述确切合成文件的文本，辨认它是 OWNER 标记、OTHER 标记或其他内容；不重新上传、不覆盖、不删除、不改权限。当前这轮合成文件清理仍未完成。此处更新仅为证据记录，没有执行新的云端操作。下文所述“待修正版复验”为历史状态，已由本节回传更新。

## 最新结果：2026-10-29 身份可用，创建者内容核验存在误报

用户回传身份单独调用成功截图，页面报告返回格式及目标 AppID 校验通过、未创建测试包或文件。后续同名函数冲突经用户说明是多点击一次产生；这次重复创建失败不否定已有函数的身份调用成功。身份调用阻塞在该次真实客户端验证中已解除，不代表 SP01 整卡通过。

用户随后主动执行 B 的“核对身份并测试读取/写入”和 A 的“核验创建者文件”，回传两张截图：B 显示身份不同为“是”，临时链接 `1`、直接下载 `-403003`、同路径写入 `-503002`，均无法判定，本机临时文件已 removed；A 显示可以访问、内容已变化。截图为用户提供结果，不是助手执行云端测试；本轮没有新发起云端请求或清理文件。

本地复现发现 A 的内容差异提示不可靠：`readFile` 的成功回调返回 `{ data, errMsg }`，页面适配器把整个对象交给工作流，工作流用对象与原合成字符串作严格比较，所以原内容一致也会误报变化。依据微信团队维护的 [API 类型声明](https://github.com/wechat-miniprogram/api-typings/blob/master/types/wx/lib.wx.api.d.ts) 中 `ReadFileSuccessCallbackResult.data: string | ArrayBuffer`；读取时已指定 utf8，应取 `result.data`。此前单元测试直接模拟返回字符串，未覆盖真实回调对象边界。

已在页面回调边界补五项用例：一致文本、变化文本、缺失 data、非字符串 data、读取失败。修复前 34 项中 30 通过、4 失败（`.local/sp01-readfile-red.log`）；修复后专项 34/34 通过（`.local/sp01-readfile-targeted.log`）。修复只改本地适配器与提示：取字符串 data；无法核验时明确显示“内容未能核验”；不输出内容、不更改权限拒绝分类。原图二不能据此认定 B 已覆盖文件，也不能反过来保证文件未改变。

B 的三个数值结果没有取得足够的错误语义证据，继续保持无法判定，不新增错误码白名单来获得通过。当前合成文件是否仍保持原内容待修正版复验；不依据本轮截图标记隔离通过或文件已清理。

本轮计划检查 43/43、全量回归 1456/1456 通过，无跳过；原始结果为 `.local/sp01-readfile-plan.log`、`.local/sp01-readfile-full.log`。这些是 Windows 本地受控测试，不替代手机复验。`git diff --check` 通过。

下一步待具体授权：仅刷新隔离预览，保留并粘贴**同一份原测试包**，由账号 A 执行一次“核验创建者文件”。该步骤包含身份函数调用、下载同一 fileID 与本机读取，不创建或覆盖云文件、不删除文件；不让 B 重复写入。只在取得可靠内容结果后决定后续权限取证和定向清理。回退通过本次修复提交的反向提交，不涉及云资源回滚。以下章节是历史证据。

## 最新结果：2026-10-29 控制台确认缺失依赖

用户授权一次控制台检查后，向目标环境 `cloud1-d2gjahlq39bf141c7` 的 `sp01IdentityProbe` 提交 `{"nonce":"sp01-console-check-20261029"}`，回传：

```json
{"errorCode":1,"errorMessage":"Error: Cannot find module 'wx-server-sdk'\nRequire stack:\n- /var/user/index.js\n- /data/scf/frame/node16/userFunction.js\n- /data/scf/frame/node16/runtime.js","requestId":"266b59ac-10da-45c2-940b-0cf470aaf7ac","statusCode":443}
```

已证实的当前阻塞：云端加载入口时无法解析 `wx-server-sdk`，尚未进入本地入口定义的身份处理逻辑。此前手机报告的 `-504002 / FUNCTIONS_EXECUTE_FAIL` 与此加载错误相符，但依赖修复后仍须手机复验。尚未确认依赖为何未在此前部署中可用，不能把文件统计或部署成功当作依赖已可用的证据。

本地只读复核：`package.json` 固定依赖 `wx-server-sdk: 4.0.2`，`node_modules/wx-server-sdk/index.js` 存在。此前 Node.js 16.13.0 本地加载通过的结论不变；它没有覆盖云端依赖缺失。

待新授权的最小修复：由用户在隔离工程中对 **sp01IdentityProbe 单个函数目录** 执行“上传并部署（云端安装依赖）”，目标 AppID `wx2414399d423dfb65`、环境 `cloud1-d2gjahlq39bf141c7`；不改版本、运行时、权限或其他函数。部署成功后只由账号 A 点击一次“仅诊断身份调用（不写文件）”，回传本机结果。依据：[腾讯云函数部署文档](https://cloud.tencent.com/document/product/583/30936)。当前尚未部署或复验；原一次控制台调用授权已使用。

回退边界：本次建议只更新隔离临时函数的同版本依赖，不涉及业务数据迁移；若部署失败即停止，不删函数、不改其他资源、不扩大重试。SP01 仍未通过，双账号身份比较和存储权限实测仍待完成。下方 2026-10-28 的“根因未知”与待操作描述均为历史记录，以上述最新结果为准。

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

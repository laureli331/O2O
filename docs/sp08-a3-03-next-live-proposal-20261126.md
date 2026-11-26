# A3-03 下一轮单次真实验证提案（待用户确认）

本文件是具体待审方案，不代表已批准新一轮采购、权限绑定、GitHub变量写入或工作流派发。A3-03 / FR00 仍为 HOLD。GitHub token 已由用户报告生成；本地未读取令牌，尚未验证其真实认证能力。

后续确认与收紧：用户已确认e040bc59发布及原单次真实验证范围，随后明确希望这是最后一次。按此约束不再立即开通资源：先完成下述平台预检方案的审阅与独立授权。最后一次云端尝试无论成功或失败均收尾，不自动重跑、延长或要求新购下一轮；失败保持HOLD并交付实际阻塞证据。此约束不代表必定成功。

## 先于采购的平台预检（待确认发布及派发）

- 在已登记的caller增加显式`preflight_only`布尔输入（默认false）和`expected_sha`输入；true只调用专用只读reusable，原TLS source job明确排除true。复用既有caller，避免依赖尚未进入默认分支的新workflow登记；不修改默认分支。实际派发仍须API接受并核对唯一run，不能仅凭文件认为已验证。
- 只在原候选分支人工派发一次，输入独立审阅的准确SHA。专用job的权限仅contents/read、actions/read、id-token/none，最长2分钟；不继承secrets，不使用用户PAT、腾讯云STS、GitHub临时变量或CVM/CLB，也不申请OIDC令牌、不生成CSR/私钥、不连接TLS目标。
- 记录真实caller/called workflow ref及SHA、Node和PowerShell版本；只上传一个白名单公开JSON，保留1天。通过最多4轮同run GET检查job仍在运行时工件可读及归属/digest字段，最长30秒；单请求/正文最多10秒、64KiB、不跟随重定向、不翻页，错误不自动重试。公网出口、OIDC签名、PAT/TAT权限和TLS整链仍不在该预检的证明范围内。
- 复用`runnerContext`和既有等待器的有界GitHub JSON读取实现（抽为独立模块以便Linux runner不加载腾讯云SDK），无新增依赖。官方依据：[job上下文](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#job-context)、[运行查询](https://docs.github.com/en/rest/actions/workflow-runs#get-a-workflow-run)、[工件查询](https://docs.github.com/en/rest/actions/artifacts#list-workflow-run-artifacts)。查阅确认github.com支持job.workflow_ref/job.workflow_sha；这不是该项目已运行成功的证据。
- 预检失败就保留日志和HOLD，不采购。预检成功也不自动采购；先核对真实版本/结果及其仍未覆盖的云端条件，再与用户确定是否执行已批准范围内的最后一次云端尝试。

## 验证与复用

沿用已经发布和本地回归的固定命令、公开策略生成器、Windows隐藏凭据输入、来源等待器及原有operator/TAT/规则回收流程。先验证61秒输入延迟不消耗发现窗口、不延长原绝对授权/回收期限，再运行相关合成测试、Windows桥接和CSR/TLS fixture。没有新增第三方依赖、架构或业务功能。真实阶段只接受同一候选SHA、同一caller/CSR/返回作业的TLS证明；不能把准备命令成功、空规则基线或本地fixture当作验收通过。

## 待确认的资源和费用边界

| 项目 | 方案 |
| --- | --- |
| 次数/预算 | 只新建一组资源，单次尝试，操作预算上限人民币2元；不自动重购或重跑 |
| CVM | 上海、Ubuntu Server 24.04 LTS 64位、SA9.MEDIUM2（2核2GiB）、20GiB通用型SSD；无公网IP、无IPv6、无数据盘 |
| CLB | 上海、公网IPv4、共享型、按量、1Mbps按带宽；不选EIP、不启用付费日志 |
| 网络 | 复核后沿用既有Default-VPC/子网与专用安全组sg-1ruydxou；TCP8443到本轮CVM私网8443，健康检查/ProxyProtocol/会话保持关闭 |
| 报价门槛 | 参考用户上一轮页面记录，CVM不高于0.22元/小时、CLB实例与网络合计不高于0.24元/小时；这是本轮操作门槛，不声称当前仍有该报价或库存。实际确认页价格/配置超出时暂停请用户确认 |
| 计时 | 第一项计费资源创建时记录T0，CVM设置T0+45分钟定时销毁；CLB同一时限人工释放。T0+35分钟仍未进入可验证状态就停止并回收；不延长到下一小时 |

费用结果仍须看实际账单，不能用小时单价或资源列表空态当作已结算证据。旧实例、CLB地址、旧证书/CA pin、JWKS和STS不能作为新一轮实际输入。遇到规格不可选、地址解析不符或需要扩大权限/网络范围时停止，不自行替换。

## 分工及顺序

1. **采购前**：Codex完成并提交本地计时修正与测试；用户确认该修正发布及本提案范围后，Codex发布并只读核对新SHA。用户保留GitHub token，仅在本机隐藏输入时使用；不得发送截图/聊天。
2. **用户控制台操作，Codex核对公开结果**：创建本轮一台CVM和一个CLB；首先设置/核对定时销毁时间，记录资源ID、报价和T0。复核专用安全组和网络，再保存监听器及后端绑定。取得最终后端列表，不把选择弹窗当作已保存证据。
3. **准备先于短窗口**：用户通过控制台执行只读网卡检查、一次bootstrap、版本化代码安装；Codex检查公开输出、源码摘要与证书SAN/签名/指纹。镜像域名须在新实例内实际解析，现有出站IP不符时暂停。安装文件不覆盖重跑；私钥仅留云端。
4. **最小权限**：Codex用实际新实例ID、既有sg-1ruydxou及3条已核对的固定命令生成精确策略供用户审阅/绑定。只允许固定命令Invoke/任务读取及该安全组指定规则操作；不授予管理员或全资源权限。用户以MFA申请新的900秒STS，密钥留本机；原撤销旧会话策略不擅自移除。
5. **准备鲜活输入**：Codex取得新的GitHub公开JWKS并生成传入脚本；用户执行后返回摘要与时间戳，未取得结果不记为已安装。Codex用实际新地址/证书、已核对的新SHA和固定绝对授权结束时间生成两个公开GitHub变量与watch计划。确认现有变量为空后写入A303_HANDOFF_POLICY和A303_TLS_RUNNER_POLICY，保留该轮准确值用于清理核对；不写凭据到变量。
6. **连续执行**：用户在PowerShell7运行本地入口，依次隐藏输入STS三项和GitHub token、填写STS有效期。凭据输入后才计算最多60秒发现窗口；在首次只读查询成功并显示waiting-for-source后，用户回复“等待就绪”。Codex在已确认范围内只派发固定caller一次。等待器自动识别本轮唯一run ID，在内存生成配置，由原operator重验来源后签发、临时放通真实runner的TCP8443 /32、启动、派发证书返回并验证同一caller的TLS结果。每一步仍受原CSR300秒与授权/回收截止时间约束；消息传递、GitHub排队和工件可见时延尚无真实完成保证。
7. **无条件收尾**：operator按原流程停止服务、移除带本轮标记的临时规则；结果未知时只核对不重试派发。Codex核对并移除本轮两个公开GitHub变量；用户释放CLB、核对CVM/系统盘回收，解除运行权限并撤销角色会话，最后删除本轮GitHub token。分别记录每项回收证据及真实TLS结果；不因TLS失败而延迟资源回收。

## 尚未由实证证明的条件

新实例/CLB库存与报价、agent/镜像下载连通、实际后端绑定、新STS与GitHub token的认证/权限，以及GitHub排队和新模式真实运行表现，都必须在授权范围内逐项核对。没有依据承诺本轮必成功；本方案通过先准备、单次短窗口、独立回收和失败即停限制重复付费试错。

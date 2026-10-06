# 技术决定与开发执行记录

日期：2026-10-06（Asia/Shanghai）。需求与验收采用[PRD v1.3](prd.md)和[开发计划](development-plan.md)。本记录追加实际执行进度，不覆盖原规划、设计及历史确认。

## 1. 本次验证与回退方案

本次交付为技术确认记录、外部证据清单和自动验证。验证实际回复与结构化记录一致；未知资料保留未知；没有实际证据不能将外部条件标为通过；DP01/DP03/DP04未完成时，DP07不得开始。新增验证同时注入错误副本，验证确实拒绝缺失确认、越过依赖和无证据启用。回归仓库全部现有验证，检查Git差异，创建对应Git commit。

本次不迁移或删除数据，不改PRD业务规则和已采用视觉资源。需要回退时审阅本次提交并经授权撤销，不执行破坏性重置。安装包若下载则保留并记录校验，避免先删后重新下载。

## 2. 用户已确认的关键决定

上轮建议为原生微信小程序＋TypeScript＋Node.js云函数＋CloudBase数据库/云存储、云端定时触发与到期扫描及失败补偿；运营入口位于小程序内，两位运营者独立账号、同等权限。费用安排为先完成本地和受控测试，采购前给出具体清单并取得确认。用户实际回复：**“采用”**。

用户最初说明有AppID；后续提供**`wx358290e451cb06e7`**，已记录并检查格式。对开发工具和云环境两项的追问，实际回复：**“两项都没有”**。主体实际回复：**“暂时是个人主体, 若有需要, 可注册个体工商户”**。这不是已注册个体工商户或已经完成主体迁移。

机器可读记录：[development-decisions.json](development-decisions.json)。当前AppID的存在不代表云环境、身份、手机号、检测、通知或支付权限已经开通。

## 3. 已采用方案与备选的取舍

| 项目 | 已采用：云开发 | 备选：独立Node.js后端＋PostgreSQL |
| --- | --- | --- |
| 工程与维护 | 云函数、数据库、存储、定时入口集中管理；应用仍负责权限、幂等、监控、恢复 | 需分别配置应用服务、数据库、对象存储、任务处理及监控 |
| 并发一致性 | 具体数据库模式及事务SDK必须先验证；选人/容量/一次修改须服务端原子生效 | 可使用数据库事务和唯一约束；同样需验证重试、故障及业务状态 |
| 文件权限 | 未审图和私密图采用私有权限，服务端按当前角色、对象及状态授权；验证链接转发/撤权 | 需自行配置私有对象存储和服务端读取授权 |
| 计时恢复 | 定时触发只负责唤醒；持久化期限、事件和进度；服务端读路径判过期，恢复后扫描补偿 | 独立任务处理进程也须持久化和补偿；停止/重启测试相同 |
| 费用 | 云资源、存储流量、检测、核验等按实际套餐和用量确认；不承诺固定月价 | 服务器、数据库、对象存储、监控、备份等费用亦待核实 |
| 迁移与恢复 | 模型、事件和供应商适配边界分开；备份/恢复须根据所选环境实测 | 数据导出/恢复和跨服务一致性仍须实测，不能仅依靠数据库有备份功能 |

上述取舍是架构分析，不是生产验收结果。保留业务规则和服务适配边界，避免将供应商SDK调用散落于页面。

## 4. 官方依据与版本边界

- [CloudBase文档数据库事务](https://docs.cloudbase.net/en/database/transaction)：该页面说明事务在服务端通过Node SDK使用。它是文档数据库模式的依据，不能据此宣称所有CloudBase数据库接口均支持相同事务。
- [CloudBase SQL操作](https://docs.cloudbase.net/model/db-raw-query)：该接口页面明确提示不支持事务等高级功能；不能在未经核实的SQL接口上实现并发选人/推广占位。
- [CloudBase存储SDK](https://docs.cloudbase.net/storage/sdk)：公开与私有文件的访问方式有区别；私有临时链接仍需测试持有者、有效期、撤权及转发场景。存在临时链接不证明本项目隐私验收通过。
- [CloudBase云函数配置](https://docs.cloudbase.net/cli-v1/functions/configs)：列出运行版本与timer触发器。2026-10-06查询页面列出Nodejs20.19及Nodejs22.21/24.11公测版本；实际云环境尚未开通，不预选公测版本，也不把本地Node版本当成云端已支持版本。
- [PostgreSQL约束](https://www.postgresql.org/docs/current/ddl-constraints.html)：作为独立后端候选的唯一约束等能力依据，不作为当前部署选择。
- [Node.js测试运行器](https://nodejs.org/docs/latest-v24.x/api/test.html)：本次开发记录验证使用本机已存在的Node.js及内置node:test，无需安装测试库。产品TypeScript构建、集成与小程序自动化依赖将在DP01环境准备时查版本、安装后验证并锁定；当前未完成锁定。

安装前本机检查：Node.js **24.18.0**，npm **11.16.0**；常见安装路径和卸载记录中没有找到微信开发者工具，与用户回复一致。本次没有改动现有Node安装或全局环境变量。

微信工具版本依据：[官方工具下载页](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)及其加载的[官方版本清单](https://devtools.wxqcloud.qq.com.cn/WechatWebDev/nightly/versions/config.json)。2026-10-06实际读取稳定版为**2.02.2608080**，清单日期2026-09-30；安装前须验证Windows架构、安装包签名和实际版本。读取版本清单不等于已经安装。

已完成安装准备：本机架构AMD64；从官方清单提供的Windows 64位稳定版链接下载到`.local/downloads/wechat_devtools_2.02.2608080_win32_x64.exe`，实际190,935,184字节。Windows Authenticode校验为**Valid**，签名主体Tencent Technology (Shenzhen) Company Limited，文件版本**2.02.2608080**。SHA-256：`8a3255fe7626879b472dc5145e1b29d797f86d0a6bd9d775097f2ba5f9bb7467`。这是本地文件校验值，不能表述为官方另行公布的校验值。安装包由`.gitignore`排除，已保留；准备阶段没有执行安装，后续实际结果如下。

DP01写明“采购或安装另需对应授权”。官方包、版本与签名交付后，用户实际回复**“确认”**，安装动作已获授权。

安装结果：2026-10-06使用官方安装程序安装到`E:\O2O\.local\tools\wechat-devtools`，返回码**0**。读取实际安装包的`resources/app.asar.unpacked/package.json`，应用版本为**2.02.2608080**；Windows安装记录一致。主程序文件版本为**2.02.0**，这是Electron外壳版本字段，不能拿它代替应用完整构建号；主程序签名校验**Valid**且签名主体腾讯。`cli.bat --help`和`cli.bat open --help`返回码均为**0**。已启动工具供用户扫码；登录、AppID开发权限和云环境尚未验证。

安装程序类型从本地包清单识别为NSIS；安装选项依据[NSIS官方说明](https://nsis.sourceforge.io/Docs/Chapter3.html)。没有关闭安装包CRC验证。工具和安装包均位于Git忽略的`.local/`目录。需要回退时使用该目录内官方`卸载微信开发者工具.exe`或Windows已登记的卸载入口；卸载另经确认，不删除项目、账号或云数据，也不为回退删除安装包。

真实工具验证入口：[validate-devtools-installation.ps1](../tests/validate-devtools-installation.ps1)。它检查安装文件、应用完整版本、签名、卸载入口和CLI命令，失败立即停止。该检查针对当前Windows机器，不代表小程序登录、功能路径或生产部署通过。创建云资源前说明对应套餐与费用，按已采用的费用安排确认。扫码登录/主体资料由用户完成。

## 5. 后续目录与验证方式

以下是采用技术对应的目录规划，尚未创建产品工程：

| 目录 | 职责 |
| --- | --- |
| miniprogram/ | 小程序页面、组件、类型、运营入口及错误/权限状态 |
| cloudfunctions/ | 云函数入口、身份上下文与供应商适配；不接受客户端伪造身份 |
| packages/domain/ | 与供应商SDK分开的业务规则；使用明确服务端时钟和数据访问合同 |
| tests/unit/ | 金额、状态、年龄边界、评分算法和时间边界 |
| tests/integration/ | 多账号直接请求、真实测试存储、事务竞争、重复事件及恢复 |
| tests/e2e/ | 小程序完整路径、表单恢复、运营账号与权限态 |
| docs/ | 决策、接口/模型合同、阶段证据、恢复及交接 |

当前可以实际执行的入口：

```powershell
node --test tests/development-decisions.test.cjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/validate-devtools-installation.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/validate-development-plan.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/validate-structured-design.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/validate-ui-design-v2.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/validate-ui-design.ps1
```

以上仅验证现有文档与开发记录。产品测试入口在产品工程创建且实际运行后记录，不能把尚不存在的命令写成已通过。

## 6. 当前进度与未完成前置

| 任务 | 状态 | 已完成内容 | 剩余内容 |
| --- | --- | --- | --- |
| DP01 | 执行中 | 技术与费用安排获确认；官方工具已获授权安装并通过版本/签名/CLI验证；目录和验证分层 | 扫码登录与AppID开发权限、选定实际数据库模式与SDK/运行版本、依赖锁定及云环境步骤验证 |
| DP02 | 资料准备中 | [外部证据台账](external-evidence.md)建立；真实主体及缺项列出；咨询草稿可审阅 | 核实项目适用来源、填写实际后台材料和负责事项；草稿未发送 |
| DP03 | 未开始 | 既有最小必要与不存原证件约束保持 | 依赖DP02；具体保存期限、删除触发及供应商留存须核实并确认 |
| DP04 | 资料准备中 | 小程序内运营入口已确认 | 依赖DP02；实际地区/分类/供给资料、两位账号和交接仍待用户提供 |
| DP05 | 未开始 | 已采用v2设计保持 | DP01/DP04完成后补齐页面状态、设备与必要降级确认 |
| DP06 | 未开始 | 不编造预算、人员或日期 | 前置任务完成后确认投入、用量、预算与排期 |
| DP07 | 未开始 | 开发任务已授权，尚未建立产品工程 | 严格等待DP01/DP03/DP04完成 |

DP08—DP40均未开始。阶段A尚未完成，不提前进入阶段B；测试或资料准备不能替代前置任务验收。E01—E06/QG01仍未通过，生产入口未启用。

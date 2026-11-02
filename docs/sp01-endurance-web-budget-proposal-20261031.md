# SP01 耐久与网页后台测量提案（待确认）

本文件记录可执行测量方法和待定预算。用户已确认耐久测试的**准备工作量**为连续 60 分钟、至少 60 次完整循环、每 10 分钟记录一次；这不是正式产品耐久通过结果。没有正式产品，也没有内存或网页任务的真实基线。原合同的启动、切页、反馈、60Hz 滚动及各组 3 轮×30 次门槛保持不变。

## 复用与工具依据

- 项目内已有 [质量合同](v1-quality-acceptance-20261027.md) QP08/09、[设备探针](../tools/sp01-device-probe/README.md)和 [Chrome 最小入口验证](sp01-web-browser-evidence-20261030.md)。设备探针只报告微信性能条目，不提供可归属的小程序堆内存；不能把整机内存作为页面内存。
- [Chrome Performance monitor](https://developer.chrome.com/docs/devtools/performance-monitor)可显示网页 JS heap、DOM 节点、事件监听器、文档、框架和 CPU 的时间变化。[Chrome Memory 面板](https://developer.chrome.com/docs/devtools/memory-problems/heap-snapshots)可取并比较可达对象快照。这是**工具能力**，尚未在正式网页后台测过。
- 这些是浏览器内置工具，无额外第三方许可、依赖升级或接入成本；正式后台建立后再验证其数据可重复性。
- 2026-11-02 在华为备用机验证了 Android WebView 渲染进程的 PSS 读取方法：ActivityManager 将一个隔离渲染进程关联到 `com.tencent.mm`，`dumpsys meminfo <pid>` 可读出三次 PSS（14,371、16,471、16,470 KB）。微信 AppBrand 宿主进程同时报告约 820,463 KB，不作为单页内存值。Android 官方说明渲染进程与宿主分离，但同一应用的多个 WebView 可能共享渲染进程；本次没有把 PID 关联到某个小程序路由，也没有 WebView DevTools socket。因此这只是**微信渲染进程级方法可行性**，不能证明单页归属、产品增长或泄漏预算。原始测量摘要见 [本机证据 JSON](sp01-huawei-webview-memory-probe-20261102.json)。参考：[Android WebView memory](https://developer.android.com/develop/ui/views/layout/webapps/manage-webview-memory)、[WebView renderer API](https://developer.android.com/reference/android/webkit/WebView#getWebViewRenderProcess())、[dumpsys](https://developer.android.com/tools/dumpsys)。
- 小程序页面级内存归属仍未验证。正式产品页面出现后，需要证明采集进程对应目标小程序实例/路由，并记录宿主与渲染器分层资源；未证明归属前，不把渲染器单进程 PSS 或整段微信/AppBrand 宿主 PSS当成单页预算。内存增长预算保持未定。

## 待用户确认的测量参数

| 项目 | 可审阅提议 | 当前状态与理由 |
| --- | --- | --- |
| 耐久长度 | 连续 60 分钟，至少 60 次完整混合循环；不足 60 次时延长到达标，不提前结束 | **已确认准备工作量**。真实单循环耗时须在 SP05 页面场景确定后校准。 |
| 混合循环 | 浏览列表、进入详情、返回、打开/关闭弹层、发布表单输入与取消、图片加载、业务查询；每轮恢复到同一基线页 | **提议，未确认**。只用合成账号与可回退数据；具体页面和操作由 SP05 冻结。 |
| 分段观察 | 起点、每 10 分钟、终点记录；每段记录循环次数、请求/失败/重复数、可归属资源计数、帧轨迹和异常 | **每 10 分钟记录已确认**；其余记录字段为合同要求的测量方案。时间点不能替代原始连续轨迹。 |
| Web 内存 | 同一 Chrome 版本、页面、数据集下记录 Performance monitor 曲线；起点、中点、终点于稳定状态比较 heap 快照及节点/监听器数 | **方法候选**。增长数值预算须先对正式页面做试测，再给用户确认；不将一次 GC 波动当泄漏。 |
| 小程序内存 | 先验证是否能取得归属明确、稳定的页面级测量值；未验证前数值预算留空 | **部分方法证据**：已读到微信隔离 WebView 渲染进程 PSS；单页面归属未证明，仍不能冻结增长预算，也不能用系统总内存或宿主微信进程总量替代。 |
| Web 核心任务 | Chrome/Windows 逐项测队列打开、筛选、详情打开、确认操作和看板切换，从输入到必要内容及合法操作可用；正常网络、数据集和缓存单独分组 | **方法候选**。具体 P95 预算须由正式页面试测及用户确认；不能借用微信端 800ms 切页预算。 |

## 验证与回退

先在正式工程出现后用合成数据试跑，核对采集开销、是否能归属到目标页面、数据是否稳定，再冻结内存增长和 Web 核心任务数值预算。正式验收仍按合同执行失败、弱网、异常恢复和 3 轮×30 次，不得删掉慢样本。若测量方法不成立，保留失败证据并换工具，经确认再重测。当前 R05 与 SP01 均为未通过；本文件不触碰云端或生产数据。

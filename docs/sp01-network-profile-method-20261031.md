# SP01 网络条件取证方法（R04）

## 已有实测与范围

[OPPO 家中 Wi-Fi 的 30 次样本](sp01-network-home-wifi-20261031.json)来自小程序对 `sp01IdentityProbe` 的只读调用：30/30 成功，应用层往返 P50 284ms、P95 470ms、最大 1701ms。这不能换算成链路 RTT、上下行、抖动或丢包；第一次 1701ms 样本保留。`Date.now` 墙钟变化未被独立排除。正式业务接口建立后按质量合同另行测量。

## 复用选择与执行

项目内现有采样页只测 CloudBase 应用往返，缺少链路字段。采用 [Cloudflare 官方网络测速页](https://speed.cloudflare.com/)由用户在同一 OPPO 和同一 Wi-Fi 下测一次；[Cloudflare 文档](https://developers.cloudflare.com/speed/troubleshooting/slow-website/)明确该页可显示下载、上传、延迟、抖动和丢包。无需引入第三方包、设备权限或项目代码。记录页面实际显示的每个数字、单位、测试时间、设备、接入方式；未显示就写“未显示”，保留原始截图，截图中的 IP/位置可遮盖。不得把手机到 Cloudflare 的结果称为手机到 CloudBase 的链路结果。

首轮[用户截图结果](sp01-network-cloudflare-home-wifi-20261031.json)显示下载25.5 Mb/s、上传33.5 Mb/s、延迟200ms、抖动40ms、丢包率14.3%；用户随后确认设备是 OPPO PLJ110、接入的是同一家庭 Wi-Fi，截图本身未独立证明这两项。[第二轮截图](sp01-network-cloudflare-home-wifi-round2-20261031.json)显示下载27.1 Mb/s、上传25.1 Mb/s、延迟191ms、抖动74.3ms、丢包率1.8%。两轮丢包相差12.5个百分点，不能用第二轮覆盖第一轮，也不能把小程序30次成功解释成零丢包。两轮均到 Cloudflare，尚不足以冻结稳定正常网络范围。若继续测，需在同一地点和接入方式下分时段做独立轮次，记录每轮原值，不能挑选最好结果。公共 Wi-Fi 单列，不与家中 Wi-Fi 合并。测速会消耗网络流量，用户自行在手机操作。

Pakomo 已安装到华为备用机；此前用户报告一次仅微信单应用的轻度弱网检查中，未选浏览器可联网，停止 VPN 后网络恢复。用户先后粘贴三轮正常标签和三轮轻度弱网标签的30次只读 `sp01IdentityProbe` 结果：首轮分别见[Huawei/Pakomo 记录](sp01-network-huawei-pakomo-light-20261102.json)和[Huawei 正常档记录](sp01-network-huawei-normal-20261102.json)，新增四轮原始值与复算见[配对重跑记录](sp01-network-huawei-paired-reruns-20261102.json)。六轮均为30/30成功，探针报告 Wi-Fi。两组新增配对中，轻度弱网标签的平均中间 P50 分别高82ms、108.5ms；三轮每轮P50均值为正常288.5ms、轻度弱网381.83ms，方向一致，结果与较高的应用往返时延相符。P95仍不稳定：新增两组分别高8ms、165ms，但三轮平均P95为正常581.67ms、轻度弱网545.33ms，受首轮离群值影响而反向。所有这些都是应用层往返，不是链路 RTT、吞吐、抖动或丢包指标；本次重跑没有逐轮直接观察 Pakomo/VPN 状态、诊断计数、运行时间或墙钟变化，因此只能说中位数模式与弱网延迟相符，不能确认具体参数已生效或作强因果归因。还需逐轮留下条件证据，独立测量链路 RTT/吞吐/丢包，并验证中断恢复及公共 Wi-Fi 场景。R04 与 SP01 继续保持待完成。

2026-11-03 新增[华为探针报告为4G的样本](sp01-network-huawei-cellular-4g-20261103.json)：30次只读 `sp01IdentityProbe` 调用全部成功，独立复算 P50=327ms、最近秩 P95=949ms、最大1747ms。报告中的 `networkType` 为 `4g`；设备身份来自当时的华为备用机上下文，探针粘贴内容本身没有设备字段。该轮未记录 Pakomo/VPN 状态、配置档、精确运行时长或单调时钟，也没有独立测量蜂窝链路 RTT、吞吐、抖动和丢包。因此只作为应用层蜂窝网络诊断样本，不证明弱网注入、生效参数、链路质量或稳定范围；R04 与 SP01 仍待完成。

同日新增两轮[华为备用机 4G Cloudflare 测速](sp01-network-huawei-cloudflare-4g-20261103.json)：第一轮下载12.7Mbps、上传15.8Mbps、延迟218ms（下载220ms、上传224ms）、抖动105ms（下载269ms、上传178ms）、丢包17.1%；第二轮下载3.57Mbps、上传14.3Mbps、延迟212ms（下载229ms、上传362ms）、抖动145ms（下载172ms、上传215ms）、丢包9.3%。第二轮截图显示流媒体、游戏、视频通话均1/5。两轮截图均可见4G标记；SEA-AL10 型号来自同一设备上下文，截图未显示型号。第二轮单独记录在[证据 JSON](sp01-network-huawei-cloudflare-4g-round2-20261103.json)及[原图](evidence/sp01-network-huawei-cloudflare-4g-round2-20261103.jpg)。两轮读数有差异，且 Pakomo/VPN 状态未被逐轮核实，因此保留两轮原值但不冻结稳定蜂窝网络范围。它们是手机到 Cloudflare 的链路观察，与同日 `sp01IdentityProbe` 的30次应用层往返分开记录，不能相互替代或合并推断，也不证明弱网注入。R04 与 SP01 仍待完成。

回退：本文件仅记录测量方法，没有云端部署、文件写入或设置更改；若手机浏览器无法显示必要字段，保留失败观察并另选已验证工具。

2026-11-02 的[华为设备当前状态快照](sp01-pakomo-current-device-snapshot-20261102.json)由只读 ADB 检查记录：Pakomo 包仍安装且进程运行；当时系统连接的是已验证 Wi-Fi，网络能力标记为 `NOT_VPN`，筛选后的 connectivity 输出中没有 VPN transport network agent。该快照只说明检查时的系统网络状态；不能回溯证明六轮采样时 VPN 或 Pakomo 配置状态，也不能证明其具体整形参数生效。检查没有启动/停止 VPN、改设备设置或调用 CloudBase。

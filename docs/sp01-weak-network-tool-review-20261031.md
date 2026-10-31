# SP01 弱网注入工具核对（R04，候选）

## 验收目标

按[质量合同](v1-quality-acceptance-20261027.md)第 5.2 节，SP01 需在正式工程前冻结限速、高延迟、丢包、中断、恢复的参数与可复现步骤。方法必须证明作用于微信小程序到 CloudBase 的请求；工具能力资料不等于本项目已验证。

## 按复用顺序核对

| 来源 | 已查证能力 | 本项目适用边界 |
| --- | --- | --- |
| 项目内 | [独立网络采样页](../tools/sp01-network-probe/README.md)已能在真机记录只读云函数的应用层往返与成败 | 仅观察，不注入；不能从成功率推断实际丢包 |
| 苹果官方 | [Apple 网络调节器文档](https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/On_Demand_Resources_Guide/TestingPerformance.html)说明开发设备的设置→开发者可进入 Network Link Conditioner，配置作用于当前连接的网络流量；[Apple 开发者模式文档](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device)说明开发者模式入口仅在启动与 Mac 配对或曾配对后才出现在设置中 | 用户报告 iPhone XR 更新至 iOS 18.7.11 后仍未找到入口、未成功开启开发者模式。不能据此归因于 iOS 版本；现有 Windows 11 环境下此候选当前不可用。不要求为本测试升级系统、采购 Mac 或修改手机 |
| Android 官方 | [Android Emulator 命令行](https://developer.android.com/studio/run/emulator-commandline)支持模拟器上下行速率和延迟设置 | 官方说明作用于模拟器；不能直接代表现有 Android 真机微信。文档尚未证明所需丢包、断网/恢复组合在目标微信小程序上可重现 |
| Chrome 官方 | [DevTools 限速配置](https://developer.chrome.com/docs/devtools/settings/throttling/)可对网页请求设速率和延迟，丢包相关参数说明针对 WebRTC | 可用于 Web 后台浏览器测量，不能当作手机微信云 SDK 的弱网注入 |

当前没有采用外部库或自行实现流量代理。跨设备代理需要先核实安全、许可、维护、系统兼容、是否实际拦截微信请求和恢复能力，不能因一个功能引入未经验证的整套系统。

## 最小验证顺序（待入口确认）

1. iPhone XR 入口核查已完成：当前未出现；苹果方法暂不采用。若未来已有可用 Mac/开发设备，再重新核对，不把升级 iOS 当解除条件。
2. 下一候选须在 Android 真机或外部网络设备上验证；先核对许可、维护、隐私与兼容性，再测试是否确实影响微信小程序到 CloudBase 的请求。没有真实请求对照前不得冻结弱网参数。
3. 若方法成立，先记录原状态与恢复步骤，再提出一组具体限速、延迟、丢包、中断和恢复参数供用户确认；使用当前只读身份函数做基线与注入后对照，核对同一 AppID/环境、请求数、失败与耗时。
4. 正式业务出现后仍按 QP07 各场景独立验证。Android 方法不自动覆盖 iPhone。

此文件只记录候选与验证步骤；当前没有改任何手机、云端或项目网络配置，R04 与 SP01 均未通过。回退只需撤销本文件对应提交。

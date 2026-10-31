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

## Android 真机候选源码核查（2026-10-31，仅静态）

候选为 [WeakNet](https://github.com/baithinking134/WeakNet)，核对固定提交 `54f6377c931582ad7cb538598d089b66250328ce`，不是核对或安装发布 APK。[许可证](https://github.com/baithinking134/WeakNet/blob/main/LICENSE)为 Apache-2.0；核查时仓库显示 7 次提交，历史和设备覆盖有限。构建文件声明 `minSdk 23`、`targetSdk 36`，依赖列为 AndroidX/Compose；这只说明 Android 10 在声明的最低系统范围内，不证明华为 SEA-AL10 或微信小程序实际兼容。

- [Manifest](https://raw.githubusercontent.com/baithinking134/WeakNet/54f6377c931582ad7cb538598d089b66250328ce/app/src/main/AndroidManifest.xml)申请 VPN、悬浮窗、读取已安装应用列表、通知与前台服务能力，且 `allowBackup=true`。这是对测试手机的敏感权限要求。
- [VPN 服务](https://raw.githubusercontent.com/baithinking134/WeakNet/54f6377c931582ad7cb538598d089b66250328ce/app/src/main/java/com/awu/weaknet/vpn/WeakNetVpnService.kt)使用 Android `VpnService`。选定应用列表非空时调用 `addAllowedApplication`；若列表为空，排除自身后将其余应用纳入 VPN。因此必须先实测仅微信被选中，不能依赖默认状态。服务停止时关闭虚拟网卡；还需在手机上实测停用、系统 VPN 状态及原网络恢复。
- [网络配置](https://raw.githubusercontent.com/baithinking134/WeakNet/54f6377c931582ad7cb538598d089b66250328ce/app/src/main/java/com/awu/weaknet/vpn/VpnConfig.kt)内置三个 DNS 服务器。源码通过受保护的上游 socket 转发流量；[处理器](https://raw.githubusercontent.com/baithinking134/WeakNet/54f6377c931582ad7cb538598d089b66250328ce/app/src/main/java/com/awu/weaknet/vpn/engine/PacketProcessor.kt)包含目标 IP/端口的调试日志。未见源码依据可证明安装包无外传或完整隐私安全，不能把静态阅读等同于安全审计。
- [丢包实现](https://raw.githubusercontent.com/baithinking134/WeakNet/54f6377c931582ad7cb538598d089b66250328ce/app/src/main/java/com/awu/weaknet/vpn/manipulation/PacketLossManipulator.kt)有随机及突发模式；TCP 出站在 `PacketProcessor` 中另行判定，DNS/ICMP 另有处理。标称丢包百分比仍需对目标微信请求实测，不能从源码推断实际业务失败率。[限速实现](https://raw.githubusercontent.com/baithinking134/WeakNet/54f6377c931582ad7cb538598d089b66250328ce/app/src/main/java/com/awu/weaknet/vpn/manipulation/ThrottleManipulator.kt)为按会话令牌调度，未证实多连接总速率达到设定值。

**结论：暂不安装。** 它比只读采样页更接近所需真机注入，但权限与流量接管范围较大，且目前只有静态源码核查；没有本地构建、APK 与源码对应性、华为真机运行或微信 CloudBase 对照证据。若继续，应先在独立候选目录从固定提交构建并核对权限，提出仅备用机、仅微信、短时、可停用的具体方案供用户确认；不得直接下载并运行未经核对的预编译 APK。若本地构建不可行，再比较外部网络设备方案，不能假装已通过 R04。

## 最小验证顺序（待入口确认）

1. iPhone XR 入口核查已完成：当前未出现；苹果方法暂不采用。若未来已有可用 Mac/开发设备，再重新核对，不把升级 iOS 当解除条件。
2. 下一候选须在 Android 真机或外部网络设备上验证；先核对许可、维护、隐私与兼容性，再测试是否确实影响微信小程序到 CloudBase 的请求。没有真实请求对照前不得冻结弱网参数。
3. 若方法成立，先记录原状态与恢复步骤，再提出一组具体限速、延迟、丢包、中断和恢复参数供用户确认；使用当前只读身份函数做基线与注入后对照，核对同一 AppID/环境、请求数、失败与耗时。
4. 正式业务出现后仍按 QP07 各场景独立验证。Android 方法不自动覆盖 iPhone。

此文件只记录候选与验证步骤；当前没有改任何手机、云端或项目网络配置，R04 与 SP01 均未通过。回退只需撤销本文件对应提交。

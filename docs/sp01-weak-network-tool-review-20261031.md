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

**结论：不采用 WeakNet。** 这份核查只覆盖固定提交源码，未构建、未安装；其应用筛选回退、悬浮窗权限和实现成熟度不适合当前小范围验证。后续另行核对的 Pakomo 候选见下节，不改变本节判断。

## Android 真机候选源码核查：Pakomo v0.3.0（2026-11-01，仅静态）

候选为 [AlfWorks/Pakomo v0.3.0](https://github.com/AlfWorks/Pakomo/releases/tag/v0.3.0)，源码固定到提交 `6798549060990f9bdcb7a9feedbe16259ee95d9d`。仓库提供 GPL-3.0 许可证；这是独立测试工具候选，不纳入湘邻湘友产品或其依赖。发布页显示版本于 2026-09-11 发布。该项目规模和独立审查证据有限，不能按“成熟、已安全审计”处理。

| 复用核查 | 查证结果 | 对本项目的边界 |
| --- | --- | --- |
| 项目内已有工具 | `sp01-network-probe` 可测应用层往返；没有微信真机弱网注入能力 | 保留现有采样页；不重复实现整形器 |
| Android 官方能力 | [Android VPN 指南](https://developer.android.com/develop/connectivity/vpn)说明首次激活要由用户在系统弹窗确认，状态栏会显示 VPN 标记；[VpnService API](https://developer.android.com/reference/android/net/VpnService)说明同一时刻系统只有一个活动 VPN | 开始前确认备用机没有必须保留的其他 VPN；仅用户确认系统弹窗后短时启用，结束时停止并核验网络恢复 |
| Pakomo 源码能力 | [固定提交的能力矩阵](https://github.com/AlfWorks/Pakomo/blob/6798549060990f9bdcb7a9feedbe16259ee95d9d/docs/01-capabilities/capability-matrix.md)列出按应用筛选、延迟/抖动、丢包、限速和断网类场景；[VPN 服务源码](https://github.com/AlfWorks/Pakomo/blob/6798549060990f9bdcb7a9feedbe16259ee95d9d/app/src/main/java/com/alphynia/pakomo/vpn/WeakNetworkVpnService.kt)按所选应用建立允许列表 | 源码声明的能力不是这台 SEA-AL10 上的实测。若试用，只选择微信；先证明其他应用流量不受影响，并验证微信到同一只读 CloudBase 端点的请求确实被影响 |
| 许可、更新与接入 | [许可证](https://github.com/AlfWorks/Pakomo/blob/6798549060990f9bdcb7a9feedbe16259ee95d9d/LICENSE)为 GPL-3.0；[构建配置](https://github.com/AlfWorks/Pakomo/blob/6798549060990f9bdcb7a9feedbe16259ee95d9d/app/build.gradle.kts)声明 `minSdk=29`，与用户华为备用机 Android 10 的版本下限相符；[更新控制器](https://github.com/AlfWorks/Pakomo/blob/6798549060990f9bdcb7a9feedbe16259ee95d9d/app/src/main/java/com/alphynia/pakomo/update/NoviUpdateController.kt)在更新源或信任锚为空时禁用自更新；[发布流水线](https://github.com/AlfWorks/Pakomo/blob/6798549060990f9bdcb7a9feedbe16259ee95d9d/.gitlab-ci.yml)会为正式标签构建注入更新源 | `minSdk` 只证明声明的最低系统版本，不证明华为兼容。不能直接安装来源不匹配或更新源未核实的官方发布 APK。若用户同意继续，先在隔离目录检查构建脚本和依赖，再讨论本地构建；只有最终 APK 的包标识、签名、权限、更新源为空等均经实证核对后，才另行确认是否安装 |
| 权限与隐私 | [Manifest](https://github.com/AlfWorks/Pakomo/blob/6798549060990f9bdcb7a9feedbe16259ee95d9d/app/src/main/AndroidManifest.xml)声明 VPN/网络、前台服务、通知、`QUERY_ALL_PACKAGES` 和 `SYSTEM_ALERT_WINDOW`；后两项分别涉及应用列表与悬浮窗。能力矩阵还描述本地连接元数据记录 | 不授予悬浮窗权限；仅测试包若需要的系统 VPN 同意和应用选择。实际采集、日志保存与联网情况尚未在 APK/设备实测，静态审查不能证明不存在额外行为 |

**本阶段决策：Pakomo 是值得评估的构建候选，不是已批准安装的工具，也不是 R04 通过证据。** 固定提交的源代码、许可、权限、更新源、构建入口与依赖已完成只读审查，详情见下一节。用户于 2026-11-01 授权在隔离目录准备官方工具并尝试本地调试构建；实际进度和阻塞见下方“本地隔离构建准备与停止点”。没有运行官方发布 APK、没有生成 APK、没有安装、没有触发 VPN，也没有调用 CloudBase。安装如获另行确认，仅用用户自己的华为备用机 SEA-AL10 Android 10，系统 VPN 弹窗由用户确认，只选微信，不授权悬浮窗；回退为停止 VPN、确认图标消失和原网络恢复，再卸载候选应用。该候选尚未在华为备用机实测。

## 固定提交的构建入口审查（2026-11-01，仅只读）

检查对象仍为提交 `6798549060990f9bdcb7a9feedbe16259ee95d9d`，没有执行其中的脚本或 Gradle Wrapper。

| 核对项 | 查证结果 | 实际边界 |
| --- | --- | --- |
| Gradle入口 | [Wrapper配置](https://github.com/AlfWorks/Pakomo/blob/6798549060990f9bdcb7a9feedbe16259ee95d9d/gradle/wrapper/gradle-wrapper.properties)请求 Gradle 8.13；未配置 `distributionSha256Sum`。[settings.gradle.kts](https://github.com/AlfWorks/Pakomo/blob/6798549060990f9bdcb7a9feedbe16259ee95d9d/settings.gradle.kts)声明 Google、Maven Central、Gradle Plugin Portal 仓库，单一 `:app` 模块，没有 `includeBuild` | Wrapper 首次运行需下载发行包；未由仓库配置发行包校验和。尚未检查或运行 Wrapper JAR |
| 官方下载完整性 | [Gradle 官方校验表](https://gradle.org/release-checksums/)列出的 8.13 binary ZIP SHA-256 为 `20f1b1176237254a6fc204d8434196fa11a4cfb387567519c61556e8710aed78`；[Android 官方下载页](https://developer.android.com/studio)列出的 Windows command-line tools ZIP（155.7 MB）SHA-256 为 `90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a` | 这是本轮下载的官方预期值，已与本地文件 SHA-256 逐一比对一致；详见下节。Android SDK 许可仍由用户自行审阅和接受 |
| 插件与依赖 | 固定版本目录声明 Android Gradle Plugin 8.13.2、Kotlin 2.3.21，并依赖 AndroidX/Compose 和 Maven Central 上的 Novi 组件 | 构建仍会执行 Gradle 插件及依赖中的代码；源码静态检查不构成供应链审计 |
| 构建任务与签名 | [app/build.gradle.kts](https://github.com/AlfWorks/Pakomo/blob/6798549060990f9bdcb7a9feedbe16259ee95d9d/app/build.gradle.kts)区分 Kernel 与 HEV flavor；Kernel 路径不需 NDK。构建脚本会读取本地 Git 短提交号；若存在 `keystore.properties` 则可用于签名 | 任何后续构建限定 `kernelDebug`，不运行发布、签名或 CI 任务；需先确认独立工作目录内没有签名文件并复核依赖任务图 |
| 更新配置 | 构建配置从环境变量读取更新源和信任锚；未设置时源码路径禁用更新器。正式发布流水线会注入更新配置 | 只有 APK 静态检查确认更新地址、信任锚、包名、签名和权限后，才可提交安装评估；静态默认值不是 APK 证据 |
| 当前电脑 | 原有系统 Java 25 可用；开始前系统 PATH 未发现 Gradle、`adb`、`sdkmanager`，`ANDROID_HOME` / `ANDROID_SDK_ROOT` 为空，常见系统 SDK 路径不存在。本轮在独立目录准备了 Microsoft OpenJDK 17、Gradle 8.13、Android command-line tools | 工具位于隔离审计目录，没有改系统安装或全局环境变量。Android SDK 平台/构建工具尚未安装；许可证未接受 |

## 本地隔离构建准备与停止点（2026-11-01）

用户已授权仅在 `tools/sp01-pakomo-build-audit` 内准备工具并尝试固定源码的 Kernel 调试构建。该目录为本轮新建的隔离工作区；Pakomo 检出到固定提交 `6798549060990f9bdcb7a9feedbe16259ee95d9d`，源码内未发现 `keystore.properties`。没有改动原小程序工程、系统 SDK、全局环境变量或其他项目文件。

| 本地工具 | 实际版本 | 本地 SHA-256 | 核验来源 |
| --- | --- | --- | --- |
| Gradle binary distribution | 8.13 | `20f1b1176237254a6fc204d8434196fa11a4cfb387567519c61556e8710aed78` | [Gradle 官方校验表](https://gradle.org/release-checksums/)；本地哈希一致 |
| Android command-line tools for Windows | build `15859902` | `90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a` | [Android Studio 下载页](https://developer.android.com/studio)；本地哈希一致 |
| Microsoft OpenJDK for Windows x64 | 17.0.21.0.2 | `49154292866386b2f4f09a3ecf3be07ab80a419149c84ec1d4419b9eec9e4b64` | [Microsoft OpenJDK 下载页](https://learn.microsoft.com/en-us/java/openjdk/download)及其 SHA-256 sidecar；本地哈希一致 |

本机系统 Java 是 25；已验证隔离 JDK 17 与 Gradle 8.13 可启动。首次 dry-run 请求卡在 HTTPS 响应读取；只读检查发现当前代理监听于 `127.0.0.1:7897`。随后仅对该 Gradle 子进程传入代理参数，未更改系统或 Codex 的代理设置。该代理诊断后，Gradle 已继续解析项目构建配置/依赖。

**实际停止原因：Android SDK 许可证未接受。** 本轮只请求 `:app:assembleKernelDebug --dry-run` 以审阅任务图；Gradle 在依赖任务判定阶段因以下 SDK 包许可证未接受而退出，未生成可审阅的完整任务图：

- `build-tools;35.0.0`
- `platforms;android-36`

dry-run 未执行 Android 编译/打包任务。没有接受任何 SDK 许可证，也没有安装上述 SDK 包、生成 APK、安装应用、启用 VPN、调用 CloudBase、登录或更改路由器。Gradle 配置与依赖解析阶段已启动，因此不能表述为“完全没有运行第三方构建代码”。

下一步由用户在 Android Studio SDK Manager 或命令行自行审阅并接受 Android SDK 许可证，再安装 `Android SDK Build-Tools 35.0.0` 与 `Android SDK Platform 36`。Android 官方说明使用 SDK 前必须接受对应许可：[Android Studio / SDK 下载与条款](https://developer.android.com/studio)。接受并安装后告知我，我再核对安装版本/许可记录，重新运行 dry-run 审阅完整任务图；只有任务图确认限定在 Kernel debug、不读取签名配置、不构建 HEV/NDK 且不注入更新源，才执行获授权的 `kernelDebug`。APK 检查与之后是否安装仍分别记录；本轮授权不包含设备安装、VPN或云端测试。

**当前结论：R04 与 SP01 仍未通过。** 尚无 APK，也没有证明 Pakomo 在目标 Huawei/微信上隔离限速、丢包、中断和恢复。

## 外部网络路径核对（2026-10-31，只读）

| 路径 | 已核对 | 当前判断 |
| --- | --- | --- |
| Windows 11 移动热点 | [微软说明](https://support.microsoft.com/en-us/windows/experience/connectivity-networking/use-your-windows-device-as-a-mobile-hotspot)支持共享 Wi-Fi/以太网/蜂窝连接。电脑只读检查显示 WLAN 在线、以太网断开；`netsh wlan show drivers` 显示旧式 Hosted network 不支持，但不能据此判断现代移动热点是否可用 | 仅有转发路径的可能性；尚未启用热点或证明手机流量经过电脑 |
| Windows clumsy + WinDivert | [clumsy 源码](https://raw.githubusercontent.com/jagt/clumsy/master/src/divert.c)调用 `WinDivertOpen(..., WINDIVERT_LAYER_NETWORK, ...)`；[WinDivert 文档](https://github.com/basil00/WinDivert/wiki/WinDivert-Documentation)区分 NETWORK（电脑本机收发）与 NETWORK_FORWARD（经过电脑转发） | 现成 clumsy 不能凭 README 的“全系统”描述视为能影响热点下的手机流量；本方案暂不采用，也不安装驱动或运行程序 |
| OpenWrt 路由器 netem | [OpenWrt 文档](https://openwrt.org/docs/guide-user/network/traffic-shaping/sch_netem)提供延迟和丢包队列示例，可在实际转发设备上配置 | 尚不知道用户路由器型号、固件与可用权限；不能假定支持，且改家用主路由有影响全家网络的风险。需先只读核对设备，再决定是否存在隔离测试路径 |

目前没有经手机验证的注入方案。Pakomo 的源码候选可独立于借来的路由器继续评估；ZN-M2 仍保持不可用状态，不因出现该候选而修改家庭网络或联系/登录借用设备。任何候选须先证明只作用于选定微信、确实影响小程序到 CloudBase 的请求，并验证停用后的恢复；仅源码说明或本地构建成功不构成 R04 通过。

### 借用设备核对

用户提供的设备标签仅确认是中国电信定制的兆能讯通 **ZN-M2**，并说明这是借来的设备；当前固件未知。照片还包含登录及 Wi-Fi 凭据，项目证据只记录型号，不转录密码、序列号、MAC、二维码或整张标签图。型号级源码核对找到的都是社区构建，不是这台实机当前状态的证明：

| 来源 | 许可与维护证据 | 兼容性、接入成本与验证 |
| --- | --- | --- |
| [myjdesert/ZN-M2-OpenWrt](https://github.com/myjdesert/ZN-M2-OpenWrt) | README 说明该构建禁用 Wi-Fi；本次访问根目录 `LICENSE` 路径返回 404，未确认许可；最近提交时间未核实 | 固件面向特定扩容硬件配置，不能直接作为 Wi-Fi 弱网工具；没有本地构建或实机验证 |
| [osGex0o0II/ZN-M2-LiBwrt-Builder](https://github.com/osGex0o0II/ZN-M2-LiBwrt-Builder) | 仓库提供 MIT 许可文件；最近提交时间未核实 | README 将 256MB 原厂版本作为有线路由配置，禁用 Wi-Fi/USB 相关能力；不是隔离 Wi-Fi 弱网测试的直接适配；没有本地构建或实机验证 |
| [caosir1990/ZN-M2-OPENWRT-WIFI](https://github.com/caosir1990/ZN-M2-OPENWRT-WIFI) | 仓库提供 MIT 许可文件；README 记录的无线分支变更包含 2022—2023 年条目，当前分支维护状态未核实 | README 自述无线可用，但未证明兼容借来设备的硬件修订、当前固件或 `sch_netem`；没有本地构建或实机验证 |

以上仓库都是固件构建项目，不是可直接安装、可单独关闭的整形工具。借用设备的固件、硬件修订和所有者许可仍未知，因此不登录或刷写借用设备，也不修改家庭网络；但本项目无需等待该设备，先评估上面的手机本地候选。

## 最小验证顺序（截至 2026-11-02）

1. iPhone XR 入口核查已完成：当前未出现；苹果方法暂不采用。若未来已有可用 Mac/开发设备，再重新核对，不把升级 iOS 当解除条件。
2. SDK 许可证已由用户审阅并接受；`build-tools;35.0.0` 与 `platforms;android-36` 已安装。完整 `:app:assembleKernelDebug` 成功，且本地离线核对了包名、版本、SDK 范围和 debug 签名。APK 权限用途已审阅，安装已获用户确认；结果见下方“华为备用机安装核验”。
3. APK 已在华为备用机 SEA-AL10 安装。用户报告的最多60秒范围/恢复检查结果为：Pakomo“指定应用”、计数1（微信），微信连接正常、未选浏览器仍可联网、停止 VPN 后网络恢复。之后用户另行授权30次只读 `sp01IdentityProbe` 调用；华为 SEA-AL10、探针报告 Wi-Fi、轻度弱网条件下30/30成功。原始值及摘要见 [Huawei/Pakomo 记录](sp01-network-huawei-pakomo-light-20261102.json)。用户确认 VPN 已停止且网络恢复。该次运行未测链路 RTT/吞吐/丢包，也没有同机正常档基线或直接隧道观测，不能归因或量化弱网参数效果。下一步需另行授权，在同一华为和 Wi-Fi、VPN 停止/正常档下取得30次基线；不得复用已消耗的一次性30次采样授权。
4. 正式业务出现后仍按 QP07 各场景独立验证。Android 方法不自动覆盖 iPhone。

当前完成候选 APK 安装、一次用户报告的微信单应用范围/停止恢复检查，以及一轮30次只读 CloudBase 应用往返采样。没有量化链路损伤或同设备正常基线，无法归因于弱网配置；未记录授予额外权限。R04 与 SP01 均未通过。回退需先停止 VPN、确认网络恢复，再按用户确认卸载候选应用；本文件记录可随对应提交回退。

## 本地构建后续（2026-11-02）

用户发回的截图显示 Android SDK 许可证均已接受。只读核对确认 `build-tools;35.0.0` 与 `platforms;android-36` 已安装；完整任务图限定为 `:app:assembleKernelDebug`，无 HEV、NDK 或发布签名任务。首次纠正版本号后，Microsoft OpenJDK `17.0.21.0.2` 在 Gradle daemon 的 Sweeper thread 触发 `Internal Error (assembler_x86.cpp:1105), ShouldNotReachHere()`；确切根因未确定。崩溃报告留在仓库根目录 `hs_err_pid20392.log`，自动审查拦截了清理操作；报告可能包含进程环境值，禁止分享或提交，需由用户手动删除。

为区分 JDK 故障与项目构建故障，在项目隔离工具目录下载 Temurin `17.0.20.1+1`，并按 Adoptium API 返回值核对 ZIP SHA-256：`e53a79c3c3d86865bd7e787903884331068e71321714ffd44f145785affc7cb0`。Gradle 官方兼容表支持 Java 17 运行 Gradle 8.x。代理只通过本次构建子进程环境设置，没有修改系统设置。随后 `:app:assembleKernelDebug` 构建成功（Gradle 8.13，3m11s，39 项任务，8 执行、31 已是最新）；这证明该隔离源码可用 Temurin 生成 debug 包，但没有证明 Microsoft JDK 崩溃的根因。

| 离线检查项 | 结果 |
| --- | --- |
| APK | `tools/sp01-pakomo-build-audit/source/app/build/outputs/apk/kernel/debug/app-kernel-debug.apk`；63,988,226 字节；SHA-256 `F026D48E9D6F298A1419EA69332A7C28F8D50D7BF115D978DDB1FB0DC6BCBD34` |
| 包与版本 | `com.alphynia.pakomo.kernel`；versionCode `1`；versionName `0.1.0-kernel`；minSdk `29`；targetSdk `36`；compileSdk `36` |
| 签名 | `apksigner verify` 通过；单一 Android Debug signer；v2 签名有效。不是发布签名 |
| 清单权限 | 包含 `SYSTEM_ALERT_WINDOW`、`QUERY_ALL_PACKAGES`、`REQUEST_INSTALL_PACKAGES`、`FOREGROUND_SERVICE_SPECIAL_USE`、`POST_NOTIFICATIONS`、`INTERNET` 与 `ACCESS_NETWORK_STATE`；本轮没有安装或授予权限 |
| 非致命工具提示 | Android 工具报告 SDK XML v4，而当前命令行工具只识别至 v3；构建成功，但需在后续工具维护中更新/对齐 SDK 命令行工具 |

截至本地构建记录完成时，没有安装 APK、启动 VPN、变更设备或路由器、调用 CloudBase，亦未验证限速/延迟/丢包/中断和恢复效果。构建成功只完成工具可构建性，不满足 R04，更不能作为 SP01 通过证据。官方来源：[Adoptium Temurin 17 发布页](https://github.com/adoptium/temurin17-binaries/releases)、[Gradle Java 兼容表](https://docs.gradle.org/current/userguide/compatibility.html)。

## 华为备用机安装核验（2026-11-02）

用户明确确认安装后，通过 ADB 核对目标机为 HUAWEI SEA-AL10、Android 10；没有记录设备序列号。安装前查询确认包不存在。第一次 streamed install 在传输后失败且 ADB 连接短暂消失；恢复连接后以 `--no-streaming` 安装，命令返回 `Success`。`pm path`、`dumpsys package` 及 APK SHA-256 复核一致：`com.alphynia.pakomo.kernel`，versionCode `1`，versionName `0.1.0-kernel`，SHA-256 `F026D48E9D6F298A1419EA69332A7C28F8D50D7BF115D978DDB1FB0DC6BCBD34`。

安装后 `pidof` 未发现应用进程；`dumpsys connectivity` 未显示活动 Pakomo VPN；悬浮窗 `SYSTEM_ALERT_WINDOW` AppOp 为 `ignore`，`dumpsys package` 的运行时权限区为空。未打开应用、启动 VPN、选择应用、授予权限或调用 CloudBase。安装成功不等于 VPN 隔离或弱网注入通过。

静态源码复核发现 `APPLICATIONS` 范围通过 `addAllowedApplication` 只允许所选包；空选择时源码把范围限制为 Pakomo 自身。`GLOBAL` 范围则走 `addDisallowedApplication(Pakomo)`，属于广泛接管，本次测试没有使用。华为备用机的实际应用选择、Android VPN 确认和用户报告结果见下节。单应用隔离与停止恢复结果不能替代 CloudBase 弱网对照；该对照需要另行授权一次新的只读调用。

## 华为备用机单应用短时验证（2026-11-02）

Pakomo“规则”页截图显示内置“轻度弱网”已选中，参数为 100ms 延迟、30ms 抖动、1% 丢包、下行/上行 2048/1024 Kbps。运行状态截图显示接管范围为“指定应用”；应用选择页截图未展示应用名称，但用户确认唯一选中项是微信（计数1）。用户随后授权最多60秒的短时验证，并报告“都正常”：微信连接正常、未选浏览器仍可联网、停止 VPN 后网络恢复正常。

证据边界：以上实际运行结果来自用户回报，不是代理直接观察。具体运行秒数和 Pakomo 诊断计数未记录。用户随后另行授权30次只读 CloudBase 测量，并粘贴30条结果：探针报告 Wi-Fi，30/30成功，报告的中位值379ms、P95 566ms、最大1418ms；原始值保存在 [独立 JSON 证据](sp01-network-huawei-pakomo-light-20261102.json)。对偶数30个值，原始排序的中间两值为379和386ms，平均中位数为382.5ms；探针摘要采用下中位值379ms。用户随后确认 VPN 已停止且网络恢复。该应用层样本不测链路 RTT/吞吐/丢包；同设备正常档基线缺失，不能量化或归因弱网效果，也不能证明配置参数按标称值生效，因此不作为 R04 或 SP01 通过证据。下一步需另行授权，在同一华为和 Wi-Fi、VPN 停止/正常档下采集30次基线；之后再评估独立轮次与中断/恢复场景。

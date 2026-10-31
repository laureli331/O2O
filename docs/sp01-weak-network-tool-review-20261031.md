# SP01 弱网注入工具核对（R04，候选）

## 验收目标

按[质量合同](v1-quality-acceptance-20261027.md)第 5.2 节，SP01 需在正式工程前冻结限速、高延迟、丢包、中断、恢复的参数与可复现步骤。方法必须证明作用于微信小程序到 CloudBase 的请求；工具能力资料不等于本项目已验证。

## 按复用顺序核对

| 来源 | 已查证能力 | 本项目适用边界 |
| --- | --- | --- |
| 项目内 | [独立网络采样页](../tools/sp01-network-probe/README.md)已能在真机记录只读云函数的应用层往返与成败 | 仅观察，不注入；不能从成功率推断实际丢包 |
| 苹果官方 | [Apple 网络调节器文档](https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/On_Demand_Resources_Guide/TestingPerformance.html)说明开发设备的设置→开发者可进入 Network Link Conditioner，配置作用于当前连接的网络流量；[Apple 技术讲解](https://developer.apple.com/videos/play/tech-talks/111378/)明确可在 iPhone/iPad 的开发者设置中模拟网络条件 | iPhone XR 是否有该入口尚待本机查看；实际参数页、微信云函数影响和恢复还没验证。此为系统内置能力，不引入第三方依赖或许可成本 |
| Android 官方 | [Android Emulator 命令行](https://developer.android.com/studio/run/emulator-commandline)支持模拟器上下行速率和延迟设置 | 官方说明作用于模拟器；不能直接代表现有 Android 真机微信。文档尚未证明所需丢包、断网/恢复组合在目标微信小程序上可重现 |
| Chrome 官方 | [DevTools 限速配置](https://developer.chrome.com/docs/devtools/settings/throttling/)可对网页请求设速率和延迟，丢包相关参数说明针对 WebRTC | 可用于 Web 后台浏览器测量，不能当作手机微信云 SDK 的弱网注入 |

当前没有采用外部库或自行实现流量代理。跨设备代理需要先核实安全、许可、维护、系统兼容、是否实际拦截微信请求和恢复能力，不能因一个功能引入未经验证的整套系统。

## 最小验证顺序（待入口确认）

1. 只查看 iPhone XR 的设置是否显示 Network Link Conditioner；没有入口则该候选不可用，不要求用户安装 Xcode 或修改手机。
2. 若入口可用，先记录可选字段、预设和原状态；再提出一组具体参数、测试时长与恢复办法供用户确认。
3. 使用当前只读身份函数做基线与注入后对照，核对同一 AppID/环境、请求数、失败与耗时；停止注入后确认恢复。不得因为一次变慢就宣称丢包注入准确，需对实际配置和请求影响分别留证。
4. 正式业务出现后仍按 QP07 各场景独立验证。iPhone 方法不自动覆盖 Android；Android 真机方法另需验证。

此文件只记录候选与验证步骤；当前没有改任何手机、云端或项目网络配置，R04 与 SP01 均未通过。回退只需撤销本文件对应提交。

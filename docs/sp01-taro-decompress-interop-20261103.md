# SP01 R01：Taro 解压依赖互操作边界

日期：2026-11-03。该记录补充 Taro CLI 远程模板依赖链的一个局部兼容性证据，不更改正式依赖或放行状态。机器数据见 [JSON](sp01-taro-decompress-interop-20261103.json)。

## 复用调查

- 项目内现有 Taro 4.3.2 隔离审计源码显示，CLI 经 download-git-repo@3.0.2 进入 download@7.1.0；其源码以 CommonJS require('decompress') 导入，并在解压处直接调用导入值。实际依赖树中的原始包是 decompress@4.2.1。
- GitHub 安全公告将 decompress@4.2.1 列为受影响且无补丁版本，并将维护分支 @xhmikosr/decompress@10.2.2 列为修复版本。候选仓库包元数据显示 MIT、ESM、Node.js >=18。来源：[安全公告](https://github.com/advisories/GHSA-hrh2-vp3x-79xf)、[download@7.1.0源码](https://raw.githubusercontent.com/kevva/download/v7.1.0/index.js)、[维护版包元数据](https://raw.githubusercontent.com/XhmikosR/decompress/v10.2.2/package.json)。
- 直接换成维护版存在模块边界差异：旧调用期望 CommonJS 函数，维护版通过 ESM 默认导出提供函数。临时适配器没有带入正式工程。

## 隔离验证

在忽略目录 .local 的独立环境用 Node.js v20.19.3、npm 11.16.0 安装 download@7.1.0，以 npm override 将它实际解析到 @xhmikosr/decompress@10.2.2；通过 npm ls 核对依赖图后运行本地测试脚本。

- **直接CommonJS调用失败**：TypeError: decompress is not a function；没有创建输出目录。
- **合成ZIP解压通过**：只在本地 HTTP 回环服务提供一个包含单个合成文本文件的 benign ZIP；测试专用模块加载适配器返回维护版的 default 导出，提取文本与预期一致，共38字符。
- **完整Taro远程模板链尚未实测**：也未执行恶意压缩包/漏洞利用测试。未请求外部测试端点，未修改正式依赖、manifest、锁文件、云资源或产品代码。首次本地夹具没有覆盖 download 的嵌套依赖，故不计证据；最终 -r2 环境通过 npm ls 确认依赖覆盖后才运行上述测试。

复用结论：维护版是适用的安全候选，但不能直接替换旧导入而不处理 CJS/ESM 互操作；临时 default 适配仅证明这一份良性 ZIP 路径可运行，未验证完整 CLI 接入、回滚、恶意归档安全或正式产品依赖。故没有改锁或采纳，R01继续pending。

## 状态与下一步

R01、SP01仍未通过，SP07未开始。下一步先沿已安装的 Taro CLI 源码确认 download-git-repo 的真实调用路径，再决定是否需要独立隔离的集成复验；不把测试专用 default 导出适配带入正式依赖。安全审计、正式产品模块可达性及第三方声明诊断仍未闭环。

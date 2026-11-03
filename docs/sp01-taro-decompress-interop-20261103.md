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
- **Taro CLI 模板调用路径已核实，范围有限**：安装版 CLI 源码显示 `init` 命令进入 `Project.create()`，模板抓取经 `Project.fetchTemplates()` 调用 `dist/create/fetchTemplate.js`。GitHub 默认模板被归类为 `git` 且 `clone=false`，会走 `download-git-repo@3.0.2 → download@7.1.0 → decompress@4.2.1`；Gitee 默认源匹配 `gitee` 并设置 `clone=true`，`download-git-repo` 改用 `git-clone`，跳过解压链。
- **本机回环集成调用已安装 CLI 的模板抓取函数**：通过 `fetchTemplate()` 和仅监听 `127.0.0.1` 的短时 HTTP 夹具处理179字节合成ZIP，模板内容核对成功，目标位于隔离临时目录，运行后临时目录已清理；没有外网请求、云调用、数据库/存储写入。该结果证实一份良性归档可穿过已安装函数链，不等同于完整交互式 `taro init` 或真实远程 GitHub 模板验收。
- **本机 Git 克隆集成验证 Gitee `clone=true` 分支**：用隔离临时目录中的本地合成 Git 仓库调用同一 `fetchTemplate()` 函数，克隆分支成功，文件内容匹配，输出不保留 `.git`，解压函数调用数为0，临时目录已确认清理。此证据验证 `clone=true` 的本地实现路径，不是实际访问 Gitee，也不证明远程网络/认证可用。
- **实际 Gitee 远程模板抓取复验**：调用安装版 Taro 4.3.2 CLI 的实际 `fetchTemplate()`，从 `https://gitee.com/o2team/taro-project-templates` 的 `v4.0`、提交 `c4cd3830794aa4e053d1c20e991d125f586cd1d9` 执行 `clone=true`。源和抓取结果的15个顶层模板目录、535 个文件逐项匹配，0项差异；输出没有 `.git` 元数据，解压函数调用0次，Taro临时目录已清理。仓库未找到根许可证文件，许可证未知，因此没有采用模板。此项验证真实 Gitee 抓取函数路径，不等于完整交互式 `taro init`、GitHub下载路径或恶意归档安全验证。
- **未执行完整交互式 taro init 或恶意归档测试**，也未请求真实远程 GitHub 模板。未修改正式依赖、manifest、锁文件、云资源或产品代码。首次本地夹具没有覆盖 download 的嵌套依赖，故不计证据；最终 `-r2` 环境通过 `npm ls` 确认依赖覆盖后才运行互操作测试。

复用结论：维护版是适用的安全候选，但不能直接替换旧导入而不处理 CJS/ESM 互操作；临时 default 适配仅证明这一份良性 ZIP 路径可运行，未验证完整 CLI 接入、回滚、恶意归档安全或正式产品依赖。故没有改锁或采纳，R01继续pending。

## 状态与下一步

R01、SP01仍未通过，SP07未开始。当前已确认该风险位于 Taro CLI 模板初始化的开发时路径：GitHub归档抓取可到达受影响解压依赖；实际Gitee `clone=true` 抓取已通过15个目录、535个文件逐项比对，零差异且没有解压调用。Gitee仓库许可证未知，因此未采用模板。完整交互式 `taro init`、GitHub远程抓取、恶意归档安全验证、当前安全审计处置、正式产品模块可达性及第三方声明诊断仍未完成；不把测试专用 default 导出适配带入正式依赖。

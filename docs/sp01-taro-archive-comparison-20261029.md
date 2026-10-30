# SP01 压缩与下载依赖的范围核对

2026-10-30范围调整（用户确认）：停止漏洞复现，只保留公告/源码核查和正常功能兼容测试。当前`verify-archive-compatibility.cjs`已移除异常ZIP构造与复现路径；历史脚本仅保存在.local/archive-compatibility-historical-20261029.cjs，不再执行。下文异常样例结果是2026-10-29已完成的历史取证，不是当前脚本覆盖范围，不能用后续普通测试替代它。未解决审计风险继续保留。

## 结论与方案

新增独立`archive-fix`候选，在现有peer-fix之上只将adm-zip0.5.18替换成0.6.1。真实构建、依赖树、应用类型检查及本次ZIP回归均通过；审计从38降到37个受影响包条目。该版本超出Taro声明的`^0.5.12`，因此保留为比较候选，**没有冻结正式依赖或宣称官方兼容保证**。peer-fix目录、锁文件及38项历史记录未改。

直接保留旧版：无需适配，但已证实没有本次输出大小保护。局部替换：无新增依赖、无第三方源码修改，Taro使用的接口未变，回退只需取消候选override。自行维护解压器或更换整个Taro：当前成本明显更高，尚无必要。本轮采用上游修复版进行比较验证，不自行重写解压实现。

读取了npm包元数据、MIT许可证、`adm-zip.js`、`zipEntry.js`、`methods/inflater.js`以及Taro实际调用源码。[上游0.6.1发布说明](https://github.com/cthackers/adm-zip/releases/tag/v0.6.1)包含输出限制、符号链接、重复条目及异步错误修复；包要求Node>=14，本机验证用20.19.3。发布活动只能证明有维护更新，不等于全部风险已验证。

## 实测及限制

`verify-archive-compatibility.cjs`使用旧版实际库生成小ZIP，修复版读取同一格式。正常场景覆盖与Taro完全相同的`new AdmZip(zipPath).extractAllTo(target, true)`、目录、中文文件名、空文件、覆盖开关。

回归场景把512字节压缩内容的本地与中央目录未压缩长度改为0。旧版未在解压阶段限制输出，随后报CRC错误，脚本以`ZERO_SIZE_GUARD_MISSING`失败；修复版在解压时返回`ERR_BUFFER_TOO_LARGE`，脚本成功。这验证的是[零长度绕过输出限制](https://github.com/advisories/GHSA-rcw4-f5rp-g42v)模式，未运行多GB样例、未测每一条公告，也不代表所有解压安全项独立验收完成。

调用（仓库根目录）：

```powershell
& .local/node-v20.19.3-win-x64/node.exe tools/sp01-taro-probe/verify-archive-compatibility.cjs .local/sp01-taro-probe-archive-fix/node_modules/adm-zip .local/sp01-taro-probe-peer-fix/node_modules/adm-zip .local
```

合成文件只写入`.local/archive-compat-*`，保留作证据，没有删除后重新下载。历史实际结果在`.local/taro-archive-api-proof.json`；当前脚本只运行正常兼容用例，新结果单独保留于`.local/taro-archive-normal-proof-20261030.json`。

无锁首次安装触发npm10.8.2内部异常`edgesOut`，原因未知，没有写成依赖冲突或修复成功。随后将上一候选锁文件复制至新目录再安装成功；锁版本差异只有adm-zip，无新增/移除包。未用force、legacy-peer-deps或依赖安装脚本。原错误日志仍保留，**从零无锁解析问题尚未解决**。准备命令为`node tools/sp01-taro-probe/prepare.cjs archive-fix`，复现实验安装需沿用上一候选锁再更新，不能把它描述成无锁初始化已通过。

官方registry审计仍exit1：21 moderate、12 high、4 critical，共37包条目。Taro/React/Webpack版本未改变；微信目标17文件、306822字节，未做开发者工具/真机验收。第三方声明全检仍保留历史失败；应用strict策略与此前批准一致。

## 已定位的下载链

Taro `dist/create/fetchTemplate.js`对URL模板用Axios下载后调用AdmZip；Git模板使用download-git-repo，再进入download/decompress或git-clone。上一轮实际普通微信构建的V8覆盖记录中，`fetchTemplate`、AdmZip构造导出、仓库download、decompress导出、git-clone导出均有记录且调用次数为0；它们的模块顶层加载次数为1。这解释了“模块被加载”与“解压/克隆发生”的区别，仅限本次构建，不能扩大到init、create、watch或外部输入。

[decompress公告](https://github.com/advisories/GHSA-mp2f-45pm-3cg9)和[git-clone公告](https://github.com/advisories/GHSA-8jmw-wjr8-2x66)均未给当前旧包系列提供修复版本。不能靠升级adm-zip关闭另一条Git模板链，也不能把管理员成功、构建成功或未观察到调用当作全局安全。下一步应对远程模板能力的移除、替代或使用限制作具体比较，而不是盲目升级got主版本或伪报37项全部修复。

本次全部为本地隔离实验，未运行远程模板命令、未启动开发服务器、未部署、未改业务功能。对应提交可独立回退；SP01状态未改。

# SP01 Taro依赖修复与构建取证

本次仅更新隔离peer-fix候选，不建立SP07、不改用户QuickStart、不部署云端。历史40项审计和失败的完整声明检查保留在原记录中。

## 复用与补丁

复用现有candidate-manifest/prepare与官方glob实现，没有另写文件匹配器。读取glob10.5.0包元数据、ISC许可及实际CLI代码；默认shell为false，显式危险shell选项仍存在。[上游公告](https://github.com/advisories/GHSA-5j98-mcp5-4vw2)列明10.5.0修复CLI命令注入。Taro plugin-doctor固定依赖10.2.6，因此添加范围限定override：`glob@>=10.2.0 <10.5.0 → 10.5.0`，不跨到11/12，也不修改其它glob大版本或第三方源码。

实际安装提示10.5.0已弃用、旧系列停止常规支持。该补丁只处理指定公告；不能据此确认长期维护、消除其它依赖风险或冻结正式版本。相比升级整个Taro/webpack或维护fork，本次接入成本低且可独立回退。

## 实际验证

- Node20.19.3；安装未用force、legacy-peer-deps或执行依赖安装脚本。依赖树检查exit0。
- 从plugin-doctor实际解析到glob10.5.0，`glob.sync('*.ts')`正确匹配候选config/index.ts。
- 应用strict检查与自有声明清单检查exit0；当前自有声明0份。第三方完整声明检查仍为已记录失败，没有宣称修复。
- 微信目标构建exit0；产物检查17份、306822字节。没有真机或开发者工具编译验收。
- 官方npm审计从40降到38个**受影响包条目**，其中high从15降到13；不是修复两个独立漏洞。消失的条目为glob及受其传播影响的plugin-doctor。剩余21 moderate、13 high、4 critical仍未关闭。
- 候选实验锁SHA256：`24ac8ed283a8c03af1c37bbc792b1eb18ea379b83e508787e8e83b3c70b068d6`。改前锁与清单保存在.local/taro-security-peer-before.*，没有删掉重装。

## 产物证据边界

通过[Webpack公开Stats API](https://webpack.js.org/api/stats/)增加可选诊断插件，只有`SP01_CAPTURE_STATS=1`启用，不引入依赖，不记录模块源文，输出位于构建目录的build-evidence而非dist。使用完整模块选项避免默认折叠隐藏条目。真实构建记录189个含名称的模块条目、7个chunk、0错误、0被折叠子项；原始JSON保留于`.local/sp01-taro-probe-peer-fix/build-evidence/webpack-stats.json`。

模块标识可能包含loader路径、orphan模块及构建元数据，不能把路径出现直接等同于代码已进入客户端；缺席也不能证明其它页面、H5、watch、解压下载或未来正式工程安全。不把剩余38条直接标成“不适用”。下一步需要结合构建主机执行路径及具体公告逐项评估，跨主版本修复先提供兼容性比较。

另用Node公开`NODE_V8_COVERAGE`对一次真实build取证，构建exit0，生成10份本地coverage文件（`.local/taro-security-build-coverage`）。adm-zip、download、decompress、got、webpack、esbuild等包均观察到脚本执行；顶层初始化也计入执行，不能据此声称漏洞函数被触发。该诊断有额外开销，不作为性能测量；未采集调用参数、身份或凭据。下一步定位具体危险函数及输入来源，当前没有取得可以关闭剩余安全项的结论。

复现：先prepare peer-fix，在其.local运行目录用Node20的npm安装并运行typecheck/build:weapp；加`SP01_CAPTURE_STATS=1`可收集统计。关闭该环境变量即不采集；候选改动可通过对应Git提交回退。基线、用户目录和历史证据均保留。SP01及产品验收仍未通过。

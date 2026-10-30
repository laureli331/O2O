# SP01 React网页编译候选

2026-10-30当前配置统一React/DOM/类型18.3.1、TS5.9.3。默认目录改为.local/sp01-web-react18-probe，replay为.local/sp01-web-react18-replay；下方React19路径/证据仅为历史，见[当前方案](../../docs/unified-react18-shared-core-20261030.md)。

这是单个合成入口的独立编译检查，不是SP07正式后台。见[复用与实测记录](../../docs/sp01-web-react-evidence-20261030.md)。没有业务、云连接、支付或正式页面设计；未启动开发服务器。

后续已用限于本机的静态preview完成[Chrome普通运行检查](../../docs/sp01-web-browser-evidence-20261030.md)，随后关闭服务。它不启动HMR开发服务器，也不代表正式页面、视觉或性能通过。browser-smoke.cjs复用已有Vite/Playwright公开API，所需工具路径按实际安装传入。

在仓库根目录执行`node tools/sp01-web-react-probe/prepare.cjs`，在`.local/sp01-web-react-probe`安装并构建。`prepare.cjs replay`准备另一个运行目录`.local/sp01-web-react-replay`，使用已提交的**实验锁**重放，不覆盖Taro、用户QuickStart或已有预览。

实际使用Node20.19.3配合本机npm11.16.0。Node自带npm10.8.2无锁安装曾触发内部错误，保留失败记录。普通命令：`npm ci --ignore-scripts --prefer-offline --no-audit --no-fund`、`npm run build`。如果PATH选择了旧npm，需显式以Node20运行本机`C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js`；不要据此修改全局npm。

`typecheck:negative`故意提交错误按钮属性，本次预期exit1和TS2322；不是常规build的一部分。正常检查strict:true、skipLibCheck:false，包含配置与源码。Vite自身只转译，build在前置类型检查成功后才继续。

依赖版本及实验锁是可复核候选，不是正式工程的采用确认。React19仅用于本网页候选；Taro候选仍为React18，没有修改。现有产物与回放哈希相同不代表所有环境下必然一致，更不代表浏览器、视觉、安全或性能验收通过。

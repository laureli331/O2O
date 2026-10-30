# SP01 React网页工具链实测

已确认React技术方向，本轮补齐此前未做的网页编译组合验证。独立候选在tools/sp01-web-react-probe，运行及回放目录在.local；没有创建SP07后台、正式业务组件或启动服务。准确版本和结果见[JSON](sp01-web-react-evidence-20261030.json)。

## 复用调查及适配

项目已有Taro和原生TS探针，不能证明网页构建；复用其“受控源文件＋隔离运行目录＋独立失败记录”的方式。网页代码采用官方create-vite9.3.3的React TypeScript模板入口和配置，不引入管理后台整套系统。读取了模板package.json、tsconfig、vite.config、main.tsx、MIT许可证，以及官方React插件6.1.2的实际默认JSX转换实现、依赖/可选peer声明。

主要沿用模板当前精确版本：React/DOM19.3.1、Vite8.3.5、React插件6.1.2、TS7.0.2。Node类型选择20.19.43匹配本次工具运行环境，保留React/DOM类型19.3.0。省去演示资产、计数器、样式和lint工具，只显示固定合成文字；增加严格检查和实验构建清单，不额外实现构建器、路由、状态或管理组件。完整MIT模板声明保留在工具目录。

来源：[Vite入门](https://vite.dev/guide/)、[Vite类型检查边界](https://vite.dev/guide/features.html#typescript)、[React createRoot](https://react.dev/reference/react-dom/client/createRoot)、[官方模板仓库](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts)。实际模板来源是校验完整性的npm归档，非仅根据README或截图判断。上游模板和插件仍有发布更新，不把活跃度当质量证明。直接复用最小模板比引入整套后台或自写工具链接入成本低；没有不可替换的额外业务依赖。

## 输入、预期、实际

| 检查 | 输入与预期 | 实际 |
| --- | --- | --- |
| 首次安装 | Node20.19.3、npm10.8.2，无锁解析应成功 | npm内部edgesOut异常，exit1；随后build与负例因缺编译器而失败，均不记通过 |
| 工具对照 | 同Node、同清单，使用已安装npm11.16.0 | 安装exit0；npm官方engines包含^20.17.0，没有改变全局安装 |
| 正常编译 | 有效TSX和配置，完整strict且skipLibCheck:false | build/typecheck exit0 |
| 类型错误 | button disabled传字符串，应非零并给TS2322 | exit1、TS2322；与缺编译器失败分开保存 |
| 依赖树及审计 | 正常npm检查 | tree exit0；官方registry audit exit0、当前0受影响包条目；不是全部安全保证 |
| 锁重放 | 新独立目录、npm11执行ci及build | 两项exit0，3份产物SHA256与首次一致；共219947字节 |
| React Doctor | 静态检查，关闭遥测/评分，不安装到产品依赖 | 首次因.local被忽略扫描0文件，不采用结论；显式src/main.tsx后扫描1文件，exit0、0发现 |

普通构建只证明这份最小入口。未实际浏览器加载、未测试HMR/开发服务器、未测后台表单/弹层/列表，也未作性能测量。Vite默认浏览器目标不自动成为本项目支持范围；Web预算与Chrome支持范围按原计划另确认。没有通过更换模型、隐藏用途或重试受拦截的漏洞操作来推进。

## 另一项新证据：Taro无锁解析

同Node20.19.3下，npm11.16.0为archive-fix清单从零执行package-lock-only成功；独立目录为.local/taro-archive-resolve-npm11。新图与原实验锁存在Babel补丁及依赖提升差异，不能宣称已复现旧图，更不能说已完成新图全量安装构建。npm10失败根因仍没有确诊；本轮只证实另一个支持的包管理器能够解析，没有伪报npm内部问题已修复。

## 当前交付与回退

实验锁随探针提交，便于复核，不代表用户已经冻结正式版本。Taro的React18组合保持，网页候选独立React19；是否统一版本须按实际跨端共享需求及兼容成本审阅，不能强行混用。现有Taro审计37条及完整声明诊断仍单独保留。

来源、版本、隔离、回退与实测方案是SP01准备交付；最终产品测试应在对应任务执行，不反向要求SP01先有正式页面性能结果。SP01整卡未标通过，未绕过SP01—SP06前置。所有改动可通过本轮Git提交回退，本地历史、用户QuickStart和视觉资源未删除。

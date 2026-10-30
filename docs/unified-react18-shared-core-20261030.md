# 单一React18与共享业务核心方案

依据2026-10-30用户强约束：维护成本优先，React19不再用于现行配置；双端React/DOM/类型精确18.3.1，TypeScript统一5.9.3，业务只保留一份，UI分开。历史实验保留，不据历史成功宣称新配置已验收。

## 正式工程规划目录

以下是SP07前置满足后采用的目录；本轮未创建正式目录，不移动用户QuickStart。

```text
E:/O2O/
├─ apps/
│  ├─ web/
│  │  ├─ src/pages/              # Web布局、展示与事件绑定
│  │  ├─ src/components/
│  │  ├─ src/bootstrap.tsx       # 注入Web适配器
│  │  ├─ vite.config.ts
│  │  └─ package.json
│  ├─ miniapp/
│  │  ├─ src/pages/              # Taro布局、展示与事件绑定
│  │  ├─ src/components/
│  │  ├─ src/app.tsx             # 注入微信适配器/生命周期桥接
│  │  ├─ config/index.ts
│  │  └─ package.json
│  └─ cloud-functions/           # 可信身份、数据库和事务入口
├─ packages/
│  ├─ shared/
│  │  ├─ src/contracts/          # 全部自有Interface/DTO/事件与结果类型
│  │  ├─ src/domain/             # 金额、计佣、状态和时间等纯规则
│  │  ├─ src/application/        # 用例、权限策略、版本与幂等流程
│  │  ├─ src/api/                # 请求编排、错误、重试/未知结果查询
│  │  ├─ src/state/              # 唯一状态与actions；每会话独立实例
│  │  ├─ src/ports/              # 环境能力契约，从contracts导出
│  │  ├─ src/react/              # 双端相同Hooks/Context/view-model
│  │  ├─ tsconfig.core.json
│  │  ├─ tsconfig.react.json
│  │  └─ package.json
│  └─ platform-adapters/
│     ├─ src/web/                # 浏览器底层I/O
│     ├─ src/weapp/              # 微信/Taro底层I/O
│     └─ src/cloud/              # 数据库/服务端时钟等实现
├─ tests/
│  ├─ shared/                    # 业务/状态/请求流程只写一套
│  ├─ adapters/                  # 两端实现跑同一能力契约
│  └─ integration/               # 两端UI及云端接入验收
├─ scripts/                     # 版本、禁止any、平台API与依赖方向检查
├─ tsconfig.base.json
├─ package.json                 # npm workspaces，不加monorepo框架
└─ package-lock.json            # 正式工程统一根锁
```

## 不可越过的分层

shared必须包含100%的自有业务规则、客户端用例、状态、业务Hooks、请求封装与Interface定义。UI只读view-model、绑定shared动作，不放表单业务校验、计价、状态迁移、权限条件或通知判断；提取原始输入值、布局、视觉反馈属于UI。

平台适配包没有业务规则，只实现传输、存储、时钟、导航等I/O。shared通过接口/参数取得实现，不调用window/document/DOM/wx，不判断“当前微信还是Web”，不反向导入apps或适配包。API业务封装在shared，底层HTTP/云调用机制在适配器；这不是复制两份API业务逻辑。

云端只导入shared/domain和shared/contracts等纯模块，不导入客户端React入口；从可信身份、服务器时间和数据库版本取得事实后执行同一规则。权限、金额、状态、事务仍由服务端实际执行，不能信任客户端计算。客户端store按会话创建，云端禁止跨请求共享用户状态。

状态优先调查Zustand vanilla与React绑定；接入前仍须完成源码/许可和普通状态隔离、两端订阅测试，本轮未引入生产状态依赖。无论采用哪一实现，都只能在shared中存在一套，不自写第二套平台状态框架。

## 两端package.json共同字段

```json
{
  "dependencies": {
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "@types/react": "18.3.1",
    "@types/react-dom": "18.3.1",
    "typescript": "5.9.3",
    "@types/node": "20.19.43",
    "postcss": "8.5.32"
  }
}
```

当前两端隔离探针已实施上述统一；Taro的PostCSS8.5.32由unified18候选补丁提供。Vite8.3.5/React插件6.1.2与Taro4.3.1/Webpack5.91.0是各自平台的编译器，不硬凑同版本，也不为对齐而把Web不用的整套Taro依赖装进去。所有共同依赖必须相同，API/状态库仅在shared引入一份。

根workspaces计划为apps/*、packages/*；根devDependency固定TS5.9.3，overrides精确固定[版本策略](frontend-version-policy-20261030.json)中的共同包。apps直接声明同一精确版本，不用^/~/*；shared的React peer精确18.3.1，内部包使用与本地workspace匹配的0.0.0。根锁提交，CI使用npm ci并检查各包声明及完整锁图，不能靠override掩盖声明不一致；打包器去重React，检查shared与两端实际解析路径。

基础TS配置强制strict:true/noImplicitAny:true。shared/core只用ECMAScript lib、types:[]，React绑定单独入口检查。strict不禁止显式any，因此必须同时加no-explicit-any及AST边界检查：拒绝any/as any、抑制指令绕过、shared中的DOM/wx/globalThis对应访问及反向导入；别名/动态导入也须检查，不只字符串搜索。自有Interface从shared导出；第三方SDK声明引用不等于复制业务类型。AGENTS.md已加入该约束。

Taro此前批准的第三方声明诊断分列仍保留，自有代码和自有声明不放宽。没有实际shared产品代码，不能宣称100%共享/无any/依赖隔离已经产品验收。

## 本轮实测、实施顺序与回退

新目录.local/sp01-web-react18-probe及.local/sp01-taro-probe-unified18安装成功。Web完整strict构建、Taro批准的应用/自有声明组合检查和微信构建通过；两份实际锁图的React/DOM/类型均为18.3.1，TS均5.9.3。Web实验锁已更新；历史React19/旧Taro目录和Git证据不覆盖。

React18网页又单独执行Chrome加载/双视口刷新检查，通过并关闭测试浏览器/本机服务；静态检查扫描1个实际入口文件通过。结果见[本轮验证记录](unified-react18-validation-20261030.json)。Taro实验锁也已提交在variants/unified18.package-lock.json，版本测试同时检查两个完整锁图，拒绝React/DOM/类型或TS漂移。

统一版本不代表原Taro审计项已修复，不借用React19浏览器结果作为React18证据。正式工程仍等待SP01—SP06；SP07先建立workspaces、根锁和边界检查，各业务卡先在shared写规则和测试，再接UI/适配器并验服务端与平台行为。不得以临时复制业务分支完成双端接入。

本轮只改方案/隔离探针，可通过对应Git提交回退；回退不构成恢复React19方向的授权。用户QuickStart、云端和视觉资源未改。

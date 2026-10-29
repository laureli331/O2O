# SP01 Taro兼容问题的受控对照

最新确认：用户在收到拆分策略建议及准确性代价说明后回复“ok”，确认采用。已在隔离探针实现独立检查命令；自有TS/TSX保持strict，自有声明全检，第三方声明失败独立留痕。下文原“待确认”描述保留为对照过程，由本段覆盖；不代表安全项或SP01放行。

执行命令：typecheck:app使用tsconfig.app.json（strict:true、skipLibCheck:true）；typecheck:own-declarations扫描src/config/types下自有.d.ts/.d.mts/.d.cts，用strict:true、skipLibCheck:false且不默认注入第三方types单独检查；typecheck:vendor保留原tsconfig.json全检。组合typecheck要求前两项成功，第三方诊断不改记通过。自有声明若显式引用问题第三方类型，检查仍可能失败，不能自动排除或压制。

Node20.19.3实际复验：应用检查退出0；错误组件属性、错误API参数各退出2且出现TS2322；第三方全检仍退出2、1077行诊断。当前探针无自有声明，库存清点明确报告0且未执行声明编译；另用真实编译器验证自有声明正例退出0、未定义类型负例退出2/TS2304，证明该命令不会随应用配置跳过自有声明。没有真实设备或安全通过声明。

已实际执行运行目录中登记的npm run typecheck，在Node20.19.3下退出0；它组合执行应用与自有声明检查。仓库计划44/44、回归1522/1522通过；第三方声明及安全未通过与这些结果分别留痕，不混为全项通过。

2026-10-29。基线[失败记录](sp01-taro-reuse-review-20261029.md)保留不变；本轮仅在独立的.local/sp01-taro-probe-peer-fix验证修复候选。[结构化结果](sp01-taro-compatibility-20261029.json)。Taro已获用户确认，但精确依赖组合没有冻结，未启动SP07。

## 已解决：peer冲突

实际依赖树显示schema-utils4.8.1要求Webpack^5.112.0，而Taro4.3.1的runner及模板固定5.91.0。没有把Webpack硬升到不符合Taro声明的版本，也没有force/legacy-peer-deps。

已下载并阅读schema-utils4.3.3的package.json与dist/index.js，核对MIT许可、引擎和validate/ValidationError等导出。它处于copy-webpack-plugin等父包的^4.2.0依赖范围中，且不添加Webpack peer。仅将schema-utils的4系列锁到4.3.3，2系列保持原样。保留原基线目录、原锁文件与tar包。

另将Babel core/runtime和PostCSS升到各自同主版本已发布补丁7.29.7/7.29.10/8.5.32；npm核对Node要求和MIT许可，官方审计相应直接包条目消失。来源包括[Babel core公告](https://github.com/advisories/GHSA-4x5r-pxfx-6jf8)、[Babel runtime公告](https://github.com/advisories/GHSA-968p-4wvh-cqc8)及[PostCSS公告](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp)；未自动执行audit fix --force建议的Taro跨主版本降级。

实际结果：依赖树退出0；Node20.19.3微信目标构建退出0；17个产物合计306822字节，固定页面和WXML静态引用检查通过。它证明本轮peer修复可用，不表示Taro所有能力通过。

## 类型检查：已确定来源，策略需要确认

完整strict:true、skipLibCheck:false检查仍退出2，1077行诊断。归类到@tarojs/components、@tarojs/taro、helper/runtime及webpack-chain的声明；主要包括大量数字成员隐式any和缺失名称/导入。源码已经实际阅读，不能把这些诊断笼统归为项目页面错误，也不意味着1077个产品运行漏洞。

在**不修改原tsconfig**的情况下做了另一条命令的对照：使用skipLibCheck:true只作为实验参数，正确源码检查退出0；分别加入错误Button disabled字符串和request url数值，均退出2并准确出现TS2322。两条负例证实仍检查调用处使用的类型，但不能证明所有API类型都正确。

TypeScript[官方说明](https://www.typescriptlang.org/tsconfig/skipLibCheck.html)明确：此选项跳过声明文件检查，仍检查源码所引用的类型，但会牺牲部分类型系统准确性，也可能跳过自有.d.ts内部检查。不能说它没有代价，不能偷偷启用并把完整声明检查改记通过。

| 策略 | 收益 | 成本/限制 | 状态 |
| --- | --- | --- | --- |
| 项目TS/TSX保持strict；声明全检继续作为独立、如实标失败的诊断 | 避免为未使用的平台声明维护大批补丁；调用处、组件与API参数仍有类型检查，可配合行为/契约测试 | 部分声明内部一致性错误可能被应用检查忽略；如有自有.d.ts须另定检查；不能宣称上游声明已修复 | 建议，待用户确认；不自动批准未解决安全项或产品放行 |
| 继续要求整个第三方声明树在strict下全绿 | 第三方声明内部一致性也纳入阻断 | 需追上游修复或维护声明补丁，覆盖未使用平台/API；增加升级、复验与回退成本，不能只批量加any | 当前全检仍失败；未改标准 |

这属于检查范围的关键选择，需要用户确认；不是重复询问是否采用Taro。未确认前，原配置和完整失败结果保持。

## 安全项未解决，仍需分项判断

官方registry复查从42降到40个受影响包条目，不是40个独立漏洞；低0/中21/高15/严重4。Babel两个直接条目及直接PostCSS条目已不在结果中，miniprogram-simulate内嵌旧PostCSS仍在。其余含开发工具链、H5相关包及传递关系，需要按实际使用/构建/发布路径判断；未逐项证明前不写成已修复或不适用。

以上修复没有把审核、权限、并发、金额、计时、异常恢复或性能验收删减。候选仍未接受、版本未冻结、SP01不通过；真实平台/真机结果未执行。普通补丁对照可继续本地做，涉及关键依赖范围、架构或检查范围的变更按用户新增原则先确认。

## 复现与回退

`node tools/sp01-taro-probe/prepare.cjs peer-fix`准备独立目录；安装依赖后运行实际Taro CLI build --type weapp、npm ls --all。`node tools/sp01-taro-probe/check-type-policy.cjs`在所调用Node版本下运行完整/源码限定/两个负例的对照，只写.local输出，不改原配置。应使用已验证Node20.19.3执行，未调用云服务。

版本补丁位于variants/peer-fix.json；若回退仅移除该候选的使用，不修改原基线或删下载文件。最终若采用某组合再提交完整锁文件及对应验证；目前保留实验锁及原始输出在.local。

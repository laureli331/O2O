# SP01 Taro官方模板适配实验

这是独立工具链候选检查，不是SP07工程、产品页面或已验收模板。[复用调查与失败记录](../../docs/sp01-taro-reuse-review-20261029.md)说明来源、许可、适配成本与边界。

当前：Taro4.3.1＋React18.3.1＋Webpack5.91.0＋TypeScript5.9.3的微信目标构建成功；完整类型检查及依赖树检查失败，依赖审计尚有待处理项。具体依赖未冻结，不能直接用于正式工程。真实平台/交互未验。

以上是baseline结果。后续独立peer-fix候选已解决依赖树冲突并保持构建成功，完整声明检查及安全项仍未完成；见[受控对照与待确认类型策略](../../docs/sp01-taro-compatibility-20261029.md)。使用 `node tools/sp01-taro-probe/prepare.cjs peer-fix`，不会覆盖baseline运行目录。原类型配置保持strict:true、skipLibCheck:false；check-type-policy.cjs中的声明跳过选项仅为诊断对照，尚未采用。

## 已实际执行的验证

在仓库根目录执行 `node tools/sp01-taro-probe/prepare.cjs`，将受控源文件复制到 `.local/sp01-taro-probe`；其中原实验锁文件与依赖保留。首次通过 `npm install --ignore-scripts --no-audit --no-fund --prefix .local/sp01-taro-probe` 安装。运行目录是 `.local/sp01-taro-probe`，构建命令为：

```powershell
& 'E:\O2O\.local\node-v20.19.3-win-x64\node.exe' 'E:\O2O\.local\sp01-taro-probe\node_modules\@tarojs\cli\bin\taro' build --type weapp
```

产物检查：`node tools/sp01-taro-probe/inspect-artifacts.cjs`。类型检查使用同一Node20调用该目录的 `node_modules/typescript/bin/tsc --noEmit --project tsconfig.json`，当前失败，不能改成成功描述。

已用运行目录内保留的实验锁文件执行 `npm ci --ignore-scripts --no-audit --no-fund --prefix .local/sp01-taro-probe` 并在Node20.19.3重建成功。此锁文件仍保留于.local，候选未就绪前不把它冒充正式工程依赖锁定。

根目录测试 `node --test tests/sp01-taro-artifacts.test.cjs` 仅验证产物判定逻辑，不依赖机器已安装Taro，也不冒充真实构建。静态导入检查只支持本次产物形式，动态引用无法判断时失败。源码中的固定字符串是合成检查内容，无云调用、真实身份、业务或收费。

复用的模板许可与原作者声明见THIRD-PARTY-NOTICES.md。不要手改dist作为永久修复，不修改node_modules来伪造通过，不覆盖用户miniprogram或现有预览。

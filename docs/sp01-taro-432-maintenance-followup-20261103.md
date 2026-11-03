# SP01 R01：Taro 4.3.2 局部维护候选复核

日期：2026-11-03
范围：仅隔离候选对照；没有修改正式工程、QuickStart、云端函数、存储或手机设置。

## 复用与来源核查

- 项目内：复用 tools/sp01-taro-432-audit 已存在的 Taro 合成样例、构建配置、strict 类型检查脚本和 ZIP 兼容检查；复制到 .local 新目录做候选，不覆盖原隔离树。
- 官方平台：候选仍使用已确认的 Taro 4.3.2 / React 18.3.1 / TypeScript 5.9.3 / Webpack 5.91.0 方向；Webpack 维持 Taro runner 声明的精确 peer。未引入新平台接口或新第三方库。
- 传递依赖局部适配：把现有传递依赖锁为 adm-zip 0.6.1、serialize-javascript 7.1.4、schema-utils 4.3.3、glob 10.5.0。官方 npm registry 元数据显示许可证分别为 MIT、BSD-3-Clause、MIT、ISC；对应包更新时间为 2026-09-11、2026-10-23、2026-10-31、2026-10-28。npm registry 明确将 glob 10.5.0 标记为 deprecated，并称旧版本存在已在当前版本修复的公开安全问题；因此这个版本只能作为隔离对照，不能作为已接受的长期维护方案。
- 许可和元数据原始查询来源：https://registry.npmjs.org/adm-zip/0.6.1、https://registry.npmjs.org/serialize-javascript/7.1.4、https://registry.npmjs.org/schema-utils/4.3.3、https://registry.npmjs.org/glob/10.5.0。代码仓库与许可证字段也保存在配套 JSON。
- 成本与回退：候选只影响一个可删除的本地 .local 副本；干净安装耗时约 33 秒，构建约 5 秒，另有 1056 条第三方声明诊断及仍未消失的审计项目。保留候选用于对照，不冻结正式锁、不接受这些剩余风险。

## 发现与改动

首次只加 adm-zip、serialize-javascript 两项覆盖时，npm install --package-lock-only --strict-peer-deps 被 schema-utils 4.8.2 的可选 peer webpack ^5.112.0 与已确认的精确 webpack 5.91.0 冲突阻止。加入 schema-utils 4.3.3 后，在严格 peer 条件下可解析并干净安装；它也通过了隔离微信目标构建。这里验证的是所选依赖组合可安装、可构建，不代表升级风险已消除。

glob 10.5.0 仅为复现先前审查过的局部候选而保留在实验中；官方 registry 对它的弃用与安全提示使其不适合作为新的长期固定版本。

候选 manifest 和锁文件与未加覆盖的 4.3.2 基线快照、审计原始报告均保存在 tools/sp01-taro-432-audit/maintenance-followup-20261103/。锁文件 18 个包记录发生变化；完整包路径差异由专项测试从两份锁文件计算，避免手工抄写。

## 验证记录

环境：Windows 11、本机隔离目录、Node 20.19.3、npm 10.8.2、官方 npm registry。测试输入只含仓库合成页和合成 ZIP，不含用户数据。

| 检查 | 预期 | 实际 |
| --- | --- | --- |
| npm ci --ignore-scripts --no-audit --no-fund --strict-peer-deps --registry=https://registry.npmjs.org | 严格 peer 下干净安装成功 | 退出码 0，添加 1133 个包 |
| npm ls --all --json | 无缺失、无无效依赖 | 退出码 0，JSON 不含 problems |
| npm run typecheck | 自有应用 TS/TSX strict 检查通过；自有声明清点如实报告 | 退出码 0；自有声明数量 0，未执行声明编译器 |
| npm run typecheck:vendor -- --pretty false | 第三方声明单独全检并保留失败 | 退出码 2；1056 条诊断，涉及 108 个声明文件；未隐藏或跳过 |
| npm run build:weapp | 隔离合成小程序样例构建成功 | 退出码 0，Taro 4.3.2 / Webpack 构建成功 |
| ZIP 兼容检查 | 使用 0.5.18 生成的合成 ZIP，可由 0.6.1 解压；验证中文、空文件及覆盖行为 | 通过；没有漏洞复现，输出仅在 .local 合成目录 |

全量 npm audit 按“受影响包条目”计数：无覆盖基线 54 条（低 1、中 31、高 18、严重 4）；候选 51 条（低 1、中 32、高 14、严重 4）。基线中不再出现的键有 adm-zip、copy-webpack-plugin、css-minimizer-webpack-plugin、serialize-javascript；候选新增 stylus。条目变化不等于独立公告数、可利用漏洞数或产品包风险减少。

--omit=dev 审计基线与候选均为 21 个受影响包条目（低 1、中 15、高 2、严重 3），生产依赖均为 479 个。报告不证明小程序产物中的可达性或漏洞可利用性；严重条目仍未解决。

## 结论

这是一次可复现的隔离兼容候选，不是正式依赖采纳，也不是安全风险接受。构建工具链维持已确认的 Webpack 5.91.0；没有更改用户确认的技术边界。由于 glob 10.5.0 已被 registry 标为 deprecated、生产审计无改善、全量审计仍有 4 个严重条目且第三方声明全检有 1056 条诊断，不将此候选冻结或移入正式工程。

R01 与 SP01 继续 pending，SP07 未开始。下一步要找到受维护、兼容严格 Webpack peer 的替代依赖组合，并对剩余审计包做源码/产物边界核查；若没有适用修复，应将具体风险及产品暴露证据交由 R01 的风险验收处理，不以条目减少放行。

回退：本记录和证据包可由对应 Git commit 整体回退；隔离 .local 副本与正式依赖无关联。

# 湘邻湘友小程序 UI 开发交接

首发阶段纠偏：2026-10-14用户明确尚未写代码，不存在旧机制新机制。当前规划一套首发业务规则，原PRD和此前讨论只作设计历史，不要求存量订单迁移或运行系统切换。原SO01已撤销，其余7题仍待答；不回来点完成不阻止符合条件的72小时暂定计佣和自动归档，不因此新增真实完成、收入或评价资格。详见[规划阶段说明](../module-specs/planning-stage-clarification-20261014.md)。下文按日期保留的原提案/回复不表示有运行中的旧订单。

日期：2026-10-09。范围：补齐选定视觉稿的开发资料和可复用资源；没有创建产品工程、接口、真实数据或部署。

## 先读这些文件

1. [选定图](../../assets/ui/selected-20261009/overview.png)与[用户选择记录](../../assets/ui/selected-20261009/selection.json)：本轮视觉基准，附件原样保存。
2. [业务 PRD](../prd.md)、[技术记录](../technical-decision.md)和[开发计划](../development-plan.md)：功能、权限和技术的依据。
3. [视觉规范](visual-spec.md)：单位、颜色、字号、间距、效果和资源使用。
4. [五页说明](page-spec.md)、[组件与状态](components-and-states.md)：把图转为可实现的结构。
5. [开发前差异清单](decisions-and-gaps.md)：哪些是已确认视觉表达，哪些还不能当业务规则。
6. [验收与开发顺序](implementation-checklist.md)：后续实现的验证方法和待补页面。
7. [本轮验证记录](verification.md)：实际执行结果、错误注入和未验证范围。

本轮实际业务回复见[决定补充](business-addendum.md)：维修扩展接单另议完整规则；个人收入采用已确认完成的跑腿服务费且非到账；优选为付费推广。不能再按“用户未回复”处理这三项，也不能把扩展意图写成维修业务规则已齐备。

2026-10-10开始[逐模块规划](../module-specs/README.md)：维修确定先申请再选人、申请不强制报价；其它明确纳入业务范围，详细规则待讨论。

## 文件目录

| 文件 | 用途 | 状态 |
| --- | --- | --- |
| [design-tokens.json](../../assets/ui/development-handoff-20261009/design-tokens.json) | 机器可读视觉变量、数值来源和文字色候选 | 实施基线，需实机校准；不是从位图精确反推 |
| [theme.wxss](../../assets/ui/development-handoff-20261009/theme.wxss) | 从变量生成的可移植基础样式 | 未接入产品；不含路由、业务逻辑或接口 |
| [content.json](../../assets/ui/development-handoff-20261009/content.json) | 精确中文文案、示例/真实数据边界 | 包含差异项标记，不允许把占位文字当数据 |
| [coverage.json](../../assets/ui/development-handoff-20261009/coverage.json) | V01—V21 覆盖和验收引用 | 五页只展示对应组的部分状态 |
| [components.json](../../assets/ui/development-handoff-20261009/components.json) | 组件编号、视觉状态及边界 | UI 设计合同，不是新 API 或数据库字段合同 |
| [decisions.json](../../assets/ui/development-handoff-20261009/decisions.json) | 待确认业务差异及实际回复记录 | 未确认项保持待确认 |
| [icons.svg](../../assets/ui/development-handoff-20261009/icons.svg)和[资源清单](../../assets/ui/development-handoff-20261009/manifest.json) | SVG 图标总览、单图标、占位资源、来源及哈希 | 重用原图标并补统一服务包形图标 |
| [生成脚本](../../scripts/prepare-ui-development-handoff.cjs) | 重现 SVG 导出、样式和资源清单 | 无网络、无安装，拒绝改动选定图 |
| [自动验证](../../tests/ui-development-handoff.test.cjs) | 链接、哈希、颜色、覆盖、资源与差异门禁 | 不代替微信真机测试 |

原六页 v2 文件及其历史采用记录完整保留。它们仍可用于追溯变量和图标，但**本轮布局以 2026-10-09 选定五页图为准**。旧文档中的三大分类图标模块、单独闲置列表图、图片覆盖条、三色绝对限制等不能重新恢复成当前视觉要求。历史文档与测试不在本轮篡改。

选定 PNG 是栅格参考，不能恢复成真实 Figma 图层。这里提供的是可编辑 SVG、变量和文字合同；没有伪称交付 Figma 源文件，也没有将手机总览裁成可用界面背景。开发必须以组件重建文字和交互，不能直接把整图贴进页面。

## 本轮验证方案

验证选定图 SHA256 不变；文档链接可达；V01—V21、字段和验收编号确实存在于 PRD；导航服务图标一致；所有 SVG 无脚本/外链；变量与样式一致；内容占位不伪造收入/区域/资格；业务差异没有被无声覆盖；文字色候选按已声明背景计算对比度。

```powershell
node scripts/prepare-ui-development-handoff.cjs
node --test tests/ui-development-handoff.test.cjs
powershell -NoProfile -File tests/validate-selected-ui-20261009.ps1
git diff --check
```

生成脚本只写本交接资源目录，原图和原 v2 资源不改动。实际测试结果、限制与 Git 提交在交付消息中报告；不会把文档通过写成产品运行通过。

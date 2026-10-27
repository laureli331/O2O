# 全部有效HTML视觉规范推广计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 将用户已验收代表页的圆角、间距、字号和操作尺寸规则推广到33个有效HTML。

**Architecture:** 继续复用ui-consistency.css。以页面清单记录产品内容根、卡片及固定操作区，给静态容器添加语义标记，支持动态生成的同类组件。保持控制器、业务模型、文案、页面路径不变。特殊容器使用明确映射，图片贴边、圆形头像、胶囊、手机外框、底栏图标不做机械替换。

**Tech Stack:** HTML、CSS、Node测试、Edge／Playwright。

**Spec:** [统一规范](../specs/2026-10-27-ui-consistency-design.md)

## Global Constraints

- 用户已批准“可以推广到全部有效HTML”，不再重复审批已确认尺寸。
- 33个有效HTML全部纳入，6个归档／跳转／试验页排除；不修改工作区其它内容。
- 卡片12px、按钮／字段8px、弹窗16px、底部抽屉顶部20px；手机16px内边距及12px卡间距，后台24／20／16px。
- 普通操作触控区44px、主操作46px；小图标保持原视觉大小，整行提供触控区域。七列日历保留自适应列宽，不因强制44px宽导致横向溢出，单元格高度44px。
- 每批保留改前快照，验证通过后提交，全部完成后统一交付。

## Review Focus

1. 瀑布流由脚本定位，字体与边距变化后仍不重叠。
2. 字段中的复选框、金额内嵌输入和开关不应获得普通文本框样式。
3. 日历、相册、图片关闭按钮、评分星级保持布局与可操作性。
4. 后台表格允许表格自身横向滚动，不允许整个页面横向溢出。
5. 抽屉、固定底部操作、弹窗确认及失败／未知状态不能因尺寸变更被遮挡。

### Task 1: 清单和基础映射

**Files:** Create docs/ui-consistency-pages-20261027.json; Modify previews/assets/ui-consistency.css及有效HTML；Test tests/ui-consistency-rollout.test.cjs。

**Interfaces:** 清单提供file/profile/page/roots/cards/edgeCards/footers；静态根使用data-ui-content标记，卡片规则匹配动态后代，外部演示控件不参与。

- [x] 保存全部HTML改前快照及控制器摘要。
- [x] 编写清单完整性、脚本摘要不变、引用版本与排除页隔离测试；运行确认新增规则前失败。
- [x] 分组映射手机内容、图文卡、表单、抽屉、后台与数据卡，所有有效页加载规范。

### Task 2: 浏览器验证与收口

**Files:** Create scripts/verify-ui-consistency-rollout.cjs; Update规范状态及交付文档、首批测试生命周期。

**Interfaces:** 输入本地预览和页面清单；输出逐页、逐状态、视口的计算样式／滚动／错误记录与截图。

- [x] 全部手机页320／375／414、后台1280／1440遍历，并检查各页评审索引涉及的动态视图。
- [x] 检查卡片／字段／按钮尺寸与例外，遇到层叠冲突修正相应映射；检查长文、滚动和遮挡。
- [x] 运行首批23组交互测试、各受影响模块既有浏览器回归及全部Node测试。
- [x] 更新交付范围、真实验证限制和回退记录，提交本批全部相关改动。

# UI一致性代表页实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 将已确认的视觉规范应用到服务页、V24、V15，完成代表页验证后交付审阅。

**Architecture:** 新增仅由三个代表页加载的ui-consistency.css，通过data-ui-profile区分mobile/admin，通过data-ui-page区分组件映射；不修改其它共享CSS，不改控制器及业务模型。变量提供尺寸，组件规则明确作用域；保留封面、胶囊、头像及手机预览外框例外。

**Tech Stack:** HTML、CSS、自带Node测试、Edge／Playwright实测。

**Spec:** [已确认规范](../specs/2026-10-27-ui-consistency-design.md)

## Global Constraints

- 卡片12px、按钮和输入框8px、弹窗16px、抽屉顶部20px。
- 手机页边距16、卡内边距16、卡间距12；后台页边距24、卡内边距20、卡间距16。
- 主按钮最小46px，触控目标至少44×44；支持文本撑高和减少动态设置。
- 本轮只调整三个代表页；不改历史归档、控制器、业务文案和已确认导航图形。
- 用户“开始下一步”已授权按具体规范实施，不再重复询问执行方式；本会话实施并验证。

## Review Focus

1. 320px窄屏下长标题／长按钮不能溢出或挤掉操作。
2. V24复选框保持原生尺寸，标签整行可点，不能误当普通输入框。
3. 服务页底部抽屉及V15原生确认弹窗不被覆盖或失去滚动。
4. 外部演示控件及未加入代表页的V25等页面不受新规范影响。
5. 减少动态设置禁用缩放，键盘焦点和危险操作确认仍有效。

### Task 1: 保存基线与添加尺寸规则

**Files:** Create previews/assets/ui-consistency.css; Modify previews/services.html、previews/v24.html、previews/v15.html; Test tests/ui-consistency-pilot.test.cjs。

**Interfaces:** Consumes规范tokens.json；Produces data-ui-profile=mobile|admin、data-ui-page=services|onboarding|operations及仅在这些body范围内生效的CSS变量。

- [x] 保存三个页面改前截图和计算样式到.superpowers/ui-consistency-pilot-20261027。
- [x] 添加测试：仅三个页面加载样式、引用摘要正确、业务脚本未变；先运行确认缺失样式时失败。
- [x] 实现按角色映射的按钮、卡片、表单、弹层和文字规则，保持尺寸例外。
- [x] 运行尺寸测试，检查所有既有Node测试，明确每个失败原因并修复。

### Task 2: 实测与交付

**Files:** Create scripts/verify-ui-consistency-pilot.cjs; Update规范tokens状态及交付记录。

**Interfaces:** Consumes本地8765预览及PREVIEW_PLAYWRIGHT_PATH；Produces截图和结构化验证证据，无真实业务操作。

- [x] 在320／375／414手机、1280／1440后台验证计算样式与页面溢出。
- [x] 验证列表进入详情、通知全部已读、V24表单与付款确认、V15材料及处理确认；失败和未知状态保留输入。
- [x] 检查长文本、弹层滚动、44px触控、按压反馈与减少动态。
- [x] 复核差异，仅提交本批文件，记录测试结果与可回退的Git提交；全量推广等待代表页审阅。

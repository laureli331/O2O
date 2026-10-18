# 第一版发现页与导航调整实施计划

日期：2026-10-18

依据：[已批准设计](../specs/2026-10-18-discover-navigation-design.md)，设计提交 `a220bd1`，指南针选择提交 `0b735f4`。

## 1. 交付目标

在不修改小程序业务源码的前提下，把已批准设计落实到当前规划文档、结构化映射、可复现 UI 交接资源、HTML 交互预览及自动化验证中：

- 第一版底栏统一为“首页 / 发现 / 发布 / 服务 / 我的”。
- 发现页只展示审核通过且当前可展示的商家图文主帖。
- 审核通过的商家可免费提交基础图文主帖；付费会员、内容加热、Banner 和其它商业化仍留在第二版。
- 原底栏消息入口取消；必要通知作为“服务”的二级入口放在服务页右上角。
- 发现使用已选 A 版线性指南针图标；服务保留手提袋；通知复用消息气泡并显示未读角标。

## 2. 实施原则与回退

- 所有项目文件使用 `apply_patch` 修改；生成资源只通过已有生成脚本产出。
- 每个逻辑阶段先修改或新增合同测试，使其针对旧状态失败，再完成同阶段实现并验证为通过；不提交已知失败状态。
- 每个逻辑阶段单独创建 Git commit，只暂存本计划列出的相关文件。
- 不暂存、不删除、不恢复当前工作区已有的 `redbook` 删除记录。
- 历史归档、旧生成提示和用户原始答复保留；通过新增当前决定和明确覆盖关系更新现状，不改写历史事实。
- 任一阶段回退使用对应提交的反向提交；不使用 `git reset --hard` 或覆盖用户工作区。

## 3. 任务一：建立当前决定与回归合同

### 3.1 先改测试

修改：

- `tests/v2-roadmap.test.cjs`
- `tests/content-heating-deferral.test.cjs`
- `tests/discover-navigation-design.test.cjs`

新增：

- `tests/discovery-first-release.test.cjs`

合同要求：

- 保留 `featurePlanning.merchantSquareRelease = "v2"` 作为 2026-10-15 历史记录，不原地篡改。
- 新增当前覆盖决定 `discoveryFirstReleaseDecision`，明确基础发现与基础商家发帖进入第一版。
- 内容加热仍为“观察真实发帖数据后，第二版酌情评估”，不得随发现页一起提前。
- 商家基础发帖不绑定会员、加热或收费；真实销售、支付、推广、审核和通知执行均保持关闭。
- 客户动作仅为查看详情、收藏、微信分享；评论、点赞、关注、视频和推荐算法不进入第一版。
- 用户选择的指南针图标、服务页通知入口和新底栏顺序均可追溯。

先运行：

```powershell
node --test tests/discovery-first-release.test.cjs tests/v2-roadmap.test.cjs tests/content-heating-deferral.test.cjs tests/discover-navigation-design.test.cjs
```

旧状态应因缺少当前覆盖决定而失败；只把这个失败用于本地 TDD 证据，不提交失败状态。

### 3.2 再更新决定记录

修改：

- `docs/development-decisions.json`
- `CONTEXT.md`
- `docs/module-specs/current-development-basis-20261015.md`

写入当前决定的日期、设计文件、设计提交、图标选择提交、范围和执行闸门。历史 `featurePlanning` 与第二版提醒原文保持不变，当前读取时以 `discoveryFirstReleaseDecision` 覆盖商家广场的版本归属和首版互动范围。

再次运行 3.1 的测试，要求全部通过；然后运行：

```powershell
git diff --check
```

提交：

```text
docs: record first-release discovery decision
```

## 4. 任务二：重映射第一版产品合同

### 4.1 先扩展结构验证

修改：

- `tests/development-remapping.test.cjs`
- `tests/prd-v2.test.cjs`
- `tests/ascii-design.test.cjs`
- `tests/module-planning.test.cjs`
- `tests/ui-development-handoff.test.cjs`

更新预期覆盖量：

- 模块：14 → 15，新增 `M15 商家发现与主帖`。
- 字段组：21 → 22，新增 `F22 商家主帖`。
- 页面组：22 → 23，新增 `V23 发现/商家主帖/发布审核`。
- 通知：9 → 10，新增 `N10 商家主帖审核结果`。
- 验收：74 → 82，新增 `T19—T26`。
- 开发任务：57 → 60，新增 `DP58—DP60`；延后任务仍仅为 `DP30—DP35`。

新增验收定义：

- `T19`：所有底栏顺序、指南针图标、服务右上角通知入口与无底栏消息。
- `T20`：发现只展示审核通过且当前可展示的商家主帖，按审核通过后的发布时间倒序。
- `T21`：普通居民、待审核商家、审核通过商家的发布入口权限分离。
- `T22`：图文限定、1—9 图、20 字标题、1,000 字正文及 Unicode 可见字符边界。
- `T23`：旧公开版与待审核新版分离，只有新版审核通过才原子替换。
- `T24`：风险下架、审核原因和 `N10` 通知留痕，不产生自由聊天。
- `T25`：收藏与微信分享只使用公开字段，不夹带未授权联系和私密资料。
- `T26`：加载、空、失败、未登录、无资格、审核状态、320/375/414 像素及减少动画验收。

先运行相关测试并确认旧文档因缺少新编号和覆盖而失败。

### 4.2 更新当前产品文档

修改：

- `docs/prd.md`
- `docs/structured-design.md`
- `docs/development-plan.md`
- `docs/development-remapping-20261015.json`
- `docs/ascii-design-prd-2.1.md`
- `docs/ui-design-v1.md`
- `docs/v2-roadmap.md`
- `docs/ui-development-handoff/page-spec.md`
- `docs/ui-development-handoff/components-and-states.md`
- `docs/ui-development-handoff/implementation-checklist.md`

规则：

- 将 `VP04` 中基础商家广场能力迁入第一版 `M15/F22/V23`；`VP04` 保留为历史来源或标明已迁移，不继续作为第二版未定能力。
- 从第二版商业方案中移除“付费才获得发现页基础发帖权”的表述；工具会员仍可保留其它第二版工具权益候选，但不能收回第一版基础发帖权。
- 内容加热及其候选价格、交付、退款和统计仍在第二版且不承诺必做。
- 复用 `DP09/DP10/DP11/DP12/DP17/DP18` 的账号、图片安全、通知、运营、收藏和分享能力，不创造平行接口。
- 新增 `DP58`：核实商家主体/代表授权、真实准入与内容处理依据；未知项不得被原型替代。
- 新增 `DP59`：实现 `F22/V23/N10` 的商家主帖、版本审核、发现信息流、收藏和分享合同，依赖 `DP58` 及上述复用任务。
- 新增 `DP60`：执行 `T19—T26` 的第一版发现阶段验收，区分受控合成演示与真实接入结果。
- 归档文档和 `assets/ui/v1`、`assets/ui/v2` 历史生成提示不修改。

验证：

```powershell
node --test tests/development-remapping.test.cjs tests/prd-v2.test.cjs tests/ascii-design.test.cjs tests/module-planning.test.cjs tests/ui-development-handoff.test.cjs tests/discovery-first-release.test.cjs
powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate-structured-design.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate-development-plan.ps1
```

提交：

```text
docs: remap discovery into first release
```

## 5. 任务三：更新可复现 UI 交接资源

### 5.1 先改资源合同

修改：

- `tests/ui-development-handoff.test.cjs`
- `tests/validate-selected-ui-20261009.ps1`

要求：

- 导航标签严格为“首页 / 发现 / 发布 / 服务 / 我的”。
- 新增 `icon-discover`，路径采用已选 A 版：外圆、菱形指针和中心点；笔画、端点和圆角沿用现有图标系统。
- 导航图标顺序为 `icon-home / icon-discover / icon-plus / icon-services-bag / icon-user`。
- `icon-message` 不删除，作为服务页通知入口继续生成普通和绿色版本。
- 资源清单、数量、哈希和导航映射由生成脚本统一更新。

### 5.2 更新源并重新生成

修改：

- `assets/ui/development-handoff-20261009/design-tokens.json`
- `assets/ui/development-handoff-20261009/content.json`
- `assets/ui/development-handoff-20261009/components.json`
- `scripts/prepare-ui-development-handoff.cjs`

通过脚本生成并暂存：

- `assets/ui/development-handoff-20261009/icons/icon-discover.svg`
- `assets/ui/development-handoff-20261009/icons/icon-discover-green.svg`
- `assets/ui/development-handoff-20261009/icons.svg`
- `assets/ui/development-handoff-20261009/manifest.json`
- 其它由脚本确实发生哈希或内容变化的交接文件。

验证：

```powershell
node scripts/prepare-ui-development-handoff.cjs
node scripts/prepare-ui-development-handoff.cjs --check
node --test tests/ui-development-handoff.test.cjs
powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate-selected-ui-20261009.ps1
```

提交：

```text
assets: add compass discovery navigation icon
```

## 6. 任务四：更新既有导航与发布入口

### 6.1 先改预览合同

修改：

- `tests/v01-v02-preview.test.cjs`
- `tests/v04-preview.test.cjs`
- `tests/v05-preview.test.cjs`
- `scripts/verify-v01-v02-preview.cjs`
- `scripts/verify-v04-preview.cjs`
- `scripts/verify-v05-preview.cjs`

合同要求：

- `previews/v01-v02.html`、`previews/v04.html`、`previews/v05.html` 的底栏顺序一致。
- “发现”使用指南针；“服务”使用手提袋；底栏无消息气泡。
- 所有“发现”入口指向新的发现预览；首页、发布、服务、我的现有入口保持可达。
- V04 在合成的“审核通过商家”状态下显示“商家主帖”，普通居民和待审核商家不得提交。
- V05 原消息按钮删除；通知仍要求登录并从服务页进入。

### 6.2 修改现有预览

修改：

- `previews/v01-v02.html`
- `previews/v04.html`
- `previews/v05.html`
- `docs/v04-html-preview.md`
- `docs/v05-html-preview.md`

行为要求：

- 复用现有离线 SVG、合成数据、焦点样式、按压缩放和减少动画处理。
- 不新增外部资源、网络请求、真实联系方式、真实登录或真实审核动作。
- 服务入口右上角显示通知气泡按钮；未读角标作为明确状态而不是装饰常量。

验证：

```powershell
node --test tests/v01-v02-preview.test.cjs tests/v04-preview.test.cjs tests/v05-preview.test.cjs
```

提交：

```text
ui: update navigation and merchant publish entry
```

## 7. 任务五：新增发现与服务通知 HTML 预览

### 7.1 先写模型与静态合同

新增：

- `tests/v06-preview.test.cjs`
- `scripts/verify-v06-preview.cjs`

静态和模型测试覆盖：

- 合成商家主帖只在 `approved && displayable` 时进入信息流。
- 审核通过时间倒序稳定；相同时使用稳定编号排序，避免重复或跳动。
- 双列瀑布流按较短列放置，图片加载或视口变化后可重排。
- 图片 0/1/9/10、标题 19/20/21、正文 999/1000/1001 及表情可见字符边界。
- 普通居民、待审核商家、审核通过商家权限。
- 旧公开版、待审核新版、驳回、通过替换和风险下架状态。
- 收藏失败回滚、加载失败保留旧成功列表、无内容不生成假帖子。
- 分享模型只包含已批准公开字段。
- 服务页通知按钮、未读角标、通知中心和返回服务流程。
- 单文件离线、无外链、无网络、无存储副作用、元素 ID 唯一、脚本可编译。

### 7.2 实现预览

新增：

- `previews/v06.html`
- `docs/v06-html-preview.md`

页面覆盖：

- 发现双列瀑布流。
- 商家主帖详情与 1—9 图浏览、收藏、微信分享示意。
- 商家主帖草稿、预览确认、待审核、驳回、旧版继续展示、新版通过替换和风险下架示意。
- 服务页右上角通知入口、未读角标及必要通知中心。
- 加载、骨架、空、失败重试、未登录、无资格、审核状态和减少动画。

视觉要求：

- 参考小红书的图片优先、双列浏览节奏，但继续使用项目的绿色、米白、圆角和现有字体层级。
- 卡片标题最多两行，底部为商家头像、名称和审核标识；不展示虚构销量、评分或互动数。
- 所有点击操作有轻微按压反馈；减少动画时关闭非必要过渡。

Node 验证：

```powershell
node --test tests/v06-preview.test.cjs
```

浏览器验证：

- 使用已安装 Edge 和项目现有预览验证方式。
- 检查桌面预览及 320、375、414 像素宽度。
- 检查双列重排、底栏遮挡、图片顺序、详情、收藏、分享示意、权限、审核版本、通知和失败重试。
- 检查 `prefers-reduced-motion`、键盘焦点、浏览器错误和横向溢出。
- 截图及结果写入 `.local/discovery-navigation-20261018/`，不纳入 Git。

提交：

```text
ui: add first-release discovery prototype
```

## 8. 任务六：全量回归与交付记录

运行全量 Node 测试：

```powershell
node --test tests/*.test.cjs
```

运行所有与本次范围相关的 PowerShell 检查：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate-development-plan.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate-structured-design.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate-selected-ui-20261009.ps1
```

最终人工检查：

- `git diff --check` 无错误。
- `git status --short` 中只保留用户原有 `redbook` 删除记录，且它们从未进入本次任何提交。
- 当前文档中不存在把基础发现仍写成第二版、把内容加热写成第一版、把消息保留为底栏一级入口的冲突。
- 历史归档和旧生成提示未被改写。
- 所有生成资源通过 `--check` 可复现。
- HTML 预览不包含真实远程请求、真实联系人、真实商家或真实状态承诺。

如仅需补充验证记录，修改 `docs/planning-validation.md` 并提交：

```text
test: record discovery prototype verification
```

## 9. 完成条件

只有以下条件全部满足才交付：

- 当前规则、结构化映射、UI 交接、HTML 预览和测试对第一版发现范围一致。
- 全量自动化测试与相关 PowerShell 检查全部通过。
- 多尺寸浏览器验证通过且无未处理错误。
- 每个逻辑阶段已有独立 Git commit，可按阶段回滚。
- 未修改小程序业务源码，未触发真实发布、审核、通知、支付、推广或上线。

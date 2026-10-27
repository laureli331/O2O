# Merchant Commerce HTML Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 完成已确认的V24—V27独立交互预览及既有入口。

**Architecture:** 纯业务模型统一合成会话状态，四个独立页面各自呈现角色任务。共享移动端视觉和表单工具，运营使用桌面队列，不接真实交易接口。

**Tech Stack:** HTML、CSS、原生JavaScript、Node test、Playwright/Edge。

**Spec:** ../specs/2026-10-26-merchant-onboarding-coupons-ascii-design.md

## Global Constraints

- 四个独立网址：v24.html、v25.html、v26.html、v27.html。
- 99元／连续30天；通知成功生成起连续72小时；不自动续费。
- 免费满减券；每微信账号每活动1张；检测及人工通过才公开。
- 停领和入驻到期不影响已经领取的有效券核销。
- 不接真实支付、核验、上传、扫码或后台权限。
- 未入驻入口在我的接单资料区域及发现抽屉底部，骨架只在加载时出现。

## Review Focus

- 付款未知时禁止重复创建付款，查询只处理原请求。
- 券过期、他店券、他人券、重复核销应拒绝且不消耗库存。
- 刷新或返回不丢未提交输入，合成会话30分钟过期后清理。
- 到期商家仍能核销原券、买广告及申请必要更正。
- 窄屏、长内容、弹层焦点与底部按钮不能遮挡。

### Task 1: 业务模型与验证
**Files:** Create previews/assets/commerce-model.js; tests/commerce-model.test.cjs.
**Interfaces:** createState(now), validateMerchant(draft), validateActivity(draft,now), apply(state,command,now), permissions(state,now), load/save(storage,now).
- [x] 写用例覆盖期限边界、主体去重、到期权限、审批、领券库存及一次核销、未知请求。
- [x] 运行用例确认缺失实现失败。
- [x] 实现纯函数、同请求查询与会话序列化。
- [x] 运行模型测试并提交。

### Task 2: 移动端三组任务
**Files:** Create previews/v24.html, v25.html, v26.html; previews/assets/commerce-{ui,onboarding,activities,coupons}.js; commerce.css.
**Interfaces:** CommerceUI.field/row/panel/action/navigate/confirm/write，调用Task1模型。
- [x] 为24个页面路由、返回来源、提交失败保留、未知查询编写浏览器检查。
- [x] 按已确认ASCII实现9＋6＋3视图；日期复用BannerDatePicker。
- [x] 检查320/375/414宽度、长内容、安全区、键盘及弹层焦点。
- [x] 测试通过后提交。

### Task 3: 网页经营审核
**Files:** Create previews/v27.html; previews/assets/commerce-admin.js.
**Interfaces:** 同模型处理入驻／更正／异常／活动／券争议，五类共用队列。
- [x] 测试检测未知禁止通过、终态只读、理由快捷填写、同对象影响范围。
- [x] 实现先看内容和依据、再处置并作一次核对；不引入账号级处罚。
- [x] 验证失败、未知、版本变化和无权限。
- [x] 测试通过后提交。

### Task 4: 入口、回归与交付
**Files:** Modify previews/v05.html, v23.html and preview index; docs page mappings; scripts/verify-commerce.cjs.
- [x] 测试我的接单资料区域入口、抽屉未入驻入口、卡包券入口、商家主页领券入口。
- [x] 接入入口并更新页面清单和已确认说明。
- [x] 执行新浏览器检查、V05/V23受影响检查及全部Node测试。
- [x] 检查改动范围，提交并交付四个独立网址。

## 审阅
24个视图逐项对应批准稿；业务未知保留为合成依据，不新增正式材料标准或退款比例。用户已授权执行，不重复请求方案批准。本会话自行实施。

## 执行记录

- Task 1 complete：3324f08建立模型及首批用例；最终27项模型用例通过。
- Task 2 complete：三组移动页面18个视图，日期复用、返回、失败保留、未知查询及读取恢复验证通过。
- Task 3 complete：网页六视图，理由提示、同事项核对、检测门禁和权限隔离验证通过。
- Task 4 complete：V05／V10／V23／V15入口、说明及测试同步，四网址可访问。
- 最终独立只读审阅发现活动补充无法重提、跨过有效期丢失未知请求；均新增失败用例复现后修正。另补异常材料保持原首次回应时间的回归。
- 没有新增业务决策或真实能力；正式多商家／多活动持久化和接口权限仍按正式开发清单接入。

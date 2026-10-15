'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const records = JSON.parse(read('docs/module-specs/decisions.json'));
const handoff = JSON.parse(read('assets/ui/development-handoff-20261009/decisions.json'));

test('latest reply approves only clarified CQ37 A and explicitly replaces independent operator accounts with owner account sharing', () => {
  const b=records.businessCloseoutDecisionBatches[3];
  assert.equal(b.userReply,'我的另一个运营伙伴, 用的是我的账号管理, 所以不用那么麻烦\na');
  assert.equal(b.answers.length,1);assert.equal(b.answers[0].questionId,'CQ37');assert.equal(b.answers[0].answer,'A');
  assert.equal(b.operatorAccountDirection,'owner-account-shared-with-operating-partner');
  const s=records.businessCloseoutQuestionSets[2];assert.equal(s.answers.length,5);assert.equal(s.questions.find(q=>q.id==='CQ37').selected,'A');
  assert.equal(s.questions.find(q=>q.id==='CQ37').clarificationRequired,false);
  const rows=[...read(b.questionDocument).matchAll(/^\| (\d+)（(CQ\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(rows.length,1);assert.equal(rows[0][2],b.answers[0].questionId);assert.equal(rows[0][4].trim(),b.answers[0].selectedOption);
  assert.deepEqual(handoff.businessCloseoutDecisionBatches,records.businessCloseoutDecisionBatches);
});

test('one shared owner account retains authorization and account logs without claiming actual-person attribution or two-person review', () => {
  const a=records.operatorAccountRules;assert.deepEqual(handoff.operatorAccountRules,a);
  assert.equal(a.managementAccountCount,1);assert.equal(a.partnerUsesOwnerAccount,true);assert.equal(a.separatePartnerAccountRequired,false);
  assert.equal(a.memberManagementRequired,false);assert.equal(a.operatorRolesRequired,false);assert.equal(a.anotherOperatorApprovalRequired,false);
  assert.equal(a.publicManagementAccess,false);assert.equal(a.accountLevelAuthorizationRequired,true);
  assert.equal(a.audit.retained,true);assert.equal(a.audit.identifiesActualHumanOperator,false);assert.equal(a.audit.mandatoryHumanOperatorPicker,false);
  assert.deepEqual(a.audit.fields,['management-account','time','object','before-and-after','reason-when-required']);
  assert.equal(a.productionAccountConfigured,false);assert.equal(a.enabled,false);
  const r=records.businessCloseoutFinalPartialRules;assert.equal(r.operationsDashboard.audience,'owner-management-account-shared-with-partner');
  assert.equal(r.operationsDashboard.publicAccess,false);assert.equal(r.commissionConfiguration.anotherOperatorReviewRequired,false);
  assert.equal(r.commissionConfiguration.oldTradeRateSnapshotsChanged,false);assert.equal(r.commissionConfiguration.requiredAnnouncementProcedureRetained,true);
  assert.deepEqual(r.repeatedBillIssue,records.businessCloseoutFinalPartialRulesHistory[0].repeatedBillIssue);
  assert.deepEqual(r.reducedCommissionBasis,records.businessCloseoutFinalPartialRulesHistory[0].reducedCommissionBasis);
  const prd=read('docs/prd.md'),design=read('docs/structured-design.md'),plan=read('docs/development-plan.md');
  assert(prd.includes('- OPS05 本人及运营伙伴共用本人的一个管理账号'));assert(prd.includes('不声称区分实际自然人操作者'));
  for(const text of [prd,design]){const bs=text.match(/^\| BS01 \|[^\r\n]+/m);if(bs)assert(bs[0].includes('仅获授权的本人管理账号'));}
  for(const id of ['DP04','DP12']){const row=plan.match(new RegExp('^\| '+id+' \|[^\r\n]+','m'))[0];assert(!row.includes('两人同权独立账号'));assert(!row.includes('操作归人'));}
});

test('all forty-five transaction questions are confirmed while deferred commercial and real enablement work remain incomplete', () => {
  const inv=records.businessCloseoutQuestionInventory;assert.equal(inv.totalQuestions,45);assert.equal(inv.answeredQuestions,45);assert.equal(inv.remainingQuestions,0);
  assert.equal(inv.questions.filter(q=>q.status==='answered').length,45);assert.equal(inv.approvedAnswerCount,45);assert.equal(inv.answersApproved,true);
  assert.equal(inv.questions.find(q=>q.id==='CQ37').recordedAnswer,'A');assert.equal(inv.questions.find(q=>q.id==='CQ37').clarificationRequired,false);
  assert.equal(records.businessCloseoutInventoryHistory[3].remainingQuestions,1);
  const c=records.businessPlanningClosure;assert.equal(c.transactionQuestionSetResolved,true);assert.equal(c.allProductPlanningComplete,false);
  assert.equal(c.implementationAuthorizedByThisReply,false);assert.equal(c.productionEnabled,false);assert.deepEqual(c.deferredWorkstreamIds,['merchant-banner-commercial-planning']);
  assert.deepEqual(records.planningFocusHistory[11].pendingQuestionIds,[]);assert.equal(records.planningFocusHistory[11].remainingQuestionCount,0);assert.equal(records.planningFocusHistory[11].planningComplete,false);
  assert.equal(records.remainingPlanningAuditHistory[5].answeredQuestionCount,45);assert.equal(records.remainingPlanningAuditHistory[5].currentTransactionQuestionSetResolved,true);
  const r=records.businessCloseoutFinalPartialRules.commissionReview;
  assert.deepEqual(r.focus,{answer:'A',questionId:'CQ37',metrics:['transaction-volume','cancellations-and-issues','commission-arrears','actual-commission-received'],automaticAdjustment:false});
  assert.equal(r.unansweredQuestionId,null);assert.equal(r.activationOccurred,false);assert.equal(r.chargesStopAfter30Days,false);assert.equal(r.merchantBannerIncluded,false);
  for(const key of ['businessPlanningClosure','businessCloseoutFinalPartialRules','currentPlanningFocus','remainingPlanningAudit','businessCloseoutQuestionInventory'])assert.deepEqual(handoff[key],records[key],key);
  const doc=read(c.document);assert(doc.includes('45道交易规则问题全部确认'));assert(doc.includes('实际是哪位自然人操作'));
  for(const m of doc.matchAll(/\]\(([^)]+)\)/g))assert(fs.existsSync(path.resolve(root,path.dirname(c.document),m[1])),m[1]);
});

test('final partial reply records four explicit choices without treating the question about thirty days as consent', () => {
  const b=records.businessCloseoutDecisionBatches[2];
  assert.equal(b.userReply,'1. 运营看板是给谁看的?给我看的话, 那可以\n2. "收费试运行30天"是什么意思?收哪里的费?为什么只收30天?\n3. 不需要\n4. a\n5. a');
  assert.deepEqual(b.answers.map(a=>[a.questionId,a.answer]),[['CQ36','A'],['CQ38','B'],['CQ39','A'],['CQ40','A']]);
  assert(b.answers[0].condition.includes('不对普通用户公开'));
  const s=records.businessCloseoutQuestionSetHistory[3];
  for(const a of b.answers){const q=s.questions.find(q=>q.id===a.questionId);assert.equal(q.selected,a.answer);assert.equal(a.selectedOption,q.options[a.answer]);}
  assert.deepEqual(s.answers,b.answers);assert.equal(s.questions.find(q=>q.id==='CQ37').selected,null);
  assert.equal(b.unanswered.length,1);assert.equal(b.unanswered[0].questionId,'CQ37');
  assert(b.unanswered[0].userQuestion.includes('为什么只收30天'));
  assert.deepEqual(handoff.businessCloseoutDecisionBatches,records.businessCloseoutDecisionBatches);
});

test('confirmed final governance protects private dashboard, historical rates, new evidence and optional supporting images', () => {
  const r=records.businessCloseoutFinalPartialRulesHistory[0];assert.deepEqual(handoff.businessCloseoutFinalPartialRulesHistory[0],r);
  assert.equal(r.enabled,false);assert.equal(r.readyForImplementation,false);
  const o=r.operationsDashboard;assert.equal(o.audience,'existing-two-independent-equal-operators');assert.equal(o.publicAccess,false);
  assert.deepEqual(o.businesses,['跑腿','维修','闲置','其它']);assert.equal(o.automaticCompletionProvesActualDelivery,false);
  assert.equal(o.customerOfflinePaymentTotalCollected,false);assert.equal(o.realNewStatisticsGate,'DG01');assert.equal(o.merchantBannerReportsIncluded,false);
  const c=r.commissionConfiguration;assert.equal(c.anotherOperatorReviewRequired,false);assert.equal(c.equalExistingPermissionsRetained,true);
  assert.equal(c.requiredAnnouncementProcedureRetained,true);assert.equal(c.oldTradeRateSnapshotsChanged,false);assert.equal(c.saveAutomaticallyEnablesCharging,false);
  const i=r.repeatedBillIssue;assert.equal(i.sameReviewedReasonAndEvidencePausesAgain,false);assert.equal(i.newEvidenceAcceptedByOperatorMayPauseDisputedPart,true);
  assert.equal(i.appealEntryClosed,false);assert.equal(i.undisputedOriginalDeadlineRetained,true);assert.equal(i.operatorDecidesServiceDelivery,false);
  const p=r.reducedCommissionBasis;assert.equal(p.reasonRequired,true);assert.equal(p.reasonMinLength,1);assert.equal(p.reasonMaxLength,500);
  assert.deepEqual(p.attachments,{required:false,minCount:0,maxCount:9,formats:['JPEG','PNG'],maxSizeMB:5});
  assert.equal(p.actualNewPriceRequiresBothParties,true);assert.equal(p.commissionReductionRequiresOperatorVerification,true);
  assert.equal(p.oldReceiptAccessRestored,false);assert.equal(p.attachmentProvesPayment,false);assert.equal(p.necessaryRetentionPolicyRetained,true);
});

test('thirty-day review clarification neither ends charging nor selects a review priority or enables merchant advertising', () => {
  const r=records.businessCloseoutFinalPartialRulesHistory[0].commissionReview;
  assert.equal(r.existingApproval,'CT08/A');assert.equal(r.reviewAfterActualActivationDays,30);
  assert.equal(r.activationOccurred,false);assert.equal(r.startsFromDocumentDate,false);assert.equal(r.chargesStopAfter30Days,false);
  assert.equal(r.automaticallyChangesRates,false);assert.equal(r.merchantBannerIncluded,false);assert.equal(r.focus,null);
  assert.equal(r.unansweredQuestionId,'CQ37');
  const doc=read(r.clarificationDocument);const rows=[...doc.matchAll(/^\| (\d+)（(CQ\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(rows.length,1);assert.equal(rows[0][2],'CQ37');assert(doc.includes('不是只收30天'));assert(doc.includes('不增加业务题数'));
});

test('previous audit has forty-four answered and only original CQ37 pending while preserving the prior five-question snapshot', () => {
  const inv=records.businessCloseoutInventoryHistory[3];
  assert.equal(inv.totalQuestions,45);assert.equal(inv.answeredQuestions,44);assert.equal(inv.approvedAnswerCount,44);assert.equal(inv.remainingQuestions,1);
  assert.equal(inv.questions.filter(q=>q.status==='answered').length,44);
  assert.deepEqual(inv.questions.filter(q=>q.status==='pending').map(q=>q.id),['CQ37']);
  assert.equal(inv.questions.find(q=>q.id==='CQ37').recordedAnswer,undefined);
  const focus=records.planningFocusHistory[10];assert.deepEqual(focus.pendingQuestionIds,['CQ37']);assert.equal(focus.remainingQuestionCount,1);assert.equal(focus.planningComplete,false);
  assert.equal(records.remainingPlanningAuditHistory[4].answeredQuestionCount,44);assert.equal(records.remainingPlanningAuditHistory[4].presentedQuestionCount,1);
  assert.deepEqual(focus.deferredWorkstreamIds,['merchant-banner-commercial-planning']);
  assert.equal(records.businessCloseoutInventoryHistory[2].remainingQuestions,5);
  assert.equal(records.remainingPlanningAuditHistory[3].remainingQuestionCount,5);
  for(const k of ['currentPlanningFocus','remainingPlanningAudit','businessCloseoutQuestionInventory','businessCloseoutQuestionSetHistory','businessCloseoutInventoryHistory','currentPolicyReferences'])assert.deepEqual(handoff[k],records[k],k);
  for(const f of [focus.ruleDocument,focus.questionDocument])for(const m of read(f).matchAll(/\]\(([^)]+)\)/g))assert(fs.existsSync(path.resolve(root,path.dirname(f),m[1])),f+':'+m[1]);
});

test('second reply records CQ30 as custom and CQ32 as A with an errand-only exception rather than blindly assigning all A', () => {
  assert.equal(records.businessCloseoutDecisionBatches.filter(b=>b.id==='business-closeout-reply-2-20261015').length,1);
  const batch=records.businessCloseoutDecisionBatches[1];
  assert.equal(batch.userReply,'15优选改为banner广告位, 给商家, 盈利模式稍后细聊\n17可以, 跑腿为只在自动结束后通知双方一次\n全A');
  assert.equal(batch.answers.length,20);
  assert.equal(batch.answers.filter(a=>a.answer==='A').length,19);
  const custom=batch.answers.find(a=>a.questionId==='CQ30');
  assert.equal(custom.answer,'CUSTOM');assert(custom.selectedOption.includes('商家'));assert(custom.selectedOption.includes('稍后讨论'));
  const n=batch.answers.find(a=>a.questionId==='CQ32');
  assert.equal(n.answer,'A');assert.deepEqual(n.businessOverride,{business:'跑腿',scope:'expiry-notifications-only',preExpiryReminder:false,automaticCompletionNoticeToBothOnce:true});
  const set=records.businessCloseoutQuestionSets[1];
  assert.deepEqual(set.answers,batch.answers);assert.equal(set.status,'answered-with-explicit-custom-and-business-override');
  const rows=[...read(set.document).matchAll(/^\| (\d+)（((?:NE|CQ)\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  batch.answers.forEach((a,i)=>{assert.equal(a.questionId,rows[i][2]);if(a.answer==='A')assert.equal(a.selectedOption,rows[i][4].trim());});
  assert.deepEqual(handoff.businessCloseoutDecisionBatches,records.businessCloseoutDecisionBatches);
  assert.deepEqual(handoff.businessCloseoutQuestionSets,records.businessCloseoutQuestionSets);
  assert.equal(records.businessCloseoutDecisionBatches[0].answers.length,20);
  assert.equal(records.businessCloseoutQuestionSetHistory[1].answers.length,0);
});

test('confirmed expiry policy removes both completion actions and both completion buffers without deleting independent financial windows', () => {
  const r=records.serviceExpiryRules;
  assert.deepEqual(handoff.serviceExpiryRules,r);
  assert.equal(r.serviceTime.meaning,'start-date-and-time');
  assert.equal(r.expiry.label,'服务到期时间');
  assert.equal(r.expiry.validityMeans,'service-expiry-not-post-listing-expiry');
  assert.equal(r.expiry.duplicateValidityField,false);
  assert.equal(r.expiry.additionalNormalCompletionGraceHours,0);
  assert.equal(r.expiry.additionalPostIssueClearanceGraceHours,0);
  assert.equal(r.expiry.validIssueAtExactExpiryAccepted,true);
  assert.equal(r.expiry.normalCompletionRequiresStrictlyAfterExpiry,true);
  assert.equal(r.expiry.unresolvedValidDeliveryIssuePauses,true);
  assert.equal(r.expiry.clearanceBeforeExpiry,'wait-current-effective-expiry');
  assert.equal(r.expiry.clearanceAfterExpiry,'eligible-to-complete-without-extra-72-hours');
  assert.equal(r.expiry.duplicateCompletionAllowed,false);
  assert.equal(r.expiry.cancelledTradeMayComplete,false);
  assert.equal(r.manualCompletion.customerConfirmationEnabled,false);
  assert.equal(r.manualCompletion.workerCompletionReportEnabled,false);
  assert.equal(r.manualCompletion.preTransactionAgreementRetained,true);
  assert.equal(r.manualCompletion.feeAgreementCancellationAndIssueClearanceAgreementRetained,true);
  assert.equal(r.extension.initialMaxHours,720);assert.equal(r.extension.extensionMaxHours,168);
  assert.equal(r.extension.requiresBothParties,true);assert.equal(r.extension.confirmedNewExpiryAdds72Hours,false);
  assert.deepEqual(r.other72HourWindowsRetained,['first-late-fee-objection','issued-commission-bill-payment','resolved-bill-issue-payment']);
  assert.equal(records.businessCloseoutRound1Rules.billIssue.afterVerificationDueBalanceHours,72);
  assert.equal(records.deadlineCompletionClarificationRules.horizon.initialMaxHours,720);
  const expiry=Date.parse('2026-10-16T18:00:00+08:00');
  assert.equal(expiry+r.expiry.additionalNormalCompletionGraceHours*3600000,expiry);
  assert.notEqual(expiry,Date.parse('2026-10-19T18:00:00+08:00'));
  assert.equal(r.enabled,false);assert.equal(r.readyForImplementation,false);
});

test('expiry-based income and notification exceptions are consistent across handoff and protect actual-payment and privacy boundaries', () => {
  const r=records.businessCloseoutRound2Rules;
  assert.deepEqual(handoff.businessCloseoutRound2Rules,r);
  assert.equal(r.mainIncome.business,'跑腿');assert.equal(r.mainIncome.completionSource,'normal-service-expiry');
  assert.equal(r.mainIncome.effectiveMutuallyConfirmedFeeRequired,true);
  assert.equal(r.mainIncome.validDeliveryIssueExcludesFromMainTotal,true);
  assert.equal(r.mainIncome.explicitDeliveryAcknowledgmentRequired,false);
  assert.equal(r.mainIncome.advancesGoodsAndOwnCustomerSpendingExcluded,true);
  assert.equal(r.mainIncome.netAfterCommission,false);
  assert.equal(r.mainIncome.unknownFeeTreatedAsZero,false);
  assert.equal(r.mainIncome.provesCustomerPayment,false);
  assert.equal(r.mainIncome.duplicateInclusionAllowed,false);
  const inc=handoff.items.find(i=>i.id==='HD02');
  assert.equal(inc.completionIncomeResolution.answer,'A');assert.equal(inc.completionIncomeResolution.questionId,'NE04');
  assert.equal(inc.completionIncomeResolution.explicitDeliveryAcknowledgmentRequired,false);
  assert.equal(inc.completionIncomeResolution.automaticCompletionWithEffectiveFeeAndNoDeliveryIssueIncluded,true);
  assert.equal(inc.completionIncomeResolutionHistory[0].answer,'B');
  assert.equal(inc.confirmed.wallet,false);assert.equal(inc.confirmed.disclosure,'非到账金额');
  assert.deepEqual(r.expiryNotifications.跑腿,{preExpiryReminder:false,completionNoticeToBothOnce:true});
  for(const business of ['维修','闲置','其它'])assert.deepEqual(r.expiryNotifications[business],{preExpiryReminderHours:24,preExpiryReminderToBothOnce:true,completionNoticeToBothOnce:true});
  assert.equal(r.expiryNotifications.scope,'expiry-reminders-and-automatic-completion-result-only');
  assert.equal(r.expiryNotifications.requestFeeAndIssueNotificationsUnchanged,true);
  assert.equal(r.expiryNotifications.guaranteesWechatDelivery,false);
  assert.equal(r.notificationPreferences.nonResultRemindersMayBeDisabled,true);
  assert.equal(r.notificationPreferences.approvedOverdueCollectionPolicyChanged,false);
  assert.equal(r.selectedRepairOtherChanges.contentAndFeeRelatedChangesRequireBothCurrentVersionsToBeMutuallyAccepted,true);
  assert.equal(r.endedFeeContact.phoneAccessHours,24);assert.equal(r.endedFeeContact.addressAccessRestored,false);
  assert.equal(r.endedFeeReceipts.operatorOldReceiptAccessGranted,false);
  assert.equal(r.receiptRetention.extraRetentionDays,0);assert.equal(r.receiptRetention.physicalDeletionPerformed,false);
  assert.equal(r.aiTimeExtraction.automaticallyPublishes,false);
  assert.equal(r.aiTimeExtraction.expandsToRepairOther,false);
});

test('merchant Banner replaces preferred-card scope without inventing packages, prices, slots or current commercial approval', () => {
  const b=records.merchantBannerDirection;
  assert.deepEqual(handoff.merchantBannerDirection,b);
  assert.equal(b.audience,'merchants');assert.equal(b.presentation,'banner-ad-slot');
  assert.equal(b.commercialModelDeferredByUser,true);assert.equal(b.commercialRulesConfirmed,false);
  for(const field of ['price','duration','capacity','merchantCategories','clickDestination'])assert.equal(b[field],null,field);
  assert.equal(b.legacyPricesPackagesCapacityAndCategoryLimitsInherited,false);
  assert.equal(b.advertisingIdentificationRequirementRemoved,false);
  assert.equal(b.advertisingLabelAndPositionChosen,false);
  assert.equal(b.selectedReferenceImageModified,false);assert.equal(b.enabled,false);assert.equal(b.readyForImplementation,false);
  assert.deepEqual(records.businessCloseoutRound2Rules.freeDirectory.businesses,['维修','跑腿']);
  assert.equal(records.businessCloseoutRound2Rules.freeDirectory.legacyPaidPreferredCategoryRuleSupersededByBanner,true);
  const ad=handoff.items.find(i=>i.id==='HD03');
  assert.equal(ad.status,'merchant-banner-direction-approved-commercial-rules-deferred');
  assert.equal(ad.confirmedHistory[0],'优选属于M06付费推广');assert.equal(ad.legacyPaidPreferredTermsInherited,false);
  assert.equal(records.deferredPlanningWorkstreams.length,1);
  assert.equal(records.deferredPlanningWorkstreams[0].userExplicitlyDeferred,true);
  assert.equal(records.deferredPlanningWorkstreams[0].notIncludedInCurrentFiveQuestions,true);
  assert.equal(records.deferredPlanningWorkstreams[0].enabled,false);
});

test('exactly five final sourced questions remain unapproved after forty answers, with merchant commercial questions deferred rather than padded', () => {
  const inv=records.businessCloseoutInventoryHistory[2];
  assert.equal(inv.totalQuestions,45);assert.equal(inv.answeredQuestions,40);assert.equal(inv.remainingQuestions,5);
  assert.equal(inv.questions.filter(q=>q.status==='answered').length,40);
  assert.equal(inv.questions.filter(q=>q.status==='pending').length,5);
  assert.equal(inv.questions.filter(q=>q.status==='queued').length,0);
  assert.equal(records.businessCloseoutQuestionSets.length,3);
  const last=records.businessCloseoutQuestionSetHistory[2];
  assert.deepEqual(last.presentedQuestionIds,['CQ36','CQ37','CQ38','CQ39','CQ40']);
  assert.deepEqual(last.answers,[]);assert.equal(last.previousAllAApplies,false);
  assert.equal(last.finalShortRound,true);assert.equal(last.noPadding,true);
  const rows=[...read(last.document).matchAll(/^\| (\d+)（(CQ\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(rows.length,5);
  last.questions.forEach((q,i)=>{assert.equal(q.selected,null);assert.equal(q.number,i+1);assert.equal(q.question,rows[i][3].trim());assert.equal(q.options.A,rows[i][4].trim());assert.equal(q.options.B,rows[i][5].trim());});
  assert.equal(records.planningFocusHistory[9].remainingQuestionCount,5);
  assert.equal(records.planningFocusHistory[9].planningComplete,false);
  assert.deepEqual(records.planningFocusHistory[9].blockingInterpretationIds,[]);
  assert.deepEqual(records.planningFocusHistory[9].pendingQuestionIds,last.presentedQuestionIds);
  assert.equal(records.remainingPlanningAudit.allFirstReleaseBusinessResolved,false);
  assert.deepEqual(handoff.currentPlanningFocus,records.currentPlanningFocus);
  assert.deepEqual(handoff.businessCloseoutInventoryHistory[2],inv);
  for(const f of ['docs/module-specs/business-closeout-round-2-rules-20261015.md','docs/module-specs/merchant-banner-direction-20261015.md',last.document]){
    for(const m of read(f).matchAll(/\]\(([^)]+)\)/g))assert(fs.existsSync(path.resolve(root,path.dirname(f),m[1])),`${f}: ${m[1]}`);
  }
});

test('first twenty A answers are recorded exactly, while the later explicit expiry request overrides manual customer acknowledgment', () => {
  const [batch]=records.businessCloseoutDecisionBatches;
  assert.equal(records.businessCloseoutDecisionBatches.filter(b=>b.id==='business-closeout-reply-1-20261015').length,1);
  assert.equal(batch.date,'2026-10-15');
  assert.equal(batch.answerShorthand,'全A');
  assert.equal(batch.answers.length,20);
  assert.deepEqual(batch.answers.map(a=>a.questionId),Array.from({length:20},(_,i)=>`CQ${String(i+1).padStart(2,'0')}`));
  const first=records.businessCloseoutQuestionSets[0];
  const rows=[...read(batch.questionDocument).matchAll(/^\| (\d+)（(CQ\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(rows.length,20);
  batch.answers.forEach((a,i)=>{assert.equal(a.answer,'A');assert.equal(a.selectedOption,rows[i][4].trim());assert.equal(first.questions[i].selected,'A');});
  assert.deepEqual(first.answers,batch.answers);
  assert.equal(first.status,'answered-with-later-direction-overrides');
  assert.deepEqual(batch.affectedQuestionIds,['CQ01','CQ05','CQ06','CQ14']);
  const [request]=records.serviceExpiryPlanningRequests;
  assert.equal(request.userReply,batch.userReply);
  for(const part of ['全A','取消"确认完成/收到"','新增"服务到期时间"','新增"延长到期"','"服务时间", "有效期"']) assert(batch.userReply.includes(part),part);
  assert.equal(request.confirmedDirection.removeCustomerCompletionAcknowledgment,true);
  assert.equal(request.confirmedDirection.removesPreTransactionAgreement,false);
  assert.equal(request.existingCancellationFeeAndIssueAgreementNotRemoved,true);
  assert.equal(request.previousIncomeQualificationRequiresReview,true);
  assert.equal(records.businessCloseoutRound1Rules.manualCompletion.notAnActiveManualCustomerFlow,true);
  assert.equal(records.businessCloseoutRound1Rules.manualCompletion.customerAcknowledgmentRemovedByRequest,request.id);
  assert.deepEqual(handoff.businessCloseoutDecisionBatches,records.businessCloseoutDecisionBatches);
  assert.deepEqual(handoff.serviceExpiryPlanningRequests,records.serviceExpiryPlanningRequests);
});

test('unaffected all-A boundaries preserve issue fields, truthful billing, debt scope, credits and post-automatic fee corrections', () => {
  const r=records.businessCloseoutRound1Rules;
  assert.deepEqual(handoff.businessCloseoutRound1Rules,r);
  assert.equal(r.idle.ordinaryRepricingNoResponse,'remains-pending');
  assert.equal(r.idle.lateFee24HourSpecialRuleUnchanged,true);
  assert.equal(r.idle.repricingRefusalReasonMinLength,1);assert.equal(r.idle.repricingRefusalReasonMaxLength,300);
  assert.equal(r.idle.cancellationInitiatorMayWithdrawPending,true);
  assert.equal(r.idle.reopenAfterMutualCancellation,'seller-explicit-action');
  assert.equal(r.idle.cancellationMasksCounterpartyContact,true);
  assert.deepEqual(r.deliveryIssues,{businesses:['跑腿','维修','闲置','其它'],descriptionRequired:true,descriptionMinLength:1,descriptionMaxLength:500,attachments:{required:false,minCount:0,maxCount:9,formats:['JPEG','PNG'],maxSizeMB:5},activeIssuePerTransaction:1,unresolvedMattersMerged:true,supplementHistoryRetained:true,clearanceMustCoverAllUnresolvedMatters:true,newUnresolvedContentCannotUseOldClearanceVersion:true,submissionProvesTruth:false});
  assert.equal(r.lateFeeCutoff.effectiveReceiptAtCutoffAccepted,true);
  assert.equal(r.lateFeeCutoff.eligibleFormationRequiresStrictlyAfterCutoff,true);
  assert.equal(r.lateFeeCutoff.changesServiceExpiry72HourChoice,false);
  assert.equal(r.ratingAfterLateDeliveryIssue.afterClearanceNewWindowHours,168);
  assert.equal(r.ratingAfterLateDeliveryIssue.existingRatingsAutomaticallyDeleted,false);
  assert.equal(r.incomeCorrection.changesToAutomaticQualificationPending,'NE04');
  assert.equal(r.billIssue.disputedCommissionAmountRequired,true);
  assert.equal(r.billIssue.undisputedOriginalDeadlineRetained,true);
  assert.equal(r.billIssue.afterVerificationDueBalanceHours,72);
  assert.equal(r.billIssue.afterVerificationAnchor,'successful-supplementary-payment-notice-generation');
  assert.deepEqual(r.debt.scope,['跑腿','维修','闲置','其它']);
  assert.equal(r.debt.oldQuotesCannotBypassNewTradeCheck,true);
  assert.equal(r.debt.browsingFreeDemandPublicationOldTradeHandlingAndAppealsRetained,true);
  assert.equal(r.credits.crossBusinessSameAccountAllowed,true);
  assert.equal(r.credits.priority,'earlier-due-first');
  assert.equal(r.credits.crossAccountTransfer,false);
  assert.deepEqual(r.overdueReminders,{minIntervalHours:24,maxCount:3,stopWhenPaidOrCollectionSuspended:true,doesNotGuaranteeWechatDelivery:true});
  assert.equal(r.feeSupplement.scope,'automatic-completion-only');
  assert.equal(r.feeSupplement.sameServiceAlreadyIncurredOnly,true);
  assert.equal(r.feeSupplement.mutualConfirmationRequired,true);
  assert.equal(r.feeSupplement.addsAnotherCap,false);
  for(const field of ['enabled','readyForImplementation','actualProductEnabled','commissionRatesCapsAndCustomerDirectPaymentChanged']) assert.equal(r[field],false,field);
});

test('five expiry meanings stay unselected and the next twenty-question round never inherits the preceding all-A reply', () => {
  const request=records.serviceExpiryPlanningRequests[0];
  assert.deepEqual(request.pendingInterpretations,{serviceTimeShape:null,validityMeaning:null,additionalCompletion72HourPolicy:null,mainIncomeEligibility:null,workerCompletionReport:null});
  assert.equal(request.enabled,false);assert.equal(request.readyForImplementation,false);
  assert.equal(records.businessCloseoutQuestionSetHistory.filter(q=>q.id==='business-closeout-round-2-20261015').length,1);
  const set=records.businessCloseoutQuestionSetHistory[1];
  const expected=[...Array.from({length:5},(_,i)=>`NE${String(i+1).padStart(2,'0')}`),...Array.from({length:15},(_,i)=>`CQ${String(i+21).padStart(2,'0')}`)];
  const rows=[...read(set.document).matchAll(/^\| (\d+)（((?:NE|CQ)\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(rows.length,20);assert.deepEqual(rows.map(r=>r[2]),expected);
  assert.deepEqual(set.presentedQuestionIds,expected);
  assert.equal(set.previousAllAApplies,false);assert.deepEqual(set.answers,[]);
  assert.equal(set.status,'awaiting-user-answers');
  set.questions.forEach((q,i)=>{assert.equal(q.number,i+1);assert.equal(q.id,expected[i]);assert.equal(q.selected,null);assert.equal(q.question,rows[i][3].trim());assert.equal(q.options.A,rows[i][4].trim());assert.equal(q.options.B,rows[i][5].trim());});
  assert.deepEqual(records.planningFocusHistory[8].pendingQuestionIds,expected);
  assert.deepEqual(records.planningFocusHistory[8].blockingInterpretationIds,expected.slice(0,5));
  assert.equal(records.planningFocusHistory[8].date,'2026-10-15');
  assert.equal(records.planningFocusHistory[8].directionDocument,request.document);
  assert.equal(records.planningFocusHistory[8].implementationEnabled,false);
  const qdoc=read(set.document);
  for(const phrase of ['20题全部待答','原第一轮的“全A”不适用于本表','不改变费用后来首次确认的补费申报72小时','全部待答','不代表真实资格已通过','不能通过本题擅自全停或加密催缴']) assert(qdoc.includes(phrase),phrase);
  assert(read('CONTEXT.md').includes('**客户完成确认**'));
});

test('new expiry direction adds exactly five explained questions and preserves original forty-question history and source links', () => {
  const inventory=records.businessCloseoutInventoryHistory[1];
  assert.deepEqual(handoff.businessCloseoutInventoryHistory[1],inventory);
  assert.equal(inventory.totalQuestions,45);assert.equal(inventory.answeredQuestions,20);assert.equal(inventory.remainingQuestions,25);
  assert.equal(inventory.totalQuestions-inventory.answeredQuestions,inventory.remainingQuestions);
  assert.equal(inventory.questions.length,45);assert.equal(new Set(inventory.questions.map(q=>q.id)).size,45);
  assert.equal(inventory.questions.filter(q=>q.status==='answered').length,20);
  assert.equal(inventory.questions.filter(q=>q.status==='pending').length,20);
  assert.deepEqual(inventory.questions.filter(q=>q.status==='queued').map(q=>q.id),['CQ36','CQ37','CQ38','CQ39','CQ40']);
  assert.equal(inventory.scopeChanges.length,1);assert.equal(inventory.scopeChanges[0].addedQuestionIds.length,5);
  assert.equal(inventory.addedQuestionCount,5);assert.equal(inventory.plannedRounds,3);
  assert.equal(records.businessCloseoutInventoryHistory[0].totalQuestions,40);
  assert.equal(records.businessCloseoutInventoryHistory[0].answeredQuestions,0);
  assert.equal(records.businessCloseoutQuestionSetHistory[0].answers.length,0);
  assert.deepEqual(handoff.businessCloseoutInventoryHistory,records.businessCloseoutInventoryHistory);
  assert.deepEqual(handoff.businessCloseoutQuestionSetHistory,records.businessCloseoutQuestionSetHistory);
  assert.equal(records.remainingPlanningAuditHistory[2].remainingQuestionCount,25);
  assert.equal(records.remainingPlanningAuditHistory[2].queuedQuestionCount,5);
  assert.equal(records.remainingPlanningAuditHistory[1].remainingQuestionCount,40);
  assert.equal(records.planningFocusHistory[8].remainingQuestionCount,25);
  assert.equal(records.planningFocusHistory[8].planningComplete,false);
  for(const f of ['docs/module-specs/business-closeout-round-1-rules-20261015.md','docs/module-specs/service-expiry-request-20261015.md','docs/module-specs/business-closeout-round-2-questions-20261015.md']) {
    for(const m of read(f).matchAll(/\]\(([^)]+)\)/g)) assert(fs.existsSync(path.resolve(root,path.dirname(f),m[1])),`${f}: ${m[1]}`);
  }
  for(const f of ['docs/module-specs/README.md','docs/module-specs/business-closeout-plan-20261014.md','docs/ui-development-handoff/README.md','docs/ui-development-handoff/business-addendum.md','docs/ui-development-handoff/page-spec.md','docs/ui-development-handoff/decisions-and-gaps.md']){
    const text=read(f);assert(text.includes('到期收尾方向更新：'));assert(text.includes('service-expiry-request-20261015.md'));assert(text.includes('business-closeout-round-2-questions-20261015.md'));
  }
});

test('twenty-question request supersedes batch size only and does not turn continue into approval of options', () => {
  assert.deepEqual(handoff.discussionFormat,records.discussionFormat);
  assert.deepEqual(handoff.discussionFormatHistory,records.discussionFormatHistory);
  assert.equal(records.discussionFormat.questionsPerRound,20);
  assert.equal(records.discussionFormat.supersedesQuestionsPerRound,8);
  assert.equal(records.discussionFormat.userReply,'继续, 直到问完\n每轮20题, 语句直白点');
  assert.equal(records.discussionFormat.languageUserReply,'语句直白点');
  assert.equal(records.discussionFormat.presentation,'table');
  assert.equal(records.discussionFormatHistory[0].questionsPerRound,8);
  assert.equal(records.discussionFormatHistory[0].languageUserReply,'以后都直白点');
  const [set]=records.businessCloseoutQuestionSetHistory;
  assert.equal(set.previousAllAApplies,false);
  assert.equal(set.status,'awaiting-user-answers');
  assert.deepEqual(set.answers,[]);
  for(const q of set.questions) assert.equal(q.selected,null);
  assert.equal(records.deadlineCompletionClarificationDecisionBatches[0].answers.length,8);
  assert.equal(records.deadlineCompletionClarificationRules.enabled,false);
  assert.equal(records.planningFocusHistory[7].implementationEnabled,false);
});

test('finite closeout inventory has forty unique sourced business questions in two batches without counting paused IR twice', () => {
  const inventory=records.businessCloseoutInventoryHistory[0];
  assert.deepEqual(handoff.businessCloseoutInventoryHistory[0],inventory);
  assert.equal(inventory.totalQuestions,40);
  assert.equal(inventory.remainingQuestions,40);
  assert.equal(inventory.answeredQuestions,0);
  assert.equal(inventory.questionsPerRound,20);
  assert.equal(inventory.plannedRounds,2);
  assert.equal(inventory.answersApproved,false);
  assert.equal(inventory.implementationEnabled,false);
  assert.equal(inventory.scopeExpansionMayAddQuestions,true);
  assert.equal(inventory.clarificationsMustStateReason,true);
  assert.equal(new Set(inventory.questions.map(q=>q.id)).size,40);
  const rows=[...read(inventory.document).matchAll(/^\| (CQ\d{2}) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(rows.length,40);
  inventory.questions.forEach((q,i)=>{
    assert.equal(q.id,`CQ${String(i+1).padStart(2,'0')}`);
    assert.equal(q.number,i+1);
    assert.equal(q.question,rows[i][2].trim());
    assert.equal(q.round,i<20?1:2);
    assert.equal(q.status,i<20?'pending':'queued');
    assert(q.sources.length>0);
    for(const source of q.sources) assert(fs.existsSync(path.resolve(root,source.document)),`${q.id}: ${source.document}`);
    assert.equal(Object.hasOwn(q,'answer'),false);
  });
  for(const field of ['technicalTasksExcluded','externalEvidenceExcluded','secondReleaseExcluded']) assert.equal(inventory[field],true);
  const audit=records.remainingPlanningAuditHistory[1];
  assert.deepEqual(handoff.remainingPlanningAuditHistory[1],audit);
  assert.equal(audit.remainingQuestionCount,inventory.remainingQuestions);
  assert.equal(audit.presentedQuestionCount,20);
  assert.equal(audit.queuedQuestionCount,20);
  assert.equal(audit.planningComplete,false);
  assert.equal(audit.userApprovedMissingAnswers,false);
  assert(read('docs/module-specs/idle-request-questions-20261014.md').includes('不把IR重复计入额外八题'));
});

test('first closeout table presents exactly twenty complete A/B proposals and preserves their current fee and deadline scopes', () => {
  assert.equal(records.businessCloseoutQuestionSetHistory.filter(q=>q.id==='business-closeout-round-1-20261014').length,1);
  const [set]=records.businessCloseoutQuestionSetHistory;
  assert.deepEqual(handoff.businessCloseoutQuestionSetHistory,records.businessCloseoutQuestionSetHistory);
  const doc=read(set.document);
  const rows=[...doc.matchAll(/^\| (\d+)（(CQ\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(rows.length,20);
  set.questions.forEach((q,i)=>{
    assert.equal(q.number,i+1);assert.equal(q.id,rows[i][2]);
    assert.equal(q.question,rows[i][3].trim());
    assert.equal(q.options.A,rows[i][4].trim());assert.equal(q.options.B,rows[i][5].trim());
    assert.equal(q.recommended,'A');assert.equal(q.selected,null);
  });
  assert.deepEqual(set.presentedQuestionIds,rows.map(r=>r[2]));
  assert.deepEqual(records.planningFocusHistory[7].pendingQuestionIds,set.presentedQuestionIds);
  assert.equal(records.planningFocusHistory[7].questionDocument,set.document);
  assert.equal(records.planningFocusHistory[7].ruleDocument,'docs/module-specs/deadline-completion-clarification-rules.md');
  assert.equal(records.planningFocusHistory[7].sourceBatch,'deadline-completion-round-6-20261014');
  assert.equal(records.planningFocusHistory[7].remainingQuestionCount,40);
  assert.equal(records.planningFocusHistory[7].planningComplete,false);
  for(const phrase of ['CQ01—CQ20全部待答','第二轮尚未开始','不重复问','仅问普通改价','首次未知费用和真实争议分别保留','不能回填IR08为已答','每份最多一份待确认解除请求','不按手机点击补时','不刷新无争议部分','不扩展用户明确完成后的普通改费权限','反复点击不重复刷新']) assert(doc.includes(phrase),phrase);
  assert.equal(records.deadlineCompletionOperationRules.horizon.extensionMaxDays,7);
  assert.equal(records.deadlineCompletionClarificationRules.horizon.extensionMaxHours,168);
  assert.equal(records.deadlineCompletionClarificationRules.clearance.counterpartyExplicitSameVersionConfirmationRequired,true);
});

test('closeout references and handoff pointers resolve while old incomplete audit remains a dated snapshot', () => {
  for(const f of ['docs/module-specs/business-closeout-plan-20261014.md','docs/module-specs/business-closeout-round-1-questions-20261014.md']) {
    for(const m of read(f).matchAll(/\]\(([^)]+)\)/g)) {
      if(/^https:\/\//.test(m[1])) continue;
      assert(fs.existsSync(path.resolve(root,path.dirname(f),m[1])),`${f}: ${m[1]}`);
    }
  }
  for(const f of ['docs/module-specs/README.md','docs/module-specs/remaining-planning-audit-20261014.md','docs/ui-development-handoff/README.md','docs/ui-development-handoff/business-addendum.md','docs/ui-development-handoff/decisions-and-gaps.md']) {
    const text=read(f);assert(text.includes('收口清单更新：'));assert(text.includes('business-closeout-plan-20261014.md'));assert(text.includes('business-closeout-round-1-questions-20261014.md'));
  }
  assert.equal(records.remainingPlanningAuditHistory[0].remainingQuestionCount,null);
  assert.equal(records.remainingPlanningAuditHistory[0].newQuestionsPresented,false);
  assert.deepEqual(records.remainingPlanningAuditHistory,handoff.remainingPlanningAuditHistory);
  assert.deepEqual(records.planningFocusHistory[7],handoff.planningFocusHistory[7]);
  assert.deepEqual(records.planningFocusHistory,handoff.planningFocusHistory);
  assert.deepEqual(records.planningFocusHistory[6].pendingQuestionIds,[]);
});

test('sixth-round all-A reply answers exactly DX01 to DX08 and resolves DO02 without rewriting its history', () => {
  const batches=records.deadlineCompletionClarificationDecisionBatches;
  assert.equal(batches.length,1);
  const [batch]=batches;
  assert.equal(batch.id,'deadline-completion-round-6-20261014');
  assert.equal(batch.userReply,'全A, 以后都直白点\n还有多少条问题?');
  const rows=[...read(batch.questionDocument).matchAll(/^\| [1-8]（(DX\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(rows.length,8);
  assert.deepEqual(batch.answers.map(a=>a.questionId),Array.from({length:8},(_,i)=>`DX${String(i+1).padStart(2,'0')}`));
  batch.answers.forEach((a,i)=>{assert.equal(a.answer,'A');assert.equal(a.selectedOption,rows[i][3].trim());});
  assert.deepEqual(batch.resolves,[{questionId:'DO02',throughQuestionId:'DX01',answer:'A',preserveOriginalUnansweredReply:true}]);
  assert.deepEqual(records.deadlineCompletionOperationDecisionBatches[0].unanswered,[{questionId:'DO02',userReply:'没听懂',status:'clarification-required'}]);
  assert.equal(records.deadlineCompletionOperationDecisionBatches[0].answers.length,7);
  assert.equal(records.deadlineCompletionOperationRules.timeReacceptanceEntry.confirmed,false);
  assert.deepEqual(handoff.deadlineCompletionClarificationDecisionBatches,batches);
  assert.equal(records.discussionFormat.plainLanguageRequested,true);
  assert.equal(records.discussionFormatHistory[0].languageUserReply,'以后都直白点');
  assert.equal(records.discussionFormatHistory[0].questionsPerRound,8);
  assert.equal(records.discussionFormat.presentation,'table');
});

test('sixth-round time limits use elapsed hours and the previous expected end instead of the extension confirmation or old cutoff', () => {
  const r=records.deadlineCompletionClarificationRules;
  assert.deepEqual(handoff.deadlineCompletionClarificationRules,r);
  assert.equal(r.horizon.initialAnchor,'transaction-confirmation');
  assert.equal(r.horizon.initialMaxHours,r.horizon.initialMaxDays*24);
  assert.equal(r.horizon.initialMaxHours,720);
  assert.equal(r.horizon.extensionAnchor,'previous-effective-expected-end');
  assert.equal(r.horizon.extensionMaxHours,r.horizon.extensionMaxDays*24);
  assert.equal(r.horizon.extensionMaxHours,168);
  assert.equal(r.horizon.extensionMustBeLater,true);
  assert.equal(r.horizon.usesAutomaticCompletionCutoffAsAnchor,false);
  assert.equal(r.horizon.fixedDurationRequired,false);
  assert.equal(r.horizon.changesOther72HourWindows,false);
  const hour=60*60*1000;
  const confirmed=Date.parse('2026-10-14T10:00:00+08:00');
  const firstLatest=confirmed+r.horizon.initialMaxHours*hour;
  const extendedLatest=firstLatest+r.horizon.extensionMaxHours*hour;
  assert.equal(firstLatest,Date.parse('2026-11-13T10:00:00+08:00'));
  assert.equal(extendedLatest,Date.parse('2026-11-20T10:00:00+08:00'));
  assert.equal(extendedLatest+72*hour,Date.parse('2026-11-23T10:00:00+08:00'));
  const earlierExtensionConfirmation=Date.parse('2026-10-20T10:00:00+08:00');
  assert.notEqual(extendedLatest,earlierExtensionConfirmation+168*hour);
  assert.notEqual(extendedLatest,firstLatest+72*hour+168*hour);
  assert.deepEqual(r.timeReacceptanceEntry,{scope:'errand-before-selection',mode:'accept-new-time-on-existing-quote',quoteAmountUnchanged:true,currentTimeVersionExplicitAcceptanceRequired:true,addsPostSelectionWorkerAcceptance:false,resolvesOriginalQuestion:'DO02',sourceQuestion:'DX01'});
  const doc=read('docs/module-specs/deadline-completion-clarification-rules.md');
  for(const text of ['11月13日10:00','11月20日10:00','11月23日10:00','不是每次都必须延七天','在期限之后成功处理']) assert(doc.includes(text),text);
  assert(read('CONTEXT.md').includes('最多720小时'));
  assert(read('CONTEXT.md').includes('最多从该原时点延后连续168小时'));
});

test('issue submission and clearance preserve mutual agreement, pause on refusal, one outcome, history and truthful factual boundaries', () => {
  const r=records.deadlineCompletionClarificationRules;
  assert.deepEqual(r.issuePause,{appliesBeforeNormalAutomaticCompletion:true,submittedBy:'either-valid-transaction-party',categories:['not-completed','not-traded','cancellation-dispute'],explanationRequired:true,validSubmissionRequired:true,counterpartyAcknowledgmentRequired:false,submissionProvesClaim:false,preciseEvidenceFieldsConfirmed:false,postCompletionAutomaticRollback:false});
  assert.deepEqual(r.clearance,{pendingLimitPerIssue:1,proposedBy:'either-party',counterpartyExplicitSameVersionConfirmationRequired:true,initiatorMayWithdrawPending:true,editRequiresWithdrawalAndResubmission:true,successfulClearanceMayBeWithdrawn:false,refusalReasonRequired:false,refusalReasonMaxLength:300,refusalClosesRequest:true,refusalKeepsOriginalIssuePause:true,operationPriority:'first-server-successful-valid-operation',clientClickPriority:false,lateOperationRollsBackSuccess:false,singleSuccessfulClearance:true,restartAt:'max-clearance-success-and-current-effective-expected-end-plus-72h',repeatedRequestRestartsWindow:false,retainHistoryAndEvidence:true,operatorServiceAdjudicationGranted:false});
  for(const name of ['enabled','incomeRatingSoldAndRatesChanged','automaticDebit','provesCustomerPayment','readyForImplementation']) assert.equal(r[name],false,name);
  const doc=read('docs/module-specs/deadline-completion-clarification-rules.md');
  for(const text of ['不必等另一方承认有争议','提交成功不证明说法已核实','理由选填，最多300字','原异议继续暂停自动完成','后来的操作不推翻已成功结果','重复确认不能再增加一轮72小时','运营没有获得代双方裁决交付的权限']) assert(doc.includes(text),text);
});

test('remaining-question audit cannot fabricate a total, count technical checks as user questions or silently approve paused proposals', () => {
  const audit=records.remainingPlanningAuditHistory[0];
  assert.deepEqual(handoff.remainingPlanningAuditHistory[0],audit);
  assert.equal(audit.remainingQuestionCount,null);
  assert.equal(audit.totalVerified,false);
  assert.equal(audit.categoryCountIsQuestionCount,false);
  assert.equal(audit.newQuestionsPresented,false);
  assert.equal(audit.planningComplete,false);
  assert.equal(audit.userApprovedMissingAnswers,false);
  for(const name of ['excludeResolvedQuestions','excludeTechnicalTasks','excludeExternalEvidenceChecks','excludeSecondReleaseScope']) assert.equal(audit[name],true);
  const doc=read(audit.document);
  const groups=[...doc.matchAll(/^\| ([1-8])\. /gm)];
  assert.equal(groups.length,audit.knownGapCategoryCount);
  assert.equal(groups.length,8);
  assert(doc.includes('不是八道题'));
  assert(doc.includes('剩余题目总数暂不能准确给出'));
  assert(doc.includes('不能直接相加'));
  assert(doc.includes('仍未答'));
  const focus=records.planningFocusHistory[6];
  assert.deepEqual(handoff.planningFocusHistory[6],focus);
  assert.equal(focus.sourceBatch,'deadline-completion-round-6-20261014');
  assert.equal(focus.ruleDocument,'docs/module-specs/deadline-completion-clarification-rules.md');
  assert.equal(focus.backlogDocument,audit.document);
  assert.deepEqual(focus.pendingQuestionIds,[]);
  assert.deepEqual(focus.unresolvedOriginalQuestionIds,[]);
  assert.equal(focus.remainingQuestionCount,null);
  assert.equal(focus.planningComplete,false);
  assert.equal(focus.implementationEnabled,false);
  for(const f of ['docs/module-specs/deadline-completion-clarification-rules.md',audit.document]) {
    for(const match of read(f).matchAll(/\]\(([^)]+)\)/g)) assert(fs.existsSync(path.resolve(root,path.dirname(f),match[1])),`${f}: ${match[1]}`);
  }
  for(const f of ['docs/module-specs/README.md','docs/ui-development-handoff/README.md','docs/ui-development-handoff/business-addendum.md','docs/ui-development-handoff/page-spec.md','docs/ui-development-handoff/decisions-and-gaps.md']) {
    const text=read(f);assert(text.includes('结束期限第六轮确认：'));assert(text.includes('deadline-completion-clarification-rules.md'));assert(text.includes('remaining-planning-audit-20261014.md'));
  }
});

const expectedCommissionDetails = {
  confirmedAt: '2026-10-13', scope: ['跑腿', '维修', '闲置', '其它'], sourceBatch: 'commission-detail-round-14-20261013',
  rateConfiguration: { mode: 'per-business', numericRatesConfirmed: false },
  rateSnapshot: { at: 'transaction-confirmation', newRatesAffectExisting: false },
  billingPeriod: { at: 'successful-completion-or-sale-confirmation', timezone: 'Asia/Shanghai' },
  errandEligibility: { explicitCompletion: true, conditionalAutomaticCompletion: true, reference: 'RUN11', requiresNoObjectionDuring24Hours: true, changesRatingQualification: false, changesPersonalIncomeDefinition: false },
  adjustmentApproval: { mutualConfirmationRequired: true, operatorVerificationApprovalRequired: true, serviceMediationGranted: false, provesActualRefund: false },
  afterBillingAdjustment: { keepOriginalBill: true, recordDifferenceIn: 'next-month', automaticTransfer: false },
  collection: { mode: 'provider-seller-actively-pays-commission', customerPaysCounterpartyDirectly: true, automaticDebit: false },
  otherBusiness: { commissionIncluded: true, priceFloorFollowsRepair: true, rateConfiguredSeparately: true },
  readyForImplementation: false
};

test('fourteenth-round reply maps fourth B and other A answers without altering historical approvals', () => {
  assert.equal(records.commissionDetailDecisionBatches.length, 1);
  const batch = records.commissionDetailDecisionBatches[0];
  assert.equal(batch.id, 'commission-detail-round-14-20261013');
  assert.equal(batch.date, '2026-10-13');
  assert.equal(batch.userReply, '全A, 4B');
  assert.deepEqual(batch.scope, ['跑腿', '维修', '闲置', '其它']);
  assert.equal(batch.questionDocument, 'docs/module-specs/monthly-commission-questions-20261013.md');
  const questions = read(batch.questionDocument);
  assert(questions.includes('1A、2A、3A、4B、5A、6A、7A、8A'));
  const offered = [...questions.matchAll(/^\| [1-8]（(MC\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(offered.length, 8);
  assert.deepEqual(batch.answers.map(x => x.answer), ['A', 'A', 'A', 'B', 'A', 'A', 'A', 'A']);
  batch.answers.forEach((answer, index) => {
    assert.equal(answer.questionId, 'MC' + String(index + 1).padStart(2, '0'));
    assert.equal(answer.questionId, offered[index][1]);
    assert.equal(answer.selectedOption, offered[index][answer.answer === 'B' ? 4 : 3].trim());
  });
  assert.deepEqual(handoff.commissionDetailDecisionBatches, records.commissionDetailDecisionBatches);
  assert.deepEqual(records.commissionDetailRules, expectedCommissionDetails);
  assert.deepEqual(handoff.commissionDetailRules, expectedCommissionDetails);
  assert.deepEqual(records.commissionDesignApprovals[0].approvedRules.scope, ['跑腿', '维修', '闲置']);
  const income = handoff.items.find(x => x.id === 'HD02');
  assert.equal(income.confirmedHistory[0].include, '本人提供服务且已确认完成的服务费');
  assert.equal(income.completionIncomeResolutionHistory[0].topic,'自动完成计入口径');
  assert.equal(income.completionIncomeResolutionHistory[0].automaticCompletionAloneIncluded,false);
  assert(income.pendingHistory[0].includes('自动完成明细与后续交付确认/更正衔接'));
  assert.equal(income.confirmed.disclosure, '非到账金额');
  const doc = read('docs/module-specs/monthly-commission-detail-rules.md');
  assert(doc.includes('不从发布/期望时间/午夜起算'));
  assert(doc.includes('也不产生付款成功记录'));
  assert(doc.includes('自动完成计入口径仍为原待定事项'));
  assert(doc.includes('没有实现或验证真实费率配置'));
});

test('commission details prevent retroactive rates, completed bill overwrites and automatic income or settlement changes', () => {
  for (const mutate of [
    c => { c.scope = ['跑腿', '维修', '闲置']; },
    c => { c.rateConfiguration.numericRatesConfirmed = true; },
    c => { c.rateSnapshot.at = 'completion-time'; },
    c => { c.rateSnapshot.newRatesAffectExisting = true; },
    c => { c.billingPeriod.at = 'transaction-start-time'; },
    c => { c.errandEligibility.conditionalAutomaticCompletion = false; },
    c => { c.errandEligibility.requiresNoObjectionDuring24Hours = false; },
    c => { c.errandEligibility.changesRatingQualification = true; },
    c => { c.errandEligibility.changesPersonalIncomeDefinition = true; },
    c => { c.adjustmentApproval.mutualConfirmationRequired = false; },
    c => { c.adjustmentApproval.operatorVerificationApprovalRequired = false; },
    c => { c.adjustmentApproval.serviceMediationGranted = true; },
    c => { c.adjustmentApproval.provesActualRefund = true; },
    c => { c.afterBillingAdjustment.keepOriginalBill = false; },
    c => { c.afterBillingAdjustment.recordDifferenceIn = 'original-month'; },
    c => { c.afterBillingAdjustment.automaticTransfer = true; },
    c => { c.collection.automaticDebit = true; },
    c => { c.collection.customerPaysCounterpartyDirectly = false; },
    c => { c.otherBusiness.priceFloorFollowsRepair = false; },
    c => { c.otherBusiness.rateConfiguredSeparately = false; },
    c => { c.readyForImplementation = true; }
  ]) {
    const changed = structuredClone(records.commissionDetailRules);
    mutate(changed);
    assert.throws(() => assert.deepEqual(changed, expectedCommissionDetails));
  }
});

const expectedCommissionPrinciples = {
  scope: ['跑腿', '维修', '闲置'], incomeDirection: 'monthly-proportional-commission',
  initialAmount: { source: 'initial-mutually-confirmed-transaction-price', locked: true, preserveOriginalRecord: true, perBusinessMappingConfirmed: false },
  ordinaryPriceChanges: { minimum: 'initial-locked-price', increaseRequiresMutualConfirmation: true, preserveHistory: true },
  adjustments: { separateRecords: true, reasons: ['退款', '减免', '误录'], preserveReason: true, preserveEvidence: true, preserveConfirmation: true, overwriteOriginal: false, approvalRouteConfirmed: false },
  billing: { cadence: 'month-end', source: 'eligible-confirmed-transaction-records', readsEditableDisplayPrice: false, eligibleStates: ['已完成', '已成交'], allCompletionModesConfirmed: false }
};
function verifyCommissionApproval(data) {
  assert.equal(data.commissionDesignApprovals.length, 1);
  const approval = data.commissionDesignApprovals[0];
  assert.equal(approval.userReply, '没问题, 继续');
  assert.equal(approval.approvalKind, 'previous-recommendation-approval-not-table-all-A');
  assert.deepEqual(approval.approvedRules, expectedCommissionPrinciples);
  assert.equal(approval.readyForImplementation, false);
  assert(approval.pending.length >= 6);
}

test('commission recommendation approval is dated, synchronized and distinct from unselected table options', () => {
  verifyCommissionApproval(records);
  verifyCommissionApproval(handoff);
  assert.deepEqual(handoff.commissionDesignApprovals, records.commissionDesignApprovals);
  const approval = records.commissionDesignApprovals[0];
  assert.equal(approval.date, '2026-10-13');
  assert.equal(approval.rulesDocument, 'docs/module-specs/monthly-commission-rules.md');
  assert.equal(approval.sourceDocument, 'docs/module-specs/monthly-commission-request-20261013.md');
  assert.equal(approval.nextQuestionsDocument, 'docs/module-specs/monthly-commission-questions-20261013.md');
  const rules = read(approval.rulesDocument);
  assert(rules.includes('仅已完成/已成交的交易计入佣金'));
  assert(rules.includes('新增独立调整不是重新开放原费用编辑'));
  assert(rules.includes('不把记录当退款已到账'));
  assert(rules.includes('第十四轮已确认其它纳入'));
  assert.equal(Object.hasOwn(records, 'priceFloorDecisionBatches'), false);
  assert.equal(handoff.items.find(x => x.id === 'HD02').confirmed.business, '跑腿');
});

test('commission principles reject editable billing prices, unfinished orders, overwritten refunds and invented fees', () => {
  for (const mutate of [
    c => { c.scope.push('其它'); },
    c => { c.initialAmount.source = 'published-budget'; },
    c => { c.initialAmount.locked = false; },
    c => { c.initialAmount.perBusinessMappingConfirmed = true; },
    c => { c.ordinaryPriceChanges.minimum = 'none'; },
    c => { c.ordinaryPriceChanges.increaseRequiresMutualConfirmation = false; },
    c => { c.adjustments.separateRecords = false; },
    c => { c.adjustments.overwriteOriginal = true; },
    c => { c.adjustments.preserveEvidence = false; },
    c => { c.adjustments.approvalRouteConfirmed = true; },
    c => { c.billing.readsEditableDisplayPrice = true; },
    c => { c.billing.eligibleStates.push('已选人'); },
    c => { c.billing.allCompletionModesConfirmed = true; },
    c => { c.billing.rate = 0.05; },
    c => { c.billing.automaticDebit = true; }
  ]) {
    const changed = structuredClone(records);
    mutate(changed.commissionDesignApprovals[0].approvedRules);
    assert.throws(() => verifyCommissionApproval(changed));
  }
});

test('monthly commission direction preserves the human purpose and does not select a rate or collection method', () => {
  assert.equal(records.commissionPlanningRequests.length, 1);
  const request = records.commissionPlanningRequests[0];
  assert.equal(request.date, '2026-10-13');
  assert.equal(request.status, 'user-planned-direction');
  assert.equal(request.userReply, '我计划的抽佣方式为，在每月月末，根据骑手及维修员的服务费，以及闲置卖家的成交价格，按比例抽佣。所以我担心有骑手，维修员以及卖家为了避开抽佣，会在确认进行交易后，与客户协商修改价格。\n所以我希望在修改价格时, 不能低于初始值. 你认为呢?');
  assert.deepEqual(request.statedPlan, {
    billing: 'each-month-end', method: 'proportional',
    bases: [{ actor: '骑手', amount: '服务费' }, { actor: '维修员', amount: '服务费' }, { actor: '闲置卖家', amount: '成交价格' }],
    priceFloorPurpose: 'prevent-post-confirmation-underreporting-for-commission'
  });
  assert.equal(request.readyForImplementation, false);
  assert(request.pending.length >= 6);
  assert.deepEqual(handoff.commissionPlanningRequests, records.commissionPlanningRequests);
  for (const key of ['rate', 'eligibleStatus', 'collectionMethod', 'automaticDebit', 'refundPolicy', 'appliesToOther']) {
    assert.equal(Object.hasOwn(request.statedPlan, key), false);
  }
  assert.equal(Object.hasOwn(records, 'priceFloorDecisionBatches'), false);
  assert.equal(records.priceFloorRequests[0].readyForImplementation, false);
});

test('commission evaluation keeps the old baseline, operational limitations and suggestions distinct', () => {
  const doc = read(records.commissionPlanningRequests[0].requestDocument);
  assert(doc.includes('原建议与评估记录'));
  assert(doc.includes('用户已确认通用方案'));
  assert(doc.includes('月底账单使用明确的计费记录，不读取可随时改动的当前展示价'));
  assert(doc.includes('初始就少报价格、虚假取消后线下成交'));
  assert(doc.includes('不确认实际资格或替用户选择支付方式'));
  assert(doc.includes('https://pay.wechatpay.cn/doc/v3/partner/4012072582'));
  assert(doc.includes('第十三轮8题'));
  assert(read('docs/prd-v1.5-archive-20261015.md').includes('平台不代收、不代结算、不抽跑腿佣金')); // Historical baseline only; current monthly commission is in PRD 2.0.
  assert.equal(handoff.items.find(x => x.id === 'HD02').confirmed.business, '跑腿');
  for (const item of records.items) assert.equal(item.fullWorkflowReady, false);
});

const expectedFeeAgreement = {
  recordedInMiniapp: true,
  requiresBothPartiesConfirmation: true,
  confirmationTiming: 'before-each-charge-stage',
  itemization: {
    mode: 'separate-service-and-expenses', expenseExamples: ['材料', '配件', '商品'], showTotal: true,
    inspectionFeeCategory: 'service-fee', visitFeeCategory: 'service-fee', namedServiceItemsSeparatelyListed: true,
    minItems: 1, maxItems: 20,
    fields: {
      name: { required: true, minLength: 1, maxLength: 30 },
      category: { required: true, allowed: ['服务费', '实际支出'] },
      amount: { required: true, maxInput: 99999.99 }, remark: { required: false, maxLength: 300 }
    }
  },
  initiation: { allowedParties: ['发布者', '接单员'], submissionAcknowledgesVersion: true, effectiveAfterCounterpartyConfirmation: true, selectedWorkerOnly: true },
  changes: { addOrModifyItems: true, requiresBothPartiesConfirmation: true, previousVersionEffectiveUntilConfirmed: true },
  pendingProposalLimit: 1,
  noResponse: { remainsPending: true, reminderAllowed: true, withdrawableByInitiator: true, autoConsent: false },
  cancellation: { serviceMayBeCancelledBeforeExpenseAgreement: true, incurredExpensesNegotiatedSeparately: true, impliesSettled: false },
  receipts: {
    required: false, supported: ['票据', '照片'], maxCount: 3, countScope: 'per-expense-item',
    formats: ['JPEG', 'PNG'], maxSizeMB: 5, visibility: 'service-parties-while-ongoing',
    afterServiceEndVisibility: 'neither-party', public: false, operatorAccessGranted: false
  },
  advance: {
    voluntary: true, requiresPriorMutualConfirmation: true, confirmWhetherToAdvance: true, confirmLimit: true,
    recordedWithFeeProposal: true, limitRequiredWhenWilling: true, limitMustBePositive: false,
    zeroLimitMeansNoActualAdvance: true, emptyLimitIsUnlimited: false,
    notWillingLimitPolicy: { hide: true, clearCurrentFormValue: true, preserveHistoricalAgreements: true },
    overLimitPolicy: { requiresNewFeeProposalAndLimit: true, requiresBothPartiesConfirmation: true, pauseAffectedAdvanceUntilConfirmed: true, autoCancelService: false }
  },
  zeroServiceFeeAllowed: true,
  creationStage: 'after-successful-selection',
  formalAmountPolicy: { currentStageAmountsMustBeKnown: true, estimatedItemsAllowed: false, unknownFutureItems: 'omit-until-later-stage', unknownAmountsDefaultToZero: false },
  pendingVersionEditing: { mode: 'withdraw-before-resubmit', preserveHistory: true },
  refusalRules: { reasonRequired: false, endsPendingProposal: true, previousAgreementRemainsEffective: true, allowsNewProposal: true, endsService: false },
  stageName: { mode: 'preset-or-custom', presets: ['上门检查', '服务处理', '补充费用'], customName: { minLength: 1, maxLength: 30 } },
  postCompletionChanges: false,
  maxTotal: 99999.99,
  reopeningPolicy: {
    copyAsNewDraftAllowed: true, requiresNewSubmission: true, requiresNewPartiesConfirmation: true,
    inheritsAgreement: false, inheritsAdvanceAuthorization: false, oldReceiptAccessGranted: false,
    copyActors: 'new-service-parties-with-existing-old-proposal-access',
    copyFields: ['阶段', '费用项目文字', '金额', '备注'], copyAdvanceConditions: false, copyReceipts: false
  },
  completionWithPendingProposal: 'resolve-before-completion-confirmation',
  cancelPendingProposal: {
    onlyIncurredKeepsPending: true, containsUnincurredCloses: true, preserveClosedHistory: true,
    reproposalAllowed: true, blocksCancellation: false, autoConsent: false,
    incurredClassification: { mode: 'both-parties-agree-all-incurred', disagreementCloses: true, unknownCloses: true, preserveHistory: true, reproposalAllowed: true, blocksCancellation: false, approvesAmounts: false }
  },
  zeroExpenseAllowed: true,
  stageOrganization: { mode: 'independent-stages', modificationReplaces: 'same-stage-version', serviceTotal: 'sum-current-effective-stage-versions', pendingIncluded: false, oldVersionsIncluded: false },
  maxServiceTotal: 99999.99
};

const expectedApplicationRules = {
  activePerPersonPerRequest: 1, editableBeforeSelection: true, withdrawableBeforeSelection: true,
  repeatedSubmitCreatesNew: false, reapplication: { allowedWhenOpen: true, cooldownHours: 0 }, individualRejectionAllowed: false,
  visibility: { publisher: 'all-applications-on-own-demand', applicant: 'own-only', others: 'none', expandsContactOrAddressAccess: false },
  candidateDisplay: { fields: ['说明', '预估服务费', '申请时间'], hideEmptyDescription: true, missingFeeLabel: '待协商' },
  sorting: { field: 'effective-application-time', direction: 'ascending', modificationTimePolicy: 'keep-current-application-first-effective-submit', reapplicationTimePolicy: 'new-successful-submit-time' },
  openingDeadline: { scope: 'before-selection', autoExpires: false, publisherMayClose: true },
  publisherClosing: {
    scope: 'before-selection', allowedWithActiveApplications: true, endsActiveApplications: true, notifyApplicants: true, preserveHistory: true, impliesDeletion: false, allowsUnilateralServiceCancellation: false,
    reopening: { scope: 'closed-before-selection', initiator: 'publisher', sameRequest: true, freshApplicationsRequired: true, restoreOldApplications: false, productCountLimit: null, preserveEveryCloseAndReopen: true, latestListTime: 'successful-reopen-time', preserveOriginalPublicationTime: true, ordinaryEditBumpsList: false },
    reasonRules: { required: false, maxLength: 300 },
    selectionConflictPolicy: { mode: 'first-server-success-wins', laterOperationExecutes: false, promptRefresh: true, rollbackSuccessfulResult: false, clientClickOrderDecides: false }
  },
  versionHistory: { preserveSubmittedVersions: true, viewers: ['该需求发布者', '对应申请者'], public: false },
  editNotification: { notifyPublisher: true, listMark: '已修改' },
  invalidatedReapplication: { allowedWhenOpen: true, cooldownHours: 0, preserveInvalidatedHistory: true, selectInvalidatedApplication: false }
};
const expectedSelectionRules = {
  effectiveAfterPublisherSelectionSuccess: true, workerReconfirmationRequired: false,
  otherApplications: { end: true, notify: true, autoReplacement: false }
};
const expectedApplicationFields = {
  description: { required: false, maxLength: 300 },
  estimatedServiceFee: { required: false, missingLabel: '待协商', isFeeAgreement: false }
};
const expectedContactVisibility = {
  beforeSelection: 'masked', afterSuccessfulSelection: 'selected-parties-only', otherApplicants: 'masked',
  privateAddress: { optionalAtPublishing: true, public: false, releaseTo: 'selected-worker-only' },
  afterServiceEnd: { completedContact: 'masked', cancelledContact: 'masked', selectedWorkerFullAddressAccess: false, publisherMayManageOwnAddress: true }
};
const expectedPendingChangeEnd = { closePendingChanges: true, preserveHistory: true, impliesConsent: false, blocksServiceEnding: false };
const expectedDemandChanges = {
  beforeSelection: { watched: ['服务内容', '区域', '时间'], invalidateApplications: true, notifyApplicants: true, reapplyRequired: true, criticalFields: ['标题', '描述', '图片', '公开区域', '服务时间'] },
  afterSelection: {
    watched: ['服务内容', '区域'], requiresBothPartiesConfirmation: true, previousVersionEffectiveUntilConfirmed: true, onServiceEnd: expectedPendingChangeEnd,
    initiators: ['发布者', '接单员'], scope: 'after-successful-selection-before-service-end', pendingLimit: 1,
    editingPolicy: { initiatorWithdrawalAllowed: true, mode: 'withdraw-before-resubmit', preserveHistory: true, confirmedOutcomeWithdrawalAllowed: false },
    refusalRules: { reasonRequired: false, reasonMaxLength: 300, endsPendingProposal: true, preserveHistory: true, changesPreviousContent: false, endsService: false },
    noResponse: { remainsPending: true, autoConsent: false, autoClose: false, previousContentRemainsEffective: true }
  }
};
const expectedEvidenceFields = {
  description: { required: true, minLength: 1, maxLength: 500 },
  attachments: { required: false, minCount: 0, maxCount: 9, formats: ['JPEG', 'PNG'], maxSizeMB: 5 }
};
const expectedRefusalRules = {
  allowed: true, reasonRequired: true, endsService: false, nextActions: ['继续协商', '提出异议'], reasonMinLength: 1, reasonMaxLength: 500
};
const expectedCompletionRules = {
  initiator: 'selected-worker', requiresPublisherConfirmation: true,
  noResponse: { remainsPending: true, autoComplete: false, reminderAllowed: true, objectionAllowed: true },
  evidenceFields: expectedEvidenceFields, refusalRules: expectedRefusalRules, pendingPerService: 1
};
const expectedCancellationRules = {
  initiators: ['发布者', '接单员'], requiresCounterpartyConfirmation: true, scope: 'after-selection-before-completion',
  noResponse: { remainsPending: true, autoCancel: false, reminderAllowed: true, objectionAllowed: true },
  evidenceFields: expectedEvidenceFields, refusalRules: expectedRefusalRules, pendingPerService: 1
};
const expectedAppointmentRules = {
  required: false, requiresBothPartiesConfirmation: true, changesRequireBothPartiesConfirmation: true,
  initiators: ['发布者', '接单员'], pendingLimit: 1, scope: 'after-successful-selection-before-service-end', pendingChangesReplaceEffectiveTime: false,
  timeFields: { mode: 'single-start-time', precision: 'minute' },
  pastTimePolicy: { futureOnly: true, reference: 'server-time', allowHistoryBackfill: false, strictlyAfterCurrentTime: true },
  pendingTimePassedPolicy: { scope: 'pending-future-appointment', closeAt: 'proposed-start-time', preserveHistory: true, changesPreviousAppointment: false, changesServiceState: false, autoConsent: false },
  editingPolicy: { initiatorWithdrawalAllowed: true, mode: 'withdraw-before-resubmit', preserveHistory: true },
  refusalRules: { reasonRequired: false, reasonMaxLength: 300, endsPendingProposal: true, preserveHistory: true, changesPreviousAppointment: false, endsService: false },
  clearEffectiveAppointmentPolicy: {
    requiresBothPartiesConfirmation: true, preserveHistory: true, endsService: false,
    sharedPendingLimit: 1, sharedWith: ['预约', '改期', '清除预约'],
    noResponse: { remainsPending: true, autoClear: false, autoClose: false, previousAppointmentRemainsEffective: true },
    editingPolicy: { initiatorWithdrawalAllowed: true, mode: 'withdraw-before-resubmit', preserveHistory: true, confirmedOutcomeWithdrawalAllowed: false },
    refusalRules: { reasonRequired: false, reasonMaxLength: 300, endsPendingProposal: true, preserveHistory: true, changesPreviousAppointment: false, endsService: false }
  },
  onServiceEnd: expectedPendingChangeEnd,
  overduePolicy: { markTimePassed: true, autoComplete: false, autoCancel: false, autoReminder: false, newOverdueCharge: false, newPenalty: false }
};
const expectedReopeningRules = {
  afterConfirmedCancellation: true, initiator: 'publisher', sameRequest: true,
  freshApplicationsRequired: true, restoreOldApplications: false, preserveServiceAndFeeHistory: true
};
const expectedTerminationRequests = {
  completionAndCancellationMayCoexist: true, endingPolicy: 'first-effective-confirmation', closeOtherOnEnd: true, preserveOtherHistory: true,
  editingPolicy: { scope: 'pending-request-before-service-end', initiatorWithdrawalAllowed: true, mode: 'withdraw-before-resubmit', preserveHistory: true, confirmedOutcomeWithdrawalAllowed: false },
  refusedRequestPolicy: { mode: 'end-request-allow-resubmit', preserveHistory: true, serviceContinues: true }
};
const expectedDisputeRules = {
  recordOnly: true, partiesNegotiate: true, operatorServiceMediation: false, existingReportAndRatingAppealUnaffected: true,
  objectionFields: expectedEvidenceFields
};
const expectedRatingRules = business => ({
  business, usesExistingSystem: true, mutual: true,
  qualification: { trigger: 'publisher-confirmed-completion', requiresWorkerCompletionRequest: true, additionalExperienceConfirmationRequired: false, cancellationCreatesQualification: false },
  statistics: { business, byRatedRole: true, separateFromOtherBusinesses: true },
  preserveExistingValidQualificationsAndRatings: true
});

function verify(value) {
  assert.deepEqual(value.items.map(item => item.id), ['MP01', 'MP02']);
  const [other, repair] = value.items;
  assert.equal(other.userReply, '业务还包括"其它"');
  assert.equal(other.confirmed.businessModule, true);
  assert.equal(other.confirmed.name, '其它');
  assert.deepEqual(other.confirmed.excludeCategories, ['维修', '跑腿', '闲置']);
  assert.equal(other.confirmed.purpose, '整理其它需求数据，作为后续更新迭代依据');
  assert.equal(other.followUp[0].userReply, '除了"维修、跑腿、闲置", 方便为后续更新迭代整理数据');
  assert.equal(other.confirmed.publicPublishing, true);
  assert.equal(other.confirmed.applicationsAllowed, true);
  assert.equal(other.followUp[1].userReply, 'A');
  assert.equal(other.followUp[1].selectedOption, '公开发布并允许申请接单：用户可以实际找到人处理需求，同时积累分类数据');
  assert(!other.pending.includes('公开接单或仅收集需求'));
  assert.equal(other.confirmed.matchingMode, 'apply-then-publisher-selects');
  assert.equal(other.followUp[2].userReply, 'A');
  assert.equal(other.followUp[2].selectedOption, '先申请，发布者再选人：发布者比较申请者后决定，与维修的选人方向一致；报价规则另议');
  assert(!other.pending.includes('申请后的选人模式'));
  assert(other.pending.includes('申请同时间排序/历史展示/关闭理由可见范围、取消后重开排序及并发实现'));
  assert.equal(other.confirmed.quoteRequiredAtApplication, false);
  assert.equal(Object.hasOwn(other.confirmed, 'defaultServiceFee'), false);
  assert.equal(other.confirmed.selectedWorkerCount, 1);
  assert.equal(repair.userReply, 'A');
  assert.equal(repair.confirmed.matchingMode, 'apply-then-publisher-selects');
  assert.equal(repair.confirmed.quoteRequiredAtApplication, false);
  for (const item of value.items) {
    assert.equal(item.confirmed.selectedWorkerCount, 1);
    assert.deepEqual(item.confirmed.applicantLimit, { kind: 'no-product-cap' });
    assert.deepEqual(item.confirmed.applicationRules, expectedApplicationRules);
    assert.deepEqual(item.confirmed.selectionRules, expectedSelectionRules);
    assert.deepEqual(item.confirmed.applicationFields, expectedApplicationFields);
    assert.deepEqual(item.confirmed.contactVisibility, expectedContactVisibility);
    assert.deepEqual(item.confirmed.demandChanges, expectedDemandChanges);
    assert.deepEqual(item.confirmed.completionRules, expectedCompletionRules);
    assert.deepEqual(item.confirmed.cancellationRules, expectedCancellationRules);
    assert.deepEqual(item.confirmed.appointmentRules, expectedAppointmentRules);
    assert.deepEqual(item.confirmed.reopeningRules, expectedReopeningRules);
    assert.deepEqual(item.confirmed.terminationRequests, expectedTerminationRequests);
    assert.deepEqual(item.confirmed.disputeRules, expectedDisputeRules);
    assert.deepEqual(item.confirmed.ratingRules, expectedRatingRules(item.id === 'MP01' ? '其它' : '维修'));
    assert.deepEqual(item.confirmed.feeAgreement, expectedFeeAgreement);
    assert.deepEqual(item.confirmed.concurrentTaskLimit, { kind: 'no-product-cap' });
    assert.equal(item.fullWorkflowReady, false);
    assert(item.pending.length >= 5);
    assert.equal(handoff.items.find(row => row.id === item.handoffDecision).productionAllowed, false);
  }
}

test('actual answers include other business and repair application mode without approving unfinished workflows', () => {
  verify(records);
  const repair = handoff.items.find(item => item.id === 'HD01');
  assert.equal(repair.followUp[0].userReply, 'A');
  assert(repair.confirmed.includes('申请时不强制报价'));
  assert.equal(handoff.items.find(item => item.id === 'HD04').userReply, records.items[0].userReply);
  assert.equal(handoff.items.find(item => item.id === 'HD04').status, 'public-business-approved-rules-pending');
  for (const mutation of [
    data => { data.items[0].confirmed.businessModule = false; },
    data => { data.items[0].confirmed.excludeCategories = ['维修']; },
    data => { data.items[0].confirmed.purpose = '所有需求均可直接抢单'; },
    data => { data.items[0].confirmed.publicPublishing = false; },
    data => { data.items[0].confirmed.applicationsAllowed = false; },
    data => { data.items[0].followUp[1].selectedOption = '仅收集需求'; },
    data => { data.items[0].confirmed.matchingMode = 'first-come-first-served'; },
    data => { data.items[0].confirmed.quoteRequiredAtApplication = true; },
    data => { data.items[0].confirmed.defaultServiceFee = 0; },
    data => { data.items[0].confirmed.selectedWorkerCount = 2; },
    data => { data.items[1].confirmed.selectedWorkerCount = 2; },
    data => { data.items[0].confirmed.applicantLimit = { kind: 'fixed', count: 1 }; },
    data => { data.items[1].confirmed.applicantLimit = null; },
    data => { data.items[0].confirmed.concurrentTaskLimit = null; },
    data => { data.items[0].confirmed.applicationRules.activePerPersonPerRequest = 2; },
    data => { data.items[1].confirmed.applicationRules.withdrawableBeforeSelection = false; },
    data => { data.items[0].confirmed.applicationRules.repeatedSubmitCreatesNew = true; },
    data => { data.items[0].confirmed.contactVisibility.beforeSelection = 'full'; },
    data => { data.items[1].confirmed.contactVisibility.otherApplicants = 'full'; },
    data => { data.items[0].confirmed.contactVisibility.afterSuccessfulSelection = 'all-applicants'; },
    data => { data.items[0].confirmed.feeAgreement.recordedInMiniapp = false; },
    data => { data.items[1].confirmed.feeAgreement.requiresBothPartiesConfirmation = false; },
    data => { data.items[0].confirmed.feeAgreement.paid = true; },
    data => { data.items[0].confirmed.feeAgreement.itemization.mode = 'total-only'; },
    data => { data.items[1].confirmed.feeAgreement.itemization.showTotal = false; },
    data => { data.items[0].confirmed.feeAgreement.confirmationTiming = 'after-service-completion'; },
    data => { data.items[1].confirmed.feeAgreement.requiresPrepayment = true; },
    data => { data.items[0].pending = data.items[0].pending.filter(item => item !== '申请同时间排序/历史展示/关闭理由可见范围、取消后重开排序及并发实现'); },
    data => { data.items[1].confirmed.matchingMode = 'first-come-first-served'; },
    data => { data.items[1].confirmed.quoteRequiredAtApplication = true; },
    data => { data.items[0].fullWorkflowReady = true; }
  ]) {
    const changed = structuredClone(records);
    mutation(changed);
    assert.throws(() => verify(changed));
  }
});

test('fee recording and mutual confirmation are approved without inventing payment or individual entries', () => {
  const [other, repair] = records.items;
  const answer = other.followUp[8];
  assert.equal(answer.date, '2026-10-11');
  assert.equal(answer.userReply, 'A');
  assert.equal(answer.selectedOption, '维修和其它协商后的费用在小程序内记录并由双方确认；记录金额不代表已经付款；费用明细和确认时点另议');
  assert.deepEqual(repair.followUp[4], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD01').followUp[5], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD04').followUp[8], answer);
  for (const item of records.items) {
    assert.equal(Object.hasOwn(item.confirmed.feeAgreement, 'stage'), false);
    assert.equal(Object.hasOwn(item.confirmed.feeAgreement, 'items'), false);
    assert.equal(Object.hasOwn(item.confirmed.feeAgreement, 'paid'), false);
    assert(item.pending.some(text => text.includes('费用字段')));
  }
  const earnings = handoff.items.find(item => item.id === 'HD02').confirmed;
  assert.equal(earnings.business, '跑腿');
  assert.equal(earnings.wallet, false);
  assert(read('docs/module-specs/README.md').includes('不新增平台代收、余额或自动结算'));
});

test('original itemization answer is retained and inspection or visit charges now use approved service-fee classification', () => {
  const [other, repair] = records.items;
  const answer = other.followUp[9];
  assert.equal(answer.date, '2026-10-11');
  assert.equal(answer.userReply, 'A');
  assert.equal(answer.selectedOption, '维修和其它费用分项记录：服务费与材料、配件、商品等实际支出分开，页面同时显示合计；检查费、上门费等具体归类另议');
  assert.deepEqual(repair.followUp[5], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD01').followUp[6], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD04').followUp[9], answer);
  for (const item of records.items) {
    const fees = item.confirmed.feeAgreement;
    assert.equal(fees.itemization.inspectionFeeCategory, 'service-fee');
    assert.equal(fees.itemization.visitFeeCategory, 'service-fee');
    assert.equal(fees.itemization.namedServiceItemsSeparatelyListed, true);
    assert.equal(Object.hasOwn(fees.itemization, 'unknownAmountDefault'), false);
    assert.equal(Object.hasOwn(fees, 'stage'), false);
  }
  assert(read('docs/module-specs/README.md').includes('不是三项必填或封闭枚举'));
  assert(read('docs/ui-development-handoff/page-spec.md').includes('页面同时显示合计'));
});

test('contact and optional private address release follow selection and confirmed ending restricts access without deleting owner data', () => {
  const [other, repair] = records.items;
  const answer = other.followUp[7];
  assert.equal(answer.date, '2026-10-11');
  assert.equal(answer.userReply, 'A');
  assert.equal(answer.selectedOption, '维修和其它选定成功后，发布者与选中的接单员互看完整联系方式；其他申请者仍看打码信息');
  assert.deepEqual(repair.followUp[3], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD01').followUp[4], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD04').followUp[7], answer);
  for (const item of records.items) {
    assert.deepEqual(item.confirmed.contactVisibility.privateAddress, expectedContactVisibility.privateAddress);
    assert.deepEqual(item.confirmed.contactVisibility.afterServiceEnd, expectedContactVisibility.afterServiceEnd);
    assert(item.pending.some(text => text.includes('联系变更/撤销')));
  }
  assert(read('docs/module-specs/README.md').includes('不能把完整信息下发后仅在页面打码'));
  assert(read('docs/module-specs/README.md').includes('闲置、免费服务目录及其推广仍沿用原CT03'));
  assert(read('docs/ui-development-handoff/business-addendum.md').includes('旧流程切换和历史关系迁移待明确'));
});

test('planning references resolve and existing handoff points to the new confirmed decisions', () => {
  const entry = 'docs/module-specs/README.md';
  const document = read(entry);
  for (const match of document.matchAll(/\]\(([^)]+)\)/g)) {
    assert(fs.existsSync(path.resolve(root, path.dirname(entry), match[1])), match[1]);
  }
  assert(read('docs/prd.md').includes('module-specs/README.md'));
  assert(read('docs/ui-development-handoff/README.md').includes('../module-specs/README.md'));
  assert(read('docs/ui-development-handoff/business-addendum.md').includes('申请时不强制报价'));
  assert(read('docs/ui-development-handoff/page-spec.md').includes('其它属于业务模块'));
});

test('other publisher selection mode is synchronized while remaining visibility and workflow gaps are retained', () => {
  const other = handoff.items.find(item => item.id === 'HD04');
  assert.equal(other.followUp[0].userReply, records.items[0].followUp[0].userReply);
  assert(other.confirmed.includes('为后续更新迭代提供依据'));
  assert.deepEqual(other.followUp[1], records.items[0].followUp[1]);
  assert(other.confirmed.includes('允许公开发布并申请接单'));
  assert.deepEqual(other.followUp[2], records.items[0].followUp[2]);
  assert(other.confirmed.includes('先申请再由发布者选人'));
  assert(other.pending.includes('申请同时间排序/历史展示/关闭理由可见范围、取消后重开排序及并发实现'));
  assert(read('CONTEXT.md').includes('先申请再由发布者选1位接单员'));
  assert(read('docs/module-specs/README.md').includes('归类原则和整理数据目的已确认'));
  assert(read('docs/ui-development-handoff/business-addendum.md').includes('没有自动批准新增采集方案'));
});

test('other optional quote answer is retained and the approved estimate remains distinct from formal fee confirmation', () => {
  const other = records.items[0];
  const answer = other.followUp[5];
  assert.equal(answer.date, '2026-10-11');
  assert.equal(answer.userReply, 'A');
  assert.equal(answer.selectedOption, '其它申请时不强制填写服务费报价；允许先申请，金额后续协商');
  const handoffOther = handoff.items.find(item => item.id === 'HD04');
  assert.deepEqual(handoffOther.followUp[5], answer);
  assert(handoffOther.confirmed.includes('申请时不强制填写服务费报价'));
  assert(handoffOther.pending.some(text => text.includes('费用字段映射/阶段标识与排序')));
  assert.equal(Object.hasOwn(other.confirmed, 'feeAgreementStage'), false);
  assert.deepEqual(other.confirmed.applicationFields, expectedApplicationFields);
  assert(other.pending.some(text => text.includes('费用字段')));
  assert(read('docs/module-specs/README.md').includes('不强制报价不代表免费'));
});

test('phased confirmation precedes each charge stage without inventing prepayment or mandatory inspection charges', () => {
  const [other, repair] = records.items;
  const answer = other.followUp[10];
  assert.equal(answer.date, '2026-10-11');
  assert.equal(answer.userReply, 'A');
  assert.equal(answer.selectedOption, '维修和其它分阶段、收费前确认费用；上门检查若收费先确认该费用，诊断后再确认维修和配件费用');
  assert.deepEqual(repair.followUp[6], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD01').followUp[7], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD04').followUp[10], answer);
  for (const item of records.items) {
    assert.equal(item.confirmed.feeAgreement.confirmationTiming, 'before-each-charge-stage');
    assert.equal(Object.hasOwn(item.confirmed.feeAgreement, 'requiresPrepayment'), false);
    assert.equal(Object.hasOwn(item.confirmed.feeAgreement, 'mandatoryInspectionCharge'), false);
  }
  assert(read('docs/module-specs/README.md').includes('不代表付款必须预付'));
});

test('fee batch all-A reply is mapped to exactly the eight offered options and synchronized to handoff', () => {
  assert.equal(records.discussionFormatHistory[0].questionsPerRound,8);
  assert.equal(records.discussionFormatHistory[0].userReply, '一次问我八个问题, 否则进度太慢了');
  const questions = read('docs/module-specs/fee-questions-20261011.md');
  assert(questions.includes('8题全部选择A'));
  assert.deepEqual([...questions.matchAll(/（(FQ\d{2})）/g)].map(match => match[1]), Array.from({length: 8}, (_, index) => `FQ${String(index + 1).padStart(2, '0')}`));
  assert(read('docs/module-specs/README.md').includes('每轮集中提出8个'));
  assert(read('docs/module-specs/README.md').includes('按钮轻微放大缩小等细微反馈'));
  assert.equal(records.feeDecisionBatches.length, 3);
  const batch = records.feeDecisionBatches[0];
  assert.equal(batch.userReply, '全A');
  assert.equal(batch.date, '2026-10-11');
  assert.deepEqual(batch.scope, ['维修', '其它']);
  assert.equal(batch.questionDocument, 'docs/module-specs/fee-questions-20261011.md');
  assert.deepEqual(batch.answers.map(answer => answer.questionId), Array.from({ length: 8 }, (_, index) => `FQ${String(index + 1).padStart(2, '0')}`));
  const originalOptions = [...questions.matchAll(/（(FQ\d{2})）\r?\n\r?\nA：(.+?)B：/g)];
  for (const [index, answer] of batch.answers.entries()) {
    assert.equal(answer.answer, 'A');
    assert.equal(answer.selectedOption, originalOptions[index][2].trim().replace(/。$/, ''));
  }
  assert.deepEqual(handoff.feeDecisionBatches, records.feeDecisionBatches);
});

test('fee integrity checks reject unapproved unilateral version replacement, automatic consent, settlement and compulsory evidence or advances', () => {
  verify(records);
  for (const mutate of [
    fee => { fee.itemization.inspectionFeeCategory = 'expense'; },
    fee => { fee.itemization.namedServiceItemsSeparatelyListed = false; },
    fee => { fee.initiation.allowedParties = ['接单员']; },
    fee => { fee.initiation.submissionAcknowledgesVersion = false; },
    fee => { fee.initiation.effectiveAfterCounterpartyConfirmation = false; },
    fee => { fee.changes.requiresBothPartiesConfirmation = false; },
    fee => { fee.changes.previousVersionEffectiveUntilConfirmed = false; },
    fee => { fee.pendingProposalLimit = 2; },
    fee => { fee.noResponse.autoConsent = true; },
    fee => { fee.noResponse.autoCloseHours = 24; },
    fee => { fee.noResponse.withdrawableByInitiator = false; },
    fee => { fee.cancellation.serviceMayBeCancelledBeforeExpenseAgreement = false; },
    fee => { fee.cancellation.impliesSettled = true; },
    fee => { fee.receipts.required = true; },
    fee => { fee.advance.voluntary = false; },
    fee => { fee.advance.requiresPriorMutualConfirmation = false; },
    fee => { fee.advance.confirmLimit = false; }
  ]) {
    for (const index of [0, 1]) {
      const changed = structuredClone(records);
      mutate(changed.items[index].confirmed.feeAgreement);
      assert.throws(() => verify(changed));
    }
  }
});

test('fifth-round all-A answer maps to its own eight questions and preserves prior decision history', () => {
  const questions = read('docs/module-specs/fee-detail-questions-20261011.md');
  assert(questions.includes('8题全部选择A'));
  assert.deepEqual([...questions.matchAll(/（(FQ\d{2})）/g)].map(match => match[1]), Array.from({length: 8}, (_, index) => `FQ${String(index + 9).padStart(2, '0')}`));
  const batch = records.feeDecisionBatches[1];
  assert.equal(batch.id, 'fee-detail-round-5-20261012');
  assert.equal(batch.date, '2026-10-12');
  assert.equal(batch.userReply, '全A');
  assert.deepEqual(batch.scope, ['维修', '其它']);
  assert.equal(batch.questionDocument, 'docs/module-specs/fee-detail-questions-20261011.md');
  const offered = [...questions.matchAll(/（(FQ\d{2})）\r?\n\r?\nA：(.+?)B：/g)];
  assert.equal(batch.answers.length, 8);
  batch.answers.forEach((answer, index) => {
    assert.equal(answer.questionId, offered[index][1]);
    assert.equal(answer.answer, 'A');
    assert.equal(answer.selectedOption, offered[index][2].trim().replace(/。$/, ''));
  });
  assert.deepEqual(handoff.feeDecisionBatches, records.feeDecisionBatches);
  assert.equal(records.applicationDecisionBatches[0].answers[3].answer, 'B');
  assert.equal(records.exceptionRatingDecisionBatches[0].answers[4].answer, 'B');
  for (const id of ['HD01', 'HD04']) {
    assert(handoff.items.find(item => item.id === id).confirmed.includes('费用录入第五轮8题全部A'));
  }
});

test('fee-detail constraints reject wrong scope, unknown zero, estimates, live editing and forced refusal reasons', () => {
  verify(records);
  for (const mutate of [
    fee => { fee.advance.recordedWithFeeProposal = false; },
    fee => { fee.zeroServiceFeeAllowed = false; },
    fee => { fee.creationStage = 'before-selection'; },
    fee => { fee.initiation.selectedWorkerOnly = false; },
    fee => { fee.itemization.minItems = 0; },
    fee => { fee.itemization.maxItems = 50; },
    fee => { fee.itemization.fields.name.required = false; },
    fee => { fee.itemization.fields.name.maxLength = 50; },
    fee => { fee.itemization.fields.category.allowed.push('其它'); },
    fee => { fee.itemization.fields.amount.required = false; },
    fee => { fee.itemization.fields.remark.required = true; },
    fee => { fee.itemization.fields.remark.maxLength = 500; },
    fee => { fee.formalAmountPolicy.currentStageAmountsMustBeKnown = false; },
    fee => { fee.formalAmountPolicy.estimatedItemsAllowed = true; },
    fee => { fee.formalAmountPolicy.unknownAmountsDefaultToZero = true; },
    fee => { fee.pendingVersionEditing.mode = 'update-in-place'; },
    fee => { fee.pendingVersionEditing.preserveHistory = false; },
    fee => { fee.refusalRules.reasonRequired = true; },
    fee => { fee.refusalRules.endsPendingProposal = false; },
    fee => { fee.refusalRules.previousAgreementRemainsEffective = false; },
    fee => { fee.refusalRules.allowsNewProposal = false; },
    fee => { fee.refusalRules.endsService = true; }
  ]) {
    for (const index of [0, 1]) {
      const changed = structuredClone(records);
      mutate(changed.items[index].confirmed.feeAgreement);
      assert.throws(() => verify(changed));
    }
  }
  const document = read('docs/module-specs/fee-detail-rules.md');
  assert(document.includes('不修改跑腿服务费必须大于0规则'));
  assert(document.includes('实际支出明确0值已由第七轮独立确认，未知金额仍不能默认为0'));
  assert(document.includes('没有实现或验证实际表单、权限、金额计算或并发行为'));
  assert.equal(handoff.items.find(item => item.id === 'HD02').confirmed.business, '跑腿');
  assert.equal(handoff.items.find(item => item.id === 'HD05').userReply, '只显示“服务时间”，暂不填值');
});

test('sixth-round mixed answers preserve exact reply, options and matching business scope', () => {
  const questions = read('docs/module-specs/fee-boundary-questions-20261012.md');
  assert(questions.includes('已确认1B、2B、3B、4A、5B、6B、7A、8B'));
  assert.deepEqual([...questions.matchAll(/（(FQ\d{2})）/g)].map(match => match[1]), Array.from({length: 8}, (_, index) => `FQ${String(index + 17).padStart(2, '0')}`));
  const batch = records.feeDecisionBatches[2];
  assert.equal(batch.id, 'fee-boundary-round-6-20261012');
  assert.equal(batch.date, '2026-10-12');
  assert.equal(batch.userReply, '1. B\n2. B\n3. B\n4. A\n5. B\n6. B\n7. A\n8. B');
  assert.equal(batch.questionDocument, 'docs/module-specs/fee-boundary-questions-20261012.md');
  assert.deepEqual(batch.scope, ['维修', '其它']);
  const offered = [...questions.matchAll(/（(FQ\d{2})）\r?\n\r?\nA：(.+?)B：(.+?)\r?\n/g)];
  assert.equal(offered.length, 8);
  assert.deepEqual(batch.answers.map(x => x.answer), ['B', 'B', 'B', 'A', 'B', 'B', 'A', 'B']);
  assert.equal(batch.answers.length, 8);
  batch.answers.forEach((answer, index) => {
    assert.equal(answer.questionId, offered[index][1]);
    assert.equal(answer.selectedOption, offered[index][answer.answer === 'A' ? 2 : 3].trim().replace(/。$/, ''));
  });
  assert.deepEqual(handoff.feeDecisionBatches, records.feeDecisionBatches);
  assert.equal(records.feeDecisionBatches[1].userReply, '全A');
  for (const id of ['HD01', 'HD04']) {
    assert(handoff.items.find(x => x.id === id).confirmed.includes('费用边界第六轮1B、2B、3B、4A、5B、6B、7A、8B'));
  }
});

test('fee boundaries prevent completed-service edits, unlimited advances, public or ended receipts and inherited draft authorization', () => {
  verify(records);
  for (const mutate of [
    fee => { fee.stageName.mode = 'custom-only'; },
    fee => { fee.stageName.presets.push('必收上门费'); },
    fee => { fee.stageName.customName.maxLength = 300; },
    fee => { fee.postCompletionChanges = true; },
    fee => { fee.advance.limitRequiredWhenWilling = false; },
    fee => { fee.advance.limitMustBePositive = true; },
    fee => { fee.advance.zeroLimitMeansNoActualAdvance = false; },
    fee => { fee.advance.emptyLimitIsUnlimited = true; },
    fee => { fee.advance.overLimitPolicy.requiresNewFeeProposalAndLimit = false; },
    fee => { fee.advance.overLimitPolicy.requiresBothPartiesConfirmation = false; },
    fee => { fee.advance.overLimitPolicy.pauseAffectedAdvanceUntilConfirmed = false; },
    fee => { fee.advance.overLimitPolicy.autoCancelService = true; },
    fee => { fee.receipts.maxCount = 9; },
    fee => { fee.receipts.countScope = 'whole-proposal'; },
    fee => { fee.receipts.formats.push('GIF'); },
    fee => { fee.receipts.maxSizeMB = 10; },
    fee => { fee.receipts.visibility = 'all-applicants'; },
    fee => { fee.receipts.afterServiceEndVisibility = 'original-parties'; },
    fee => { fee.receipts.public = true; },
    fee => { fee.receipts.operatorAccessGranted = true; },
    fee => { fee.maxTotal = 199999.99; },
    fee => { fee.itemization.fields.amount.maxInput = 199999.99; },
    fee => { fee.reopeningPolicy.copyAsNewDraftAllowed = false; },
    fee => { fee.reopeningPolicy.requiresNewSubmission = false; },
    fee => { fee.reopeningPolicy.requiresNewPartiesConfirmation = false; },
    fee => { fee.reopeningPolicy.inheritsAgreement = true; },
    fee => { fee.reopeningPolicy.inheritsAdvanceAuthorization = true; },
    fee => { fee.reopeningPolicy.oldReceiptAccessGranted = true; }
  ]) {
    for (const index of [0, 1]) {
      const changed = structuredClone(records);
      mutate(changed.items[index].confirmed.feeAgreement);
      assert.throws(() => verify(changed));
    }
  }
  const document = read('docs/module-specs/fee-boundary-rules.md');
  assert(document.includes('取消后已发生费用仍可另行协商'));
  assert(document.includes('同时涵盖完成和取消'));
  assert(document.includes('关闭访问不等于删除文件'));
  assert(document.includes('已有缓存或用户此前保存的副本不能被声称已远程删除'));
  assert(document.includes('没有实现或验证真实金额计算、文件访问撤销、草稿复制或服务端操作'));
  assert.equal(handoff.items.find(x => x.id === 'HD02').confirmed.business, '跑腿');
  for (const item of records.items) {
    assert.equal(item.fullWorkflowReady, false);
    assert.equal(item.confirmed.completionRules.evidenceFields.attachments.maxCount, 9);
  }
});

test('seventh-round mixed answers preserve the cancellation exception and the new table preference', () => {
  const questions = read('docs/module-specs/closing-questions-20261012.md');
  assert(questions.includes('已确认1A、2B、3A、4A、5A、6A、7A、8A'));
  assert.deepEqual([...questions.matchAll(/（(CQ\d{2})）/g)].map(match => match[1]), Array.from({length: 8}, (_, index) => `CQ${String(index + 1).padStart(2, '0')}`));
  assert.equal(records.closingDecisionBatches.length, 1);
  const batch = records.closingDecisionBatches[0];
  assert.equal(batch.id, 'closing-round-7-20261012');
  assert.equal(batch.date, '2026-10-12');
  assert.equal(batch.userReply, '1. A\n2. B\n3. A\n4. A\n5. A\n6. A\n7. A\n8. A');
  assert.equal(batch.questionDocument, 'docs/module-specs/closing-questions-20261012.md');
  assert.deepEqual(batch.scope, ['维修', '其它']);
  const offered = [...questions.matchAll(/（(CQ\d{2})）\r?\n\r?\nA：(.+?)B：(.+?)\r?\n/g)];
  assert.equal(offered.length, 8);
  assert.deepEqual(batch.answers.map(x => x.answer), ['A', 'B', 'A', 'A', 'A', 'A', 'A', 'A']);
  assert.equal(batch.answers.length, 8);
  batch.answers.forEach((answer, index) => {
    assert.equal(answer.questionId, offered[index][1]);
    assert.equal(answer.selectedOption, offered[index][answer.answer === 'A' ? 2 : 3].trim().replace(/。$/, ''));
  });
  assert.deepEqual(handoff.closingDecisionBatches, records.closingDecisionBatches);
  assert.deepEqual(handoff.discussionFormat, records.discussionFormat);
  assert.equal(records.discussionFormatHistory[0].questionsPerRound,8);
  assert.equal(records.discussionFormat.presentation, 'table');
  assert.equal(records.discussionFormat.formatUserReply, '问题和选项以表格的形式问我');
  assert.equal(records.discussionFormatHistory[0].userReply, '一次问我八个问题, 否则进度太慢了');
  for (const id of ['HD01', 'HD04']) {
    assert(handoff.items.find(x => x.id === id).confirmed.includes('费用收尾与履约申请第七轮1A、2B、3A、4A、5A、6A、7A、8A'));
  }
});

test('closing constraints reject automatic fee approval, duplicate stage accumulation and unilateral endings', () => {
  verify(records);
  for (const mutate of [
    item => { item.feeAgreement.completionWithPendingProposal = 'auto-approve-on-completion'; },
    item => { item.feeAgreement.cancelPendingProposal.onlyIncurredKeepsPending = false; },
    item => { item.feeAgreement.cancelPendingProposal.containsUnincurredCloses = false; },
    item => { item.feeAgreement.cancelPendingProposal.preserveClosedHistory = false; },
    item => { item.feeAgreement.cancelPendingProposal.reproposalAllowed = false; },
    item => { item.feeAgreement.cancelPendingProposal.blocksCancellation = true; },
    item => { item.feeAgreement.cancelPendingProposal.autoConsent = true; },
    item => { item.feeAgreement.zeroExpenseAllowed = false; },
    item => { item.feeAgreement.stageOrganization.mode = 'cumulative-whole-proposal'; },
    item => { item.feeAgreement.stageOrganization.modificationReplaces = 'all-stages'; },
    item => { item.feeAgreement.stageOrganization.serviceTotal = 'sum-all-history'; },
    item => { item.feeAgreement.stageOrganization.pendingIncluded = true; },
    item => { item.feeAgreement.stageOrganization.oldVersionsIncluded = true; },
    item => { item.feeAgreement.maxServiceTotal = 199999.99; },
    item => { item.completionRules.pendingPerService = 2; },
    item => { item.cancellationRules.pendingPerService = 2; },
    item => { item.terminationRequests.editingPolicy.initiatorWithdrawalAllowed = false; },
    item => { item.terminationRequests.editingPolicy.mode = 'update-in-place'; },
    item => { item.terminationRequests.editingPolicy.preserveHistory = false; },
    item => { item.terminationRequests.editingPolicy.confirmedOutcomeWithdrawalAllowed = true; },
    item => { item.terminationRequests.refusedRequestPolicy.mode = 'keep-pending'; },
    item => { item.terminationRequests.refusedRequestPolicy.preserveHistory = false; },
    item => { item.terminationRequests.refusedRequestPolicy.serviceContinues = false; }
  ]) {
    for (const index of [0, 1]) {
      const changed = structuredClone(records);
      mutate(changed.items[index].confirmed);
      assert.throws(() => verify(changed));
    }
  }
  const document = read('docs/module-specs/closing-rules.md');
  assert(document.includes('而不是550元'));
  assert(document.includes('含未发生费用时关闭整份方案而非自动删掉部分费用并认可其余金额'));
  assert(document.includes('取消后的方案继续遵循双方确认'));
  assert(document.includes('费用未决阻止完成确认，不阻止符合既有规则的取消确认'));
  assert(read('docs/module-specs/README.md').includes('不能倒推为选人前必须报价'));
  assert(read('CONTEXT.md').includes('服务累计只取各阶段当前有效版本'));
  assert(document.includes('没有实现或验证真实累计计算、并发、权限或履约申请功能'));
  assert.equal(handoff.items.find(x => x.id === 'HD02').confirmed.business, '跑腿');
  assert.equal(handoff.items.find(x => x.id === 'HD05').userReply, '只显示“服务时间”，暂不填值');
});

test('eighth-round all-A answer maps to the eight table options and preserves previous mixed choices', () => {
  const questions = read('docs/module-specs/form-appointment-questions-20261012.md');
  assert(questions.includes('8题全部选择A'));
  assert(questions.includes('| 编号 | 问题 | A（推荐） | B |'));
  const offered = [...questions.matchAll(/^\| [1-8]（(DQ\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(offered.length, 8);
  assert.deepEqual(offered.map(x => x[1]), Array.from({length: 8}, (_, index) => `DQ${String(index + 1).padStart(2, '0')}`));
  assert.equal(records.formAppointmentDecisionBatches.length, 1);
  const batch = records.formAppointmentDecisionBatches[0];
  assert.equal(batch.id, 'form-appointment-round-8-20261012');
  assert.equal(batch.date, '2026-10-12');
  assert.equal(batch.userReply, '全A');
  assert.equal(batch.questionDocument, 'docs/module-specs/form-appointment-questions-20261012.md');
  assert.deepEqual(batch.scope, ['维修', '其它']);
  assert.equal(batch.answers.length, 8);
  batch.answers.forEach((answer, index) => {
    assert.equal(answer.questionId, offered[index][1]);
    assert.equal(answer.answer, 'A');
    assert.equal(answer.selectedOption, offered[index][3].trim());
  });
  assert.deepEqual(handoff.formAppointmentDecisionBatches, records.formAppointmentDecisionBatches);
  assert.equal(records.closingDecisionBatches[0].answers[1].answer, 'B');
  assert.deepEqual(records.feeDecisionBatches[2].answers.map(x => x.answer), ['B', 'B', 'B', 'A', 'B', 'B', 'A', 'B']);
  for (const id of ['HD01', 'HD04']) {
    assert(handoff.items.find(x => x.id === id).confirmed.includes('费用表单与预约基础第八轮8题全部A'));
  }
});

test('form and appointment constraints reject unilateral incurred classification, copied authorization and unapproved appointment replacements', () => {
  verify(records);
  for (const mutate of [
    item => { item.feeAgreement.cancelPendingProposal.incurredClassification.mode = 'initiator-declares'; },
    item => { item.feeAgreement.cancelPendingProposal.incurredClassification.disagreementCloses = false; },
    item => { item.feeAgreement.cancelPendingProposal.incurredClassification.unknownCloses = false; },
    item => { item.feeAgreement.cancelPendingProposal.incurredClassification.preserveHistory = false; },
    item => { item.feeAgreement.cancelPendingProposal.incurredClassification.blocksCancellation = true; },
    item => { item.feeAgreement.cancelPendingProposal.incurredClassification.approvesAmounts = true; },
    item => { item.feeAgreement.reopeningPolicy.copyActors = 'any-new-worker'; },
    item => { item.feeAgreement.reopeningPolicy.copyFields.push('联系方式'); },
    item => { item.feeAgreement.reopeningPolicy.copyAdvanceConditions = true; },
    item => { item.feeAgreement.reopeningPolicy.copyReceipts = true; },
    item => { item.feeAgreement.advance.notWillingLimitPolicy.hide = false; },
    item => { item.feeAgreement.advance.notWillingLimitPolicy.clearCurrentFormValue = false; },
    item => { item.feeAgreement.advance.notWillingLimitPolicy.preserveHistoricalAgreements = false; },
    item => { item.completionRules.refusalRules.reasonMinLength = 0; },
    item => { item.completionRules.refusalRules.reasonMaxLength = 300; },
    item => { item.cancellationRules.refusalRules.reasonMaxLength = 300; },
    item => { item.completionRules.evidenceFields.attachments.maxSizeMB = 10; },
    item => { item.cancellationRules.evidenceFields.attachments.formats.push('GIF'); },
    item => { item.disputeRules.objectionFields.attachments.maxSizeMB = 10; },
    item => { item.appointmentRules.initiators = ['发布者']; },
    item => { item.appointmentRules.pendingLimit = 2; },
    item => { item.appointmentRules.scope = 'before-selection'; },
    item => { item.appointmentRules.pendingChangesReplaceEffectiveTime = true; }
  ]) {
    for (const index of [0, 1]) {
      const changed = structuredClone(records);
      mutate(changed.items[index].confirmed);
      assert.throws(() => verify(changed));
    }
  }
  const document = read('docs/module-specs/form-appointment-rules.md');
  assert(document.includes('却仍未同意价格'));
  assert(document.includes('费用是否已发生不自动继承为新服务事实'));
  assert(document.includes('未提交并确认的新选择不撤销原有效垫付条件'));
  assert(document.includes('没有实现或验证实际文件上传、复制权限、字段清值或预约并发行为'));
  assert.equal(handoff.items.find(x => x.id === 'HD02').confirmed.business, '跑腿');
  assert.equal(handoff.items.find(x => x.id === 'HD05').userReply, '只显示“服务时间”，暂不填值');
  for (const item of records.items) {
    assert.equal(item.fullWorkflowReady, false);
    assert.equal(item.confirmed.feeAgreement.receipts.maxCount, 3);
    assert.equal(item.confirmed.completionRules.evidenceFields.attachments.maxCount, 9);
  }
});

test('ninth-round all-A answer matches only its eight table options and preserves preceding rule sources', () => {
  const questions = read('docs/module-specs/appointment-questions-20261012.md');
  assert(questions.includes('8题全部选择A'));
  assert(questions.includes('| 编号 | 问题 | A（推荐） | B |'));
  const offered = [...questions.matchAll(/^\| [1-8]（(TQ\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(offered.length, 8);
  assert.deepEqual(offered.map(x => x[1]), Array.from({length: 8}, (_, index) => `TQ${String(index + 1).padStart(2, '0')}`));
  assert.equal(records.appointmentDecisionBatches.length, 1);
  const batch = records.appointmentDecisionBatches[0];
  assert.equal(batch.id, 'appointment-round-9-20261012');
  assert.equal(batch.date, '2026-10-12');
  assert.equal(batch.userReply, '全A');
  assert.equal(batch.questionDocument, 'docs/module-specs/appointment-questions-20261012.md');
  assert.deepEqual(batch.scope, ['维修', '其它']);
  assert.equal(batch.answers.length, 8);
  batch.answers.forEach((answer, index) => {
    assert.equal(answer.questionId, offered[index][1]);
    assert.equal(answer.answer, 'A');
    assert.equal(answer.selectedOption, offered[index][3].trim());
  });
  assert.deepEqual(handoff.appointmentDecisionBatches, records.appointmentDecisionBatches);
  assert.equal(records.formAppointmentDecisionBatches[0].userReply, '全A');
  assert.equal(records.closingDecisionBatches[0].answers[1].answer, 'B');
  for (const id of ['HD01', 'HD04']) {
    assert(handoff.items.find(x => x.id === id).confirmed.includes('预约细则第九轮8题全部A'));
  }
});

test('appointment constraints prevent past booking, stale confirmation, unilateral clearing and automatic service endings', () => {
  verify(records);
  for (const mutate of [
    item => { item.appointmentRules.timeFields.mode = 'start-end-window'; },
    item => { item.appointmentRules.timeFields.precision = 'day'; },
    item => { item.appointmentRules.pastTimePolicy.futureOnly = false; },
    item => { item.appointmentRules.pastTimePolicy.reference = 'client-time'; },
    item => { item.appointmentRules.pastTimePolicy.allowHistoryBackfill = true; },
    item => { item.appointmentRules.pastTimePolicy.strictlyAfterCurrentTime = false; },
    item => { item.appointmentRules.pendingTimePassedPolicy.scope = 'all-effective-appointments'; },
    item => { item.appointmentRules.pendingTimePassedPolicy.closeAt = 'never'; },
    item => { item.appointmentRules.pendingTimePassedPolicy.preserveHistory = false; },
    item => { item.appointmentRules.pendingTimePassedPolicy.changesPreviousAppointment = true; },
    item => { item.appointmentRules.pendingTimePassedPolicy.changesServiceState = true; },
    item => { item.appointmentRules.pendingTimePassedPolicy.autoConsent = true; },
    item => { item.appointmentRules.editingPolicy.mode = 'update-in-place'; },
    item => { item.appointmentRules.editingPolicy.initiatorWithdrawalAllowed = false; },
    item => { item.appointmentRules.editingPolicy.preserveHistory = false; },
    item => { item.appointmentRules.refusalRules.reasonRequired = true; },
    item => { item.appointmentRules.refusalRules.reasonMaxLength = 500; },
    item => { item.appointmentRules.refusalRules.endsPendingProposal = false; },
    item => { item.appointmentRules.refusalRules.changesPreviousAppointment = true; },
    item => { item.appointmentRules.refusalRules.endsService = true; },
    item => { item.appointmentRules.clearEffectiveAppointmentPolicy.requiresBothPartiesConfirmation = false; },
    item => { item.appointmentRules.clearEffectiveAppointmentPolicy.preserveHistory = false; },
    item => { item.appointmentRules.clearEffectiveAppointmentPolicy.endsService = true; },
    item => { item.appointmentRules.onServiceEnd.closePendingChanges = false; },
    item => { item.appointmentRules.onServiceEnd.impliesConsent = true; },
    item => { item.appointmentRules.onServiceEnd.blocksServiceEnding = true; },
    item => { item.demandChanges.afterSelection.onServiceEnd.closePendingChanges = false; },
    item => { item.demandChanges.afterSelection.onServiceEnd.preserveHistory = false; },
    item => { item.demandChanges.afterSelection.onServiceEnd.impliesConsent = true; },
    item => { item.appointmentRules.overduePolicy.autoComplete = true; },
    item => { item.appointmentRules.overduePolicy.autoCancel = true; },
    item => { item.appointmentRules.overduePolicy.autoReminder = true; },
    item => { item.appointmentRules.overduePolicy.newOverdueCharge = true; },
    item => { item.appointmentRules.overduePolicy.newPenalty = true; }
  ]) {
    for (const index of [0, 1]) {
      const changed = structuredClone(records);
      mutate(changed.items[index].confirmed);
      assert.throws(() => verify(changed));
    }
  }
  const document = read('docs/module-specs/appointment-rules.md');
  assert(document.includes('清除请求的无回应处理不能默认套用未来预约到点关闭规则'));
  assert(document.includes('不能把过时申请确认成已生效的未来预约'));
  assert(document.includes('完成前仍必须处理待确认费用'));
  assert(document.includes('该规则不关闭取消后符合条件继续待确认的已发生费用方案'));
  assert(document.includes('没有实现或验证真实预约校验、到点任务、通知或并发状态变化'));
  for (const item of records.items) {
    assert.equal(item.confirmed.completionRules.noResponse.autoComplete, false);
    assert.equal(item.confirmed.cancellationRules.noResponse.autoCancel, false);
    assert.equal(item.confirmed.feeAgreement.completionWithPendingProposal, 'resolve-before-completion-confirmation');
    assert.equal(item.fullWorkflowReady, false);
  }
  assert.equal(handoff.items.find(x => x.id === 'HD02').confirmed.business, '跑腿');
  assert.equal(handoff.items.find(x => x.id === 'HD05').userReply, '只显示“服务时间”，暂不填值');
});

test('tenth-round all-A reply matches its eight options in both records', () => {
  const questions = read('docs/module-specs/change-questions-20261012.md');
  assert(questions.includes('8题全部选择A'));
  const offered = [...questions.matchAll(/^\| [1-8]（(CH\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(offered.length, 8);
  assert.equal(records.changeDecisionBatches.length, 1);
  const batch = records.changeDecisionBatches[0];
  assert.equal(batch.id, 'change-round-10-20261012');
  assert.equal(batch.date, '2026-10-12');
  assert.equal(batch.userReply, '全A');
  assert.equal(batch.questionDocument, 'docs/module-specs/change-questions-20261012.md');
  assert.deepEqual(batch.scope, ['维修', '其它']);
  assert.equal(batch.answers.length, 8);
  batch.answers.forEach((answer, index) => {
    assert.equal(answer.questionId, 'CH' + String(index + 1).padStart(2, '0'));
    assert.equal(answer.questionId, offered[index][1]);
    assert.equal(answer.answer, 'A');
    assert.equal(answer.selectedOption, offered[index][3].trim());
  });
  assert.deepEqual(handoff.changeDecisionBatches, records.changeDecisionBatches);
  for (const id of ['HD01', 'HD04']) {
    assert(handoff.items.find(x => x.id === id).confirmed.includes('清除预约与内容变更第十轮8题全部A'));
  }
  assert.equal(records.applicationDecisionBatches[0].answers[3].answer, 'B');
  assert.equal(records.closingDecisionBatches[0].answers[1].answer, 'B');
  assert.equal(handoff.items.find(x => x.id === 'HD05').userReply, '只显示“服务时间”，暂不填值');
});

test('change integrity rejects separate clear slots, automatic expiry, unilateral changes and lost history', () => {
  for (const mutate of [
    c => { c.appointmentRules.clearEffectiveAppointmentPolicy.sharedPendingLimit = 2; },
    c => { c.appointmentRules.clearEffectiveAppointmentPolicy.sharedWith = ['清除预约']; },
    c => { c.appointmentRules.clearEffectiveAppointmentPolicy.noResponse.autoClear = true; },
    c => { c.appointmentRules.clearEffectiveAppointmentPolicy.noResponse.autoClose = true; },
    c => { c.appointmentRules.clearEffectiveAppointmentPolicy.noResponse.previousAppointmentRemainsEffective = false; },
    c => { c.appointmentRules.clearEffectiveAppointmentPolicy.editingPolicy.mode = 'overwrite'; },
    c => { c.appointmentRules.clearEffectiveAppointmentPolicy.editingPolicy.confirmedOutcomeWithdrawalAllowed = true; },
    c => { c.appointmentRules.clearEffectiveAppointmentPolicy.refusalRules.reasonRequired = true; },
    c => { c.appointmentRules.clearEffectiveAppointmentPolicy.refusalRules.changesPreviousAppointment = true; },
    c => { c.demandChanges.afterSelection.initiators = ['发布者']; },
    c => { c.demandChanges.afterSelection.pendingLimit = 2; },
    c => { c.demandChanges.afterSelection.editingPolicy.preserveHistory = false; },
    c => { c.demandChanges.afterSelection.editingPolicy.mode = 'overwrite'; },
    c => { c.demandChanges.afterSelection.refusalRules.reasonMaxLength = 500; },
    c => { c.demandChanges.afterSelection.refusalRules.endsService = true; },
    c => { c.demandChanges.afterSelection.noResponse.autoConsent = true; },
    c => { c.demandChanges.afterSelection.noResponse.autoClose = true; },
    c => { c.demandChanges.afterSelection.noResponse.previousContentRemainsEffective = false; }
  ]) {
    for (const index of [0, 1]) {
      const changed = structuredClone(records);
      mutate(changed.items[index].confirmed);
      assert.throws(() => verify(changed));
    }
  }
  const rules = read('docs/module-specs/change-rules.md');
  assert(rules.includes('原预约时间已过也不触发清除'));
  assert(rules.includes('不是单独拒绝接单申请'));
  assert(rules.includes('没有实现或验证真实申请提交'));
  assert(read('docs/module-specs/appointment-rules.md').includes('清除请求无回应保持待确认且不自动关闭'));
});

test('eleventh-round all-A reply matches its eight original options without overriding earlier exceptions', () => {
  const questions = read('docs/module-specs/application-detail-questions-20261012.md');
  assert(questions.includes('8题全部选择A'));
  const offered = [...questions.matchAll(/^\| [1-8]（(AD\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(offered.length, 8);
  assert.equal(records.applicationDetailDecisionBatches.length, 1);
  const batch = records.applicationDetailDecisionBatches[0];
  assert.equal(batch.id, 'application-detail-round-11-20261012');
  assert.equal(batch.date, '2026-10-12');
  assert.equal(batch.userReply, '全A');
  assert.equal(batch.questionDocument, 'docs/module-specs/application-detail-questions-20261012.md');
  assert.deepEqual(batch.scope, ['维修', '其它']);
  assert.equal(batch.answers.length, 8);
  batch.answers.forEach((answer, index) => {
    assert.equal(answer.questionId, 'AD' + String(index + 1).padStart(2, '0'));
    assert.equal(answer.questionId, offered[index][1]);
    assert.equal(answer.answer, 'A');
    assert.equal(answer.selectedOption, offered[index][3].trim());
  });
  assert.deepEqual(handoff.applicationDetailDecisionBatches, records.applicationDetailDecisionBatches);
  for (const id of ['HD01', 'HD04']) {
    assert(handoff.items.find(x => x.id === id).confirmed.includes('申请展示与历史第十一轮8题全部A'));
  }
  assert.equal(records.applicationDecisionBatches[0].answers[3].answer, 'B');
  assert.equal(records.feeDecisionBatches[2].answers[0].answer, 'B');
  assert.equal(handoff.items.find(x => x.id === 'HD02').confirmed.business, '跑腿');
});

test('application display integrity rejects public bids, stale selections, expiry, lost history and unilateral cancellation', () => {
  for (const mutate of [
    c => { c.applicationRules.visibility.applicant = 'all-applications'; },
    c => { c.applicationRules.visibility.others = 'all-applications'; },
    c => { c.applicationRules.visibility.expandsContactOrAddressAccess = true; },
    c => { c.applicationRules.candidateDisplay.hideEmptyDescription = false; },
    c => { c.applicationRules.candidateDisplay.missingFeeLabel = '免费'; },
    c => { c.applicationRules.sorting.field = 'estimated-fee'; },
    c => { c.applicationRules.sorting.direction = 'descending'; },
    c => { c.applicationRules.openingDeadline.autoExpires = true; },
    c => { c.applicationRules.publisherClosing.scope = 'after-selection'; },
    c => { c.applicationRules.publisherClosing.allowedWithActiveApplications = false; },
    c => { c.applicationRules.publisherClosing.endsActiveApplications = false; },
    c => { c.applicationRules.publisherClosing.notifyApplicants = false; },
    c => { c.applicationRules.publisherClosing.preserveHistory = false; },
    c => { c.applicationRules.publisherClosing.impliesDeletion = true; },
    c => { c.applicationRules.publisherClosing.allowsUnilateralServiceCancellation = true; },
    c => { c.applicationRules.versionHistory.preserveSubmittedVersions = false; },
    c => { c.applicationRules.versionHistory.viewers.push('其他申请者'); },
    c => { c.applicationRules.editNotification.notifyPublisher = false; },
    c => { c.applicationRules.invalidatedReapplication.cooldownHours = 24; },
    c => { c.applicationRules.invalidatedReapplication.selectInvalidatedApplication = true; }
  ]) {
    for (const index of [0, 1]) {
      const changed = structuredClone(records);
      mutate(changed.items[index].confirmed);
      assert.throws(() => verify(changed));
    }
  }
  const rules = read('docs/module-specs/application-detail-rules.md');
  assert(rules.includes('不能向无权者下发完整申请后仅前端隐藏'));
  assert(rules.includes('不授予选人后单方取消权'));
  assert(rules.includes('保存期限不得默认无限'));
  assert(rules.includes('没有验证实际访问授权'));
  assert(read('docs/module-specs/application-rules.md').includes('[申请展示与历史](application-detail-rules.md)'));
});

test('twelfth-round answer preserves fourth B and records the price-floor request separately', () => {
  const questions = read('docs/module-specs/application-reopen-questions-20261012.md');
  assert(questions.includes('1A、2A、3A、4B、5A、6A、7A、8A'));
  const offered = [...questions.matchAll(/^\| [1-8]（(AR\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(offered.length, 8);
  assert.equal(records.applicationReopenDecisionBatches.length, 1);
  const batch = records.applicationReopenDecisionBatches[0];
  assert.equal(batch.id, 'application-reopen-round-12-20261013');
  assert.equal(batch.date, '2026-10-13');
  assert.equal(batch.userReply, '4. B\n\n其它全A');
  assert.equal(batch.questionDocument, 'docs/module-specs/application-reopen-questions-20261012.md');
  assert.deepEqual(batch.scope, ['维修', '其它']);
  assert.deepEqual(batch.answers.map(x => x.answer), ['A', 'A', 'A', 'B', 'A', 'A', 'A', 'A']);
  batch.answers.forEach((answer, index) => {
    assert.equal(answer.questionId, 'AR' + String(index + 1).padStart(2, '0'));
    assert.equal(answer.questionId, offered[index][1]);
    assert.equal(answer.selectedOption, offered[index][answer.answer === 'B' ? 4 : 3].trim());
  });
  assert.deepEqual(handoff.applicationReopenDecisionBatches, records.applicationReopenDecisionBatches);
  for (const id of ['HD01', 'HD04']) {
    assert(handoff.items.find(x => x.id === id).confirmed.includes('申请排序与关闭重开第十二轮1A、2A、3A、4B'));
  }
  assert.equal(records.applicationDecisionBatches[0].answers[3].answer, 'B');
  assert.equal(records.applicationDetailDecisionBatches[0].date, '2026-10-12');
});

test('reopen integrity rejects edit bumping, stale application order, restored applications and two successful outcomes', () => {
  for (const mutate of [
    c => { c.applicationRules.sorting.modificationTimePolicy = 'last-edit-time'; },
    c => { c.applicationRules.sorting.reapplicationTimePolicy = 'original-first-application-time'; },
    c => { c.applicationRules.publisherClosing.reopening.scope = 'completed-service'; },
    c => { c.applicationRules.publisherClosing.reopening.sameRequest = false; },
    c => { c.applicationRules.publisherClosing.reopening.restoreOldApplications = true; },
    c => { c.applicationRules.publisherClosing.reopening.productCountLimit = 3; },
    c => { c.applicationRules.publisherClosing.reopening.preserveEveryCloseAndReopen = false; },
    c => { c.applicationRules.publisherClosing.reopening.latestListTime = 'original-publication-time'; },
    c => { c.applicationRules.publisherClosing.reopening.preserveOriginalPublicationTime = false; },
    c => { c.applicationRules.publisherClosing.reopening.ordinaryEditBumpsList = true; },
    c => { c.applicationRules.publisherClosing.reasonRules.required = true; },
    c => { c.applicationRules.publisherClosing.reasonRules.maxLength = 500; },
    c => { c.applicationRules.publisherClosing.selectionConflictPolicy.mode = 'client-first-click'; },
    c => { c.applicationRules.publisherClosing.selectionConflictPolicy.laterOperationExecutes = true; },
    c => { c.applicationRules.publisherClosing.selectionConflictPolicy.rollbackSuccessfulResult = true; },
    c => { c.applicationRules.publisherClosing.selectionConflictPolicy.promptRefresh = false; },
    c => { c.demandChanges.beforeSelection.criticalFields = ['标题', '描述', '公开区域', '服务时间']; }
  ]) {
    for (const index of [0, 1]) {
      const changed = structuredClone(records);
      mutate(changed.items[index].confirmed);
      assert.throws(() => verify(changed));
    }
  }
  const rules = read('docs/module-specs/application-reopen-rules.md');
  assert(rules.includes('已完成服务不能通过本轮重开'));
  assert(rules.includes('其首页排序及其它细节不自动套用本轮'));
  assert(rules.includes('普通编辑不刷新该排序时间'));
  assert(rules.includes('仅替换图片也会使旧申请失效'));
  assert(rules.includes('未实现或验证真实排序'));
});

test('price-floor human intent is retained without inventing an initial price or idle transaction flow', () => {
  assert.equal(records.priceFloorRequests.length, 1);
  const request = records.priceFloorRequests[0];
  assert.equal(request.date, '2026-10-13');
  assert.equal(request.userReply, '新增规则: 确认进行交易后, 若骑手及维修员修改服务费, 闲置卖家修改金额, 不能低于初始金额');
  assert.deepEqual(request.confirmedIntent, { afterTransactionConfirmation: true, actors: ['骑手', '维修员', '闲置卖家'], lowerThanInitialAmountAllowed: false });
  assert.equal(request.readyForImplementation, false);
  assert(request.pending.length >= 6);
  assert.deepEqual(handoff.priceFloorRequests, records.priceFloorRequests);
  for (const key of ['initialAmountSource', 'freezeAt', 'comparisonScope', 'appliesToOther', 'idleTransactionFlow', 'allActorsBound']) {
    assert.equal(Object.hasOwn(request.confirmedIntent, key), false);
  }
  for (const item of records.items) {
    assert.equal(Object.hasOwn(item.confirmed.feeAgreement, 'priceFloor'), false);
    assert.equal(item.confirmed.feeAgreement.requiresBothPartiesConfirmation, true);
    assert.equal(item.confirmed.feeAgreement.postCompletionChanges, false);
    assert.equal(item.fullWorkflowReady, false);
  }
  const note = read(request.requestDocument);
  assert(note.includes(request.userReply));
  assert(note.includes('联系获准不等于成交'));
  assert(note.includes('原话没有提“其它”'));
  assert(note.includes('不授予单方涨价即生效权限'));
  assert(note.includes('不从禁止降低金额推出禁止退款'));
  assert.equal(handoff.items.find(x => x.id === 'HD02').confirmed.business, '跑腿');
});

test('fifteenth-round answers preserve custom percentages and 72 hours without rewriting original options or earlier batches', () => {
  const original = read('docs/module-specs/price-floor-questions-20261013.md');
  assert(original.includes('原表未逐题作答'));
  assert.equal([...original.matchAll(/^\| [1-8]（PF\d{2}） /gm)].length, 8);
  const questions = read('docs/module-specs/commission-billing-questions-20261013.md');
  assert(questions.includes('第6题用户自定义为出账成功后72小时'));
  const offered = [...questions.matchAll(/^\| [1-8]（(CB\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(offered.length, 8);
  assert.deepEqual(offered.map(x => x[1]), Array.from({length: 8}, (_, index) => 'CB' + String(index + 1).padStart(2, '0')));
  assert.equal(Object.hasOwn(records, 'priceFloorDecisionBatches'), false);
  assert.equal(Object.hasOwn(handoff, 'priceFloorDecisionBatches'), false);
  assert.equal(records.commissionBillingDecisionBatches.length, 1);
  const batch = records.commissionBillingDecisionBatches[0];
  assert.equal(batch.id, 'commission-billing-round-15-20261013');
  assert.equal(batch.userReply, '1. 跑腿15, 维修15, 闲置5, 其它还未确定, 你的建议是什么? 其它三项的定价你认为怎么样?\n\n6) 72h\n\n全A');
  assert.equal(batch.questionDocument, 'docs/module-specs/commission-billing-questions-20261013.md');
  assert.deepEqual(batch.scope, ['跑腿', '维修', '闲置', '其它']);
  assert.deepEqual(batch.answers.map(x => x.questionId), offered.map(x => x[1]));
  assert.deepEqual(batch.answers.map(x => x.answer), ['CUSTOM', 'A', 'A', 'A', 'A', 'CUSTOM', 'A', 'A']);
  for (const index of [1, 2, 3, 4, 6, 7]) assert.equal(batch.answers[index].selectedOption, offered[index][3].trim());
  assert.equal(batch.answers[0].selectedOption, '跑腿15%、维修15%、闲置5%；其它未确定');
  assert.deepEqual(batch.answers[0].pending, ['其它比例']);
  assert.equal(batch.answers[5].selectedOption, '出账成功后72小时');
  assert.equal(batch.answers[5].userClarification, '6) 72h');
  assert.equal(offered[5][3].trim(), '出账成功后7个自然日');
  assert.deepEqual(handoff.commissionBillingDecisionBatches, records.commissionBillingDecisionBatches);
  assert.equal(records.commissionDetailRules.rateConfiguration.numericRatesConfirmed, false);
  assert.equal(Object.hasOwn(records.commissionDetailRules.rateConfiguration, 'rates'), false);
  for (const key of ['rounding', 'calculationOrder', 'negativeBalancePolicy', 'paymentChannel', 'dueDays', 'overdueAction', 'scheduledBillTime']) {
    assert.equal(Object.hasOwn(records.commissionDetailRules, key), false);
  }
  assert(questions.includes('“全A”不能替代四个数值'));
  assert(original.includes('不把第十二轮“其它全A”解释为本轮答案'));
  for (const file of fs.readdirSync(path.join(root, 'docs/module-specs')).filter(name => name.endsWith('.md'))) {
    const doc = read('docs/module-specs/' + file);
    for (const match of doc.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^https?:\/\//.test(match[1])) {
        const url = new URL(match[1]);
        assert.equal(url.protocol, 'https:', file + ': external references must use HTTPS');
        assert(url.hostname, file + ': external reference must have a host');
        continue;
      }
      assert(fs.existsSync(path.resolve(root, 'docs/module-specs', match[1])), file + ': ' + match[1]);
    }
  }
  assert(read('docs/module-specs/fee-rules.md').includes('当前仅运行文档一致性检查'));
});

test('confirmed billing rules synchronize rates, rounding, actual issuance timing and inactive payment gates', () => {
  const expected = {
    confirmedAt: '2026-10-13', sourceBatch: 'commission-billing-round-15-20261013',
    rateConfiguration: { ratesBasisPoints: { '跑腿': 1500, '维修': 1500, '闲置': 500, '其它': null }, allRatesConfirmed: false, missingRateIsZero: false, otherRecommendationApproved: false },
    calculation: { order: 'per-transaction-then-business-sum', rounding: 'half-up', decimalPlaces: 2 },
    excessCredit: { policy: 'carry-forward-offset', automaticCashRefund: false },
    collectionDirection: { mode: 'explore-miniapp-commission-payment-after-qualification', actualChannelConfirmed: false, qualificationVerified: false, automaticDebit: false, customerFundsCustody: false },
    paymentDeadline: { durationHours: 72, startsAt: 'actual-successful-bill-issuance', timezone: 'Asia/Shanghai', cutoffComparisonConfirmed: false },
    overdue: { remind: true, restrictNewBusinessDirection: true, retainExistingServiceAndAppealAccess: true, detailedScopeConfirmed: false, automaticPenalty: false, automaticCancellation: false },
    billingSchedule: { monthOffset: 1, day: 1, time: '00:10', timezone: 'Asia/Shanghai', scheduledTimeIsIssuanceSuccess: false },
    readyForImplementation: false
  };
  assert.deepEqual(records.commissionBillingRules, expected);
  assert.deepEqual(handoff.commissionBillingRules, expected);
  assert.deepEqual(records.commissionDetailRules, expectedCommissionDetails);
  assert.equal(handoff.items.find(x => x.id === 'HD02').confirmed.business, '跑腿');
  const rules = read('docs/module-specs/commission-billing-rules.md');
  for (const phrase of ['null不是0%', '不先合计金额再舍入', '实际出账成功', '不自动退现金', '没有实现或验证真实支付', '后续差额应采用原佣金重算差', '是否阻止新的交易确认另待用户明确']) assert(rules.includes(phrase), phrase);
});

test('published commission examples match exact cent arithmetic including half-cent and per-order aggregation differences', () => {
  // 验证交接样例数学，不代表实现了生产计佣接口。
  const cents = value => BigInt(value.replace('.', ''));
  const format = value => `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
  const fee = (amount, basisPoints) => (amount * basisPoints + 5000n) / 10000n;
  const doc = read('docs/module-specs/commission-billing-rules.md');
  const rows = [...doc.matchAll(/^\| (?:跑腿|维修服务费|闲置成交价)(\d+\.\d{2})元[^|]* \| (\d+)% \| (\d+\.\d{2})元 \| (\d+\.\d{2})元 \|\r?$/gm)];
  assert.equal(rows.length, 4);
  for (const row of rows) {
    const amount = cents(row[1]);
    const result = fee(amount, BigInt(row[2]) * 100n);
    assert.equal(format(result), row[3]);
    assert.equal(format(amount - result), row[4]);
  }
  assert.equal(fee(10n, 1500n) + fee(10n, 1500n), 4n);
  assert.equal(fee(20n, 1500n), 3n);
  assert(doc.includes('汇总0.04元'));
  assert(doc.includes('再得0.03元'));
  assert(doc.includes('本月应缴为0、剩余10元'));
});

test('72-hour deadline examples and historical rate assessment remain traceable after subsequent approvals', () => {
  const doc = read('docs/module-specs/commission-billing-rules.md');
  const issue = Date.parse('2026-11-01T00:10:00+08:00');
  const delayedIssue = Date.parse('2026-11-01T01:00:00+08:00');
  const duration = records.commissionBillingRules.paymentDeadline.durationHours * 3600000;
  assert.equal(issue + duration, Date.parse('2026-11-04T00:10:00+08:00'));
  assert.equal(delayedIssue + duration, Date.parse('2026-11-04T01:00:00+08:00'));
  assert(doc.includes('2026-11-04 00:10:00'));
  assert(doc.includes('应从01:00计算'));
  const questions = read('docs/module-specs/commission-operation-questions-20261013.md');
  assert(questions.includes('本轮8题全A'));
  assert.equal([...questions.matchAll(/^\| [1-8]（CO\d{2}） /gm)].length, 8);
  assert.equal(records.commissionOperationDecisionBatches.length, 1);
  assert.deepEqual(handoff.commissionOperationDecisionBatches, records.commissionOperationDecisionBatches);
  const assessment = read('docs/module-specs/commission-rate-assessment-20261013.md');
  assert(assessment.includes('尚未获用户确认'));
  assert(assessment.includes('建议10%'));
  assert(assessment.includes('不是基于成本测算或行业标准'));
  assert(assessment.includes('具体合规适用仍需核验'));
  assert(assessment.includes('以下是前轮评估历史'));
  for (const file of ['business-addendum.md', 'page-spec.md', 'decisions-and-gaps.md']) {
    const text = read('docs/ui-development-handoff/' + file);
    assert(text.includes('其它未定；第6题自定义出账成功后72小时'));
    assert(text.includes('commission-billing-rules.md'));
  }
});

test('sixteenth-round all-A reply preserves the original options and explicitly extends commission caps to three businesses', () => {
  const [batch] = records.commissionOperationDecisionBatches;
  assert.equal(batch.id, 'commission-operation-round-16-20261013');
  assert.equal(batch.userReply, '维修, 闲置及其它封顶\n全A');
  const offered = [...read(batch.questionDocument).matchAll(/^\| [1-8]（(CO\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(offered.length, 8);
  assert.deepEqual(batch.answers.map(x => x.questionId), offered.map(x => x[1]));
  assert.deepEqual(batch.answers.map(x => x.answer), Array(8).fill('A'));
  batch.answers.forEach((answer, index) => assert.equal(answer.selectedOption, offered[index][3].trim()));
  assert.equal(batch.answers[1].userClarification, '维修, 闲置及其它封顶');
  assert.deepEqual(batch.answers[1].capScope, ['维修', '闲置', '其它']);
  assert(offered[1][2].includes('闲置5%'));
  assert.deepEqual(handoff.commissionOperationDecisionBatches, records.commissionOperationDecisionBatches);
  assert.equal(records.commissionBillingRules.rateConfiguration.ratesBasisPoints['其它'], null);
  assert.equal(records.commissionOperationRules.rateConfiguration.ratesBasisPoints['其它'], 1000);
  assert.deepEqual(records.commissionDetailRules, expectedCommissionDetails);
});

test('current operation rules reject invented cap amounts, unilateral commission reduction, premature payment recovery and widened operator powers', () => {
  function verifyOperation(rules) {
    assert.equal(rules.sourceBatch, 'commission-operation-round-16-20261013');
    assert.deepEqual(rules.rateConfiguration, {ratesBasisPoints: {'跑腿':1500,'维修':1500,'闲置':500,'其它':1000}, allRatesConfirmed:true, otherRateTrial:true, trialDurationConfirmed:false});
    assert.deepEqual(rules.commissionCaps, {scope:['维修','闲置','其它'],amountsCents:{'维修':null,'闲置':null,'其它':null},amountsConfirmed:false,unitConfirmed:false,lockTimeConfirmed:false,errandCapDecisionConfirmed:false});
    assert.deepEqual(rules.priceAdjustment, {mutualActualReductionAllowed:true,preserveInitialPrice:true,unilateralReductionAllowed:false,reducedCommissionBaseRequiresOperatorApproval:true,operatorApprovalRequiredForActualAgreement:false,provesActualRefund:false,serviceMediationGranted:false});
    assert.deepEqual(rules.preConfirmationDisclosure, {to:'commission-payer',showRate:true,showEstimatedCommission:true,showMonthlyBilling:true,acknowledgmentRequired:true,detailedFieldsConfirmed:false});
    assert.deepEqual(rules.missingRatePolicy, {publishingAllowed:true,applicationAllowed:true,newTransactionConfirmationAllowed:false,implicitZero:false});
    assert.deepEqual(rules.paymentDeadline, {durationHours:72,startsAt:'actual-successful-bill-issuance',comparison:'now-greater-than-or-equal-to-deadline-and-unverified-unpaid',timezone:'Asia/Shanghai'});
    assert.deepEqual(rules.billingDispute, {suspendDisputedPartCollectionAndRestriction:true,undisputedPartDueAsScheduled:true,detailedProcedureConfirmed:false});
    assert.deepEqual(rules.restrictionRecovery, {automaticAfterVerifiedAllOverduePayableSettled:true,removeOtherRestrictionReasons:false,partialPaymentIsFullSettlement:false,existingServiceAndAppealAccessRetained:true});
    assert.equal(rules.readyForImplementation, false);
  }
  verifyOperation(records.commissionOperationRules);
  verifyOperation(handoff.commissionOperationRules);
  assert.deepEqual(handoff.commissionOperationRules, records.commissionOperationRules);
  for(const mutate of [
    r => { r.rateConfiguration.ratesBasisPoints['其它'] = 1500; },
    r => { r.commissionCaps.scope = ['闲置']; },
    r => { r.commissionCaps.amountsCents['维修'] = 0; },
    r => { r.commissionCaps.unitConfirmed = true; },
    r => { r.commissionCaps.errandCapDecisionConfirmed = true; },
    r => { r.priceAdjustment.mutualActualReductionAllowed = false; },
    r => { r.priceAdjustment.reducedCommissionBaseRequiresOperatorApproval = false; },
    r => { r.priceAdjustment.operatorApprovalRequiredForActualAgreement = true; },
    r => { r.priceAdjustment.serviceMediationGranted = true; },
    r => { r.missingRatePolicy.implicitZero = true; },
    r => { r.paymentDeadline.comparison = 'now-greater-than-deadline'; },
    r => { r.billingDispute.undisputedPartDueAsScheduled = false; },
    r => { r.restrictionRecovery.partialPaymentIsFullSettlement = true; },
    r => { r.restrictionRecovery.removeOtherRestrictionReasons = true; },
    r => { r.readyForImplementation = true; }
  ]) {
    const changed = structuredClone(records.commissionOperationRules);
    mutate(changed);
    assert.throws(() => verifyOperation(changed));
  }
});

test('approved operation rules remain historical and seventeenth-round amounts stay pending while the remaining answers are approved', () => {
  const rules = read('docs/module-specs/commission-operation-rules.md');
  for(const phrase of ['不是服务费/成交价', '跑腿是否封顶未明确', '计佣基数不能凭单方编辑或仅双方确认直接减少', '不暂停无争议部分原期限', '不解除其他审核/违规限制', '尚未实现或验证真实交易']) assert(rules.includes(phrase), phrase);
  const questions = read('docs/module-specs/commission-cap-questions-20261013.md');
  assert(questions.includes('金额仍待确认；第4—8题A'));
  assert(questions.includes('不把全A当数值答案'));
  const offered = [...questions.matchAll(/^\| [1-8]（(CC\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(offered.length, 8);
  assert.deepEqual(offered.map(x => x[1]), Array.from({length:8}, (_,i) => 'CC' + String(i+1).padStart(2,'0')));
  assert.equal(records.commissionCapDecisionBatches.length, 1);
  assert.deepEqual(handoff.commissionCapDecisionBatches, records.commissionCapDecisionBatches);
  for(const name of ['monthly-commission-rules.md','monthly-commission-detail-rules.md','commission-billing-rules.md','commission-rate-assessment-20261013.md']) assert(read('docs/module-specs/'+name).includes('commission-operation-rules.md'));
  for(const name of ['business-addendum.md','page-spec.md','decisions-and-gaps.md']) {
    const text = read('docs/ui-development-handoff/'+name);
    assert(text.includes('第2题封顶范围补充为维修/闲置/其它，金额未填'));
    assert(text.includes('commission-operation-rules.md'));
    assert(text.includes('commission-cap-questions-20261013.md'));
  }
  const doc = read('docs/module-specs/README.md');
  assert(doc.includes('第十七轮8题'));
});

test('seventeenth-round recommendation request does not approve amounts and only questions four to eight select A', () => {
  const [batch] = records.commissionCapDecisionBatches;
  assert.equal(batch.id, 'commission-cap-round-17-20261014');
  assert.equal(batch.date, '2026-10-14');
  assert.equal(batch.userReply, '123你的建议是多少元?\n全A');
  const offered = [...read(batch.questionDocument).matchAll(/^\| [1-8]（(CC\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(offered.length, 8);
  assert.deepEqual(batch.answers.map(x => x.questionId), offered.map(x => x[1]));
  assert.deepEqual(batch.answers.map(x => x.answer), ['PENDING','PENDING','PENDING','A','A','A','A','A']);
  batch.answers.forEach((answer,i) => {
    if(i < 3) {
      assert.equal(answer.selectedOption, '请求建议，金额未确认');
      assert.equal(answer.userClarification, '123你的建议是多少元?');
      assert(fs.existsSync(path.join(root, answer.recommendationDocument)));
    } else assert.equal(answer.selectedOption, offered[i][3].trim());
  });
  assert.deepEqual(handoff.commissionCapDecisionBatches, records.commissionCapDecisionBatches);
  assert.deepEqual(handoff.commissionCapRecommendations, records.commissionCapRecommendations);
  assert.equal(records.commissionCapRecommendations.length, 1);
  assert.deepEqual(records.commissionCapRecommendations[0], {date:'2026-10-14',status:'proposal',userApproved:false,amountsCents:{'维修':3000,'闲置':2000,'其它':2000},document:'docs/module-specs/commission-cap-assessment-20261014.md'});
  assert.equal(records.commissionOperationRules.commissionCaps.errandCapDecisionConfirmed, false);
  assert.deepEqual(records.commissionCapRules.errand, {rateBasisPoints:1500,capped:false});
});

test('cap rule integrity preserves shared service caps, snapshot timing, approved recomputation and missing-configuration gates', () => {
  const expected = {
    confirmedAt:'2026-10-14',sourceBatch:'commission-cap-round-17-20261014',
    caps:{scope:['维修','闲置','其它'],amountsCents:{'维修':null,'闲置':null,'其它':null},amountsConfirmed:false,serviceUnit:'entire-service-all-stages-one-cap',idleUnit:'single-transaction',phaseRoundingConfirmed:false,cancelReopenUnitConfirmed:false},
    snapshot:{at:'transaction-confirmation',withRate:true,newCapsAffectExisting:false,perBusinessActionConfirmed:false},
    approvedReduction:{method:'recompute-with-original-rules-then-subtract-original-commission',directReductionAmountTimesRate:false,overwriteOriginalBill:false,automaticCashRefund:false},
    errand:{rateBasisPoints:1500,capped:false},
    missingCapPolicy:{publishingAllowed:true,applicationAllowed:true,newTransactionConfirmationAllowed:false,implicitZero:false,implicitUnlimited:false},
    readyForImplementation:false
  };
  const verifyCap = data => assert.deepEqual(data, expected);
  verifyCap(records.commissionCapRules);
  verifyCap(handoff.commissionCapRules);
  for(const mutate of [
    r => { r.caps.amountsCents['维修'] = 3000; },
    r => { r.caps.amountsConfirmed = true; },
    r => { r.caps.serviceUnit = 'per-stage'; },
    r => { r.caps.cancelReopenUnitConfirmed = true; },
    r => { r.snapshot.newCapsAffectExisting = true; },
    r => { r.snapshot.perBusinessActionConfirmed = true; },
    r => { r.approvedReduction.directReductionAmountTimesRate = true; },
    r => { r.approvedReduction.overwriteOriginalBill = true; },
    r => { r.approvedReduction.automaticCashRefund = true; },
    r => { r.errand.capped = true; },
    r => { r.missingCapPolicy.newTransactionConfirmationAllowed = true; },
    r => { r.missingCapPolicy.implicitUnlimited = true; },
    r => { r.readyForImplementation = true; }
  ]) {
    const changed = structuredClone(records.commissionCapRules);
    mutate(changed); assert.throws(() => verifyCap(changed));
  }
});

test('cap advice and adjustment examples remain historical after eighteenth-round approval', () => {
  // 仅检验建议和验收数字，不提供生产接口，也不使建议配置生效。
  const rounded = (base, rate) => (base * rate + 5000n) / 10000n;
  const capped = (base, rate, cap) => {const raw=rounded(base,rate);return raw < cap ? raw : cap;};
  const advice = read('docs/module-specs/commission-cap-assessment-20261014.md');
  const rows = [...advice.matchAll(/^\| (维修|闲置|其它) \| (\d+)% \| (\d+\.\d{2})元 \| (?:服务费|成交价)(\d+\.\d{2})元 \|\r?$/gm)];
  assert.equal(rows.length,3);
  for(const row of rows) {
    const cap=BigInt(row[3].replace('.','')), base=BigInt(row[4].replace('.','')), rate=BigInt(row[2])*100n;
    assert.equal(rounded(base,rate),cap);
    assert.equal(Number(cap),records.commissionCapRecommendations[0].amountsCents[row[1]]);
    assert.equal(records.commissionCapRules.caps.amountsCents[row[1]],null);
  }
  assert.equal(capped(80000n,500n,2000n),2000n);
  assert.equal(capped(60000n,500n,2000n)-capped(80000n,500n,2000n),0n);
  assert.equal(capped(30000n,500n,2000n)-capped(80000n,500n,2000n),-500n);
  assert.equal(capped(10000n+15000n,1500n,3000n),3000n);
  assert.equal(capped(10000n,1500n,3000n)+capped(15000n,1500n,3000n),3750n);
  const rules=read('docs/module-specs/commission-cap-rules.md');
  for(const text of ['20.00元 | 20.00元 | 0.00元', '20.00元 | 15.00元 | -5.00元', '37.50元', '没有实现或验证真实计佣']) assert(rules.includes(text),text);
  assert(advice.includes('尚未获用户确认'));
  assert(advice.includes('不是行业标准'));
  const questions=read('docs/module-specs/commission-confirmation-questions-20261014.md');
  assert(questions.includes('本轮8题全部A'));
  assert.equal([...questions.matchAll(/^\| [1-8]（CT\d{2}） /gm)].length,8);
  assert.equal(records.commissionConfirmationDecisionBatches.length,1);
  assert.deepEqual(handoff.commissionConfirmationDecisionBatches,records.commissionConfirmationDecisionBatches);
  for(const name of ['business-addendum.md','page-spec.md','decisions-and-gaps.md']) assert(read('docs/ui-development-handoff/'+name).includes('第4—8题A'));
});

test('eighteenth-round all-A answers approve amounts now without backdating earlier recommendation history', () => {
  const [batch]=records.commissionConfirmationDecisionBatches;
  assert.equal(batch.id,'commission-confirmation-round-18-20261014');
  assert.equal(batch.date,'2026-10-14');
  assert.equal(batch.userReply,'全A');
  assert.deepEqual(batch.scope,['跑腿','维修','闲置','其它']);
  const offered=[...read(batch.questionDocument).matchAll(/^\| [1-8]（(CT\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(offered.length,8);
  assert.deepEqual(batch.answers.map(x=>x.questionId),offered.map(x=>x[1]));
  assert.deepEqual(batch.answers.map(x=>x.answer),Array(8).fill('A'));
  batch.answers.forEach((x,i)=>assert.equal(x.selectedOption,offered[i][3].trim()));
  assert.deepEqual(handoff.commissionConfirmationDecisionBatches,records.commissionConfirmationDecisionBatches);
  assert.equal(records.commissionCapRecommendations[0].userApproved,false);
  assert.deepEqual(records.commissionCapRules.caps.amountsCents,{'维修':null,'闲置':null,'其它':null});
  assert(read('docs/module-specs/commission-cap-assessment-20261014.md').includes('以下保留批准前建议历史'));
});

test('current confirmation rules preserve cap amounts, distinct agreement facts, new-service snapshots and inactive trial gates', () => {
  const expected={
    confirmedAt:'2026-10-14',sourceBatch:'commission-confirmation-round-18-20261014',
    businessConfiguration:{'跑腿':{rateBasisPoints:1500,cap:{kind:'none'}},'维修':{rateBasisPoints:1500,cap:{kind:'fixed',amountCents:3000,unit:'entire-service'}},'闲置':{rateBasisPoints:500,cap:{kind:'fixed',amountCents:2000,unit:'single-transaction'}},'其它':{rateBasisPoints:1000,trial:true,cap:{kind:'fixed',amountCents:2000,unit:'entire-service'}}},
    rateAndCapLock:{repairAndOther:'successful-publisher-worker-selection',errand:'successful-publisher-quote-selection',idle:'successful-buyer-confirmation-of-seller-request',payerDisclosureRequiredBefore:true,locksUnknownServiceFee:false},
    idleAgreement:{initiator:'seller',confirmationBy:'buyer',explicitAmountBeforeConfirmation:true,contactApprovalIsTransaction:false,meansDeliveryCompleted:false,provesPayment:false,completeWorkflowConfirmed:false},
    cancelReopenService:{newServiceIndependentSnapshot:true,newServiceIndependentCap:true,restoresOldApplication:false,restoresOldContactPermission:false,oldFeesAutomaticallyEffective:false},
    estimatedCommissionChanges:{show:true,basedOnApprovedCommissionBasis:true,repeatAcknowledgmentRequired:false,replacesMutualFeeConfirmation:false,unverifiedRealPriceReductionReducesEstimate:false,provesCommissionPayment:false},
    trialReview:{afterFormalEnablementDays:30,startsAt:'actual-scheme-enablement',enabled:false,automaticFeeChange:false,automaticWaiverAtReview:false,detailedMeasurementConfirmed:false},
    readyForImplementation:false
  };
  const verifyCurrent=data=>assert.deepEqual(data,expected);
  verifyCurrent(records.commissionConfirmationRules);
  verifyCurrent(handoff.commissionConfirmationRules);
  for(const mutate of [
    r=>{r.businessConfiguration['维修'].cap.amountCents=2000;},
    r=>{r.businessConfiguration['跑腿'].cap={kind:'fixed',amountCents:2000};},
    r=>{r.rateAndCapLock.errand='quote-submission';},
    r=>{r.rateAndCapLock.locksUnknownServiceFee=true;},
    r=>{r.idleAgreement.explicitAmountBeforeConfirmation=false;},
    r=>{r.idleAgreement.contactApprovalIsTransaction=true;},
    r=>{r.idleAgreement.meansDeliveryCompleted=true;},
    r=>{r.idleAgreement.provesPayment=true;},
    r=>{r.cancelReopenService.newServiceIndependentCap=false;},
    r=>{r.cancelReopenService.restoresOldContactPermission=true;},
    r=>{r.cancelReopenService.oldFeesAutomaticallyEffective=true;},
    r=>{r.estimatedCommissionChanges.repeatAcknowledgmentRequired=true;},
    r=>{r.estimatedCommissionChanges.unverifiedRealPriceReductionReducesEstimate=true;},
    r=>{r.trialReview.enabled=true;},
    r=>{r.trialReview.automaticFeeChange=true;},
    r=>{r.trialReview.startsAt='document-confirmation';},
    r=>{r.readyForImplementation=true;}
  ]) {const changed=structuredClone(records.commissionConfirmationRules);mutate(changed);assert.throws(()=>verifyCurrent(changed));}
});

test('approved cap examples remain current and nineteenth-round idle answers are retained separately', () => {
  const config=records.commissionConfirmationRules.businessConfiguration;
  const fee=(business,baseCents)=>{const row=config[business];const raw=(BigInt(baseCents)*BigInt(row.rateBasisPoints)+5000n)/10000n;return row.cap.kind==='none'?raw:raw>BigInt(row.cap.amountCents)?BigInt(row.cap.amountCents):raw;};
  assert.equal(fee('维修',25000),3000n);
  assert.equal(fee('其它',25000),2000n);
  assert.equal(fee('闲置',80000),2000n);
  assert.equal(fee('闲置',60000),2000n);
  assert.equal(fee('闲置',30000)-fee('闲置',80000),-500n);
  assert.equal(fee('跑腿',25000),3750n);
  const rules=read('docs/module-specs/commission-confirmation-rules.md');
  for(const phrase of ['不产生未确认服务费金额','草选、提交报价或失败/未知结果','评分资格','不重复知悉','不从文档确认日计时','没有实现或验证真实交易']) assert(rules.includes(phrase),phrase);
  const questions=read('docs/module-specs/idle-transaction-questions-20261014.md');
  assert(questions.includes('第5题B，其余A'));
  const offered=[...questions.matchAll(/^\| [1-8]（(IT\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(offered.length,8);
  assert.deepEqual(offered.map(x=>x[1]),Array.from({length:8},(_,i)=>'IT'+String(i+1).padStart(2,'0')));
  assert.equal(records.idleTransactionDecisionBatches.length,1);
  assert.deepEqual(handoff.idleTransactionDecisionBatches,records.idleTransactionDecisionBatches);
  assert.equal(handoff.items.find(x=>x.id==='HD02').confirmed.business,'跑腿');
  for(const name of ['business-addendum.md','page-spec.md','decisions-and-gaps.md']){
    const text=read('docs/ui-development-handoff/'+name);
    assert(text.includes('第十八轮实际回复“全A”'));
    assert(text.includes('commission-confirmation-rules.md'));
    assert(text.includes('idle-transaction-questions-20261014.md'));
  }
});

test('nineteenth-round reply selects fifth B and preserves the seven A options without changing pricing history', () => {
  const [batch]=records.idleTransactionDecisionBatches;
  assert.equal(batch.id,'idle-transaction-round-19-20261014');
  assert.equal(batch.date,'2026-10-14');
  assert.equal(batch.userReply,'5B, 全A');
  assert.deepEqual(batch.scope,['闲置']);
  const offered=[...read(batch.questionDocument).matchAll(/^\| [1-8]（(IT\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(offered.length,8);
  assert.deepEqual(batch.answers.map(x=>x.questionId),offered.map(x=>x[1]));
  assert.deepEqual(batch.answers.map(x=>x.answer),['A','A','A','A','B','A','A','A']);
  batch.answers.forEach((answer,i)=>assert.equal(answer.selectedOption,offered[i][i===4?4:3].trim()));
  assert.deepEqual(handoff.idleTransactionDecisionBatches,records.idleTransactionDecisionBatches);
  assert.equal(records.commissionConfirmationRules.businessConfiguration['闲置'].rateBasisPoints,500);
  assert.equal(records.commissionConfirmationRules.businessConfiguration['闲置'].cap.amountCents,2000);
  assert.equal(records.commissionConfirmationRules.idleAgreement.completeWorkflowConfirmed,false);
});

test('idle transaction integrity rejects optional refusal reasons, public targets, duplicate trades, overwritten requests and automatic completion', () => {
  const expected={
    confirmedAt:'2026-10-14',sourceBatch:'idle-transaction-round-19-20261014',
    transactionRequest:{initiator:'seller',confirmationBy:'buyer',target:'buyer-with-approved-contact-on-same-post',maxPendingPerPost:1,maxInProgressPerPost:1,editing:'withdraw-then-new-version',oldVersionPreserved:true,withdrawnVersionConfirmable:false,noResponse:'keep-pending',automaticAcceptance:false,automaticExpiry:false,sellerMayRemind:true,sellerMayWithdraw:true},
    refusal:{reasonRequired:true,minLength:1,maxLength:300,endsRequest:true,preserveHistory:true,cancelsEffectiveTransaction:false},
    inProgressListing:{status:'transaction-in-progress',newContactApplicationsAllowed:false,existingLegalAuthorizationsRetained:true,extendsAuthorizationLifetime:false,marksSold:false},
    deliveryCompletion:{requestBy:'seller',confirmedBy:'buyer',automaticCompletion:false,noResponse:'keep-pending',reminderAllowed:true,objectionAllowed:true,operatorMayConfirmForBuyer:false,requestProvesCompletion:false,completionProvesPayment:false,ratingLinkConfirmed:false},
    completeWorkflowConfirmed:false,readyForImplementation:false
  };
  const verifyIdle=data=>assert.deepEqual(data,expected);
  verifyIdle(records.idleTransactionRules);
  verifyIdle(handoff.idleTransactionRules);
  for(const mutate of [
    r=>{r.refusal.reasonRequired=false;},
    r=>{r.refusal.minLength=0;},
    r=>{r.refusal.maxLength=500;},
    r=>{r.refusal.cancelsEffectiveTransaction=true;},
    r=>{r.transactionRequest.target='any-registered-buyer';},
    r=>{r.transactionRequest.maxPendingPerPost=5;},
    r=>{r.transactionRequest.maxInProgressPerPost=2;},
    r=>{r.transactionRequest.editing='overwrite-pending';},
    r=>{r.transactionRequest.withdrawnVersionConfirmable=true;},
    r=>{r.transactionRequest.automaticAcceptance=true;},
    r=>{r.transactionRequest.automaticExpiry=true;},
    r=>{r.inProgressListing.newContactApplicationsAllowed=true;},
    r=>{r.inProgressListing.existingLegalAuthorizationsRetained=false;},
    r=>{r.inProgressListing.extendsAuthorizationLifetime=true;},
    r=>{r.inProgressListing.marksSold=true;},
    r=>{r.deliveryCompletion.automaticCompletion=true;},
    r=>{r.deliveryCompletion.operatorMayConfirmForBuyer=true;},
    r=>{r.deliveryCompletion.requestProvesCompletion=true;},
    r=>{r.deliveryCompletion.ratingLinkConfirmed=true;},
    r=>{r.completeWorkflowConfirmed=true;},
    r=>{r.readyForImplementation=true;}
  ]) {const changed=structuredClone(records.idleTransactionRules);mutate(changed);assert.throws(()=>verifyIdle(changed));}
});

test('idle refusal limits and no-response boundaries retain their source while twentieth-round choices are approved separately', () => {
  const rules=read('docs/module-specs/idle-transaction-rules.md');
  for(const phrase of ['1A、2A、3A、4A、5B、6A、7A、8A','理由必填1—300字','0字或301字','满24小时也不自动同意/关闭','无回应超过24小时仍待确认','评分衔接继续待定','没有实现或验证真实交易']) assert(rules.includes(phrase),phrase);
  const range=records.idleTransactionRules.refusal;
  for(const [length,valid] of [[0,false],[1,true],[300,true],[301,false]]) {
    const value='字'.repeat(length);
    assert.equal(value.length>=range.minLength&&value.length<=range.maxLength,valid);
  }
  const questions=read('docs/module-specs/idle-change-questions-20261014.md');
  assert(questions.includes('本轮8题全部A'));
  const offered=[...questions.matchAll(/^\| [1-8]（(IC\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(offered.length,8);
  assert.deepEqual(offered.map(x=>x[1]),Array.from({length:8},(_,i)=>'IC'+String(i+1).padStart(2,'0')));
  assert.equal(records.idleChangeDecisionBatches.length,1);
  assert.deepEqual(handoff.idleChangeDecisionBatches,records.idleChangeDecisionBatches);
  assert(read('docs/module-specs/commission-confirmation-rules.md').includes('idle-transaction-rules.md'));
  for(const name of ['business-addendum.md','page-spec.md','decisions-and-gaps.md']) {
    const text=read('docs/ui-development-handoff/'+name);
    assert(text.includes('第十九轮实际回复“5B, 全A”'));
    assert(text.includes('idle-transaction-rules.md'));
    assert(text.includes('idle-change-questions-20261014.md'));
  }
});

test('twentieth-round all-A reply maps exactly to cancellation, repricing and completed-rating options without overwriting nineteenth-round B', () => {
  const [batch]=records.idleChangeDecisionBatches;
  assert.equal(batch.id,'idle-change-round-20-20261014');
  assert.equal(batch.date,'2026-10-14');
  assert.equal(batch.userReply,'全A');
  assert.deepEqual(batch.scope,['闲置']);
  const offered=[...read(batch.questionDocument).matchAll(/^\| [1-8]（(IC\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(offered.length,8);
  assert.deepEqual(batch.answers.map(x=>x.questionId),offered.map(x=>x[1]));
  assert.deepEqual(batch.answers.map(x=>x.answer),Array(8).fill('A'));
  batch.answers.forEach((answer,i)=>assert.equal(answer.selectedOption,offered[i][3].trim()));
  assert.deepEqual(handoff.idleChangeDecisionBatches,records.idleChangeDecisionBatches);
  assert.equal(records.idleTransactionDecisionBatches[0].answers[4].answer,'B');
  assert.equal(records.idleTransactionRules.deliveryCompletion.ratingLinkConfirmed,false);
  assert.equal(records.idleChangeRules.newFlowRatingQualification.additionalExperienceConfirmationRequired,false);
});

test('idle change integrity rejects unilateral endings, auto expiry, duplicate prices, completion bypasses and premature ratings', () => {
  const expected={
    confirmedAt:'2026-10-14',sourceBatch:'idle-change-round-20-20261014',
    cancellation:{requestBy:'either-party',requiresOtherPartyConfirmation:true,noResponse:'keep-pending',automaticCancellation:false,automaticExpiry:false,transactionContinuesBeforeConfirmation:true,refusal:{reasonRequired:true,minLength:1,maxLength:300,endsRequest:true,preserveHistory:true,transactionContinues:true},provesRefundOrSettlement:false},
    priceChange:{proposedBy:'either-party',requiresOtherPartyConfirmation:true,maxPendingPerTransaction:1,realReductionRequiresMutualConfirmation:true,reducedCommissionBasisRequiresOperatorApproval:true,overwriteInitialPrice:false,pendingChangeBlocksDeliveryConfirmation:true,processingMayConfirmRefuseOrWithdraw:true,pendingOperatorApprovalBlocksCompletionConfirmed:false},
    completedListing:{automaticMarkSold:true,removeFromForSale:true,remaskContactInformation:true,preserveHistory:true,provesPayment:false,allPrivatePermissionsClosureConfirmed:false},
    newFlowRatingQualification:{trigger:'seller-delivery-request-and-buyer-confirmation',mutual:true,additionalExperienceConfirmationRequired:false,contactApprovalCreatesQualification:false,unilateralSoldCreatesQualification:false,pendingCompletionCreatesQualification:false,cancellationCreatesQualification:false,preserveExistingLegitimateQualificationsAndRatings:true,otherBusinessRulesUnaffected:true,publicTextBypassesModeration:false},
    completeWorkflowConfirmed:false,readyForImplementation:false
  };
  const verifyCurrent=data=>assert.deepEqual(data,expected);
  verifyCurrent(records.idleChangeRules);verifyCurrent(handoff.idleChangeRules);
  for(const mutate of [
    r=>{r.cancellation.requiresOtherPartyConfirmation=false;},
    r=>{r.cancellation.automaticCancellation=true;},
    r=>{r.cancellation.automaticExpiry=true;},
    r=>{r.cancellation.refusal.reasonRequired=false;},
    r=>{r.cancellation.refusal.minLength=0;},
    r=>{r.cancellation.refusal.maxLength=500;},
    r=>{r.cancellation.refusal.transactionContinues=false;},
    r=>{r.cancellation.provesRefundOrSettlement=true;},
    r=>{r.priceChange.proposedBy='seller-only';},
    r=>{r.priceChange.maxPendingPerTransaction=2;},
    r=>{r.priceChange.reducedCommissionBasisRequiresOperatorApproval=false;},
    r=>{r.priceChange.pendingChangeBlocksDeliveryConfirmation=false;},
    r=>{r.priceChange.pendingOperatorApprovalBlocksCompletionConfirmed=true;},
    r=>{r.completedListing.automaticMarkSold=false;},
    r=>{r.completedListing.remaskContactInformation=false;},
    r=>{r.newFlowRatingQualification.additionalExperienceConfirmationRequired=true;},
    r=>{r.newFlowRatingQualification.unilateralSoldCreatesQualification=true;},
    r=>{r.newFlowRatingQualification.cancellationCreatesQualification=true;},
    r=>{r.newFlowRatingQualification.preserveExistingLegitimateQualificationsAndRatings=false;},
    r=>{r.newFlowRatingQualification.publicTextBypassesModeration=true;},
    r=>{r.completeWorkflowConfirmed=true;},
    r=>{r.readyForImplementation=true;}
  ]){const changed=structuredClone(records.idleChangeRules);mutate(changed);assert.throws(()=>verifyCurrent(changed));}
});

test('idle change refusal and completion dependencies are documented without selecting next-round concurrency or reopening defaults', () => {
  const rules=read('docs/module-specs/idle-change-rules.md');
  for(const phrase of ['八题全部A','理由必填1—300字','0字或301字','不强制同意','原双向三维体系','评分资格不表示图文立即公开','没有实现或验证真实取消'])assert(rules.includes(phrase),phrase);
  const refusal=records.idleChangeRules.cancellation.refusal;
  for(const [length,expected] of [[0,false],[1,true],[300,true],[301,false]])assert.equal(length>=refusal.minLength&&length<=refusal.maxLength,expected);
  const questions=read('docs/module-specs/idle-request-questions-20261014.md');
  assert(questions.includes('8题全部待答'));
  const offered=[...questions.matchAll(/^\| [1-8]（(IR\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(offered.length,8);
  assert.deepEqual(offered.map(x=>x[1]),Array.from({length:8},(_,i)=>'IR'+String(i+1).padStart(2,'0')));
  assert.equal(Object.hasOwn(records,'idleRequestDecisionBatches'),false);
  assert.equal(Object.hasOwn(handoff,'idleRequestDecisionBatches'),false);
  assert(read('docs/module-specs/idle-transaction-rules.md').includes('idle-change-rules.md'));
  for(const name of ['business-addendum.md','page-spec.md','decisions-and-gaps.md']){
    const text=read('docs/ui-development-handoff/'+name);
    assert(text.includes('第二十轮实际回复“全A”'));
    assert(text.includes('idle-change-rules.md'));
    assert(text.includes('idle-request-questions-20261014.md'));
  }
  assert.equal(handoff.items.find(x=>x.id==='HD02').confirmed.business,'跑腿');
});

test('offline transaction reassessment preserves the exact user concern without answering prior questions or replacing confirmed rules', () => {
  assert.equal(records.offlineTransactionReplanRequests.length,1);
  const request=records.offlineTransactionReplanRequests[0];
  assert.equal(request.id,'offline-transaction-replan-request-20261014');
  assert.equal(request.userReply,'我发现一个问题: 在线下完成交易后, 用户往往不会再在小程序继续进行那一单的操作, 我认为我们可以重新规划相关部分, 节省资源的同时也防止用户逃佣. 你可以从心理学的角度好好考量');
  assert.deepEqual(request.scope,['跑腿','维修','闲置','其它']);
  assert.equal(request.status,'requested-reassessment');
  assert.equal(request.answersPriorRound,false);
  assert.equal(request.approvedModel,null);
  assert.equal(request.approvedRuleReplacement,false);
  assert.equal(request.currentConfirmedRulesRetained,true);
  assert.equal(request.readyForImplementation,false);
  assert.deepEqual(handoff.offlineTransactionReplanRequests,records.offlineTransactionReplanRequests);
  assert.equal(Object.hasOwn(records,'idleRequestDecisionBatches'),false);
  assert.equal(Object.hasOwn(handoff,'idleRequestDecisionBatches'),false);
  assert.equal(records.idleTransactionRules.deliveryCompletion.automaticCompletion,false);
  assert.equal(records.idleChangeRules.newFlowRatingQualification.trigger,'seller-delivery-request-and-buyer-confirmation');
  assert.equal(records.commissionConfirmationRules.businessConfiguration['闲置'].rateBasisPoints,500);
  assert.equal(records.commissionConfirmationRules.businessConfiguration['闲置'].cap.amountCents,2000);
  assert.equal(records.commissionConfirmationRules.trialReview.enabled,false);
});

test('replanning proposals cannot silently enable contact charges, automatic outcomes, payments or ratings', () => {
  const expected={date:'2026-10-14',status:'proposal',recommendedModel:'fixed-matching-service-fee',recommendedPilotScope:['闲置'],alternativeModels:['simplified-percentage-commission','verified-platform-customer-payment'],newFeeAmountConfirmed:false,newFeeAmountCents:null,contactPaywallApproved:false,automaticCompletionApproved:false,automaticDebitApproved:false,customerPaymentCustodyApproved:false,silenceProvesCompletion:false,silenceProvesFraud:false,archiveProvesPayment:false,ratingFromFeePaymentAllowed:false,actualPilotRun:false,effectivenessMeasured:false,qualificationVerified:false,readyForImplementation:false};
  assert.equal(records.offlineTransactionReplanProposals.length,1);
  assert.deepEqual(records.offlineTransactionReplanProposals[0],expected);
  assert.deepEqual(handoff.offlineTransactionReplanProposals,records.offlineTransactionReplanProposals);
  for(const key of ['newFeeAmountConfirmed','contactPaywallApproved','automaticCompletionApproved','automaticDebitApproved','customerPaymentCustodyApproved','silenceProvesCompletion','silenceProvesFraud','archiveProvesPayment','ratingFromFeePaymentAllowed','actualPilotRun','effectivenessMeasured','qualificationVerified','readyForImplementation']){
    const changed=structuredClone(expected);changed[key]=true;
    assert.throws(()=>assert.deepEqual(changed,expected));
  }
  const withInventedFee=structuredClone(expected);withInventedFee.newFeeAmountCents=200;
  assert.throws(()=>assert.deepEqual(withInventedFee,expected));
});

test('behavioral replan reviews alternatives, entry-point leakage and failure scenarios without asserting unobserved conversion or evasion results', () => {
  const request=records.offlineTransactionReplanRequests[0];
  const doc=read(request.document);
  for(const phrase of ['不是对第二十一轮8题作答','先批准联系并展示完整联系方式','本项目待验证的推论','提前付款抵触','不能把看不到的线下交易数当成可测的逃佣率','先用A验证闲置','不能以金额记录、截图或发起支付作为支付成功'])assert(doc.includes(phrase),phrase);
  for(const scenario of ['真正线下成交后不回来操作','仅看帖子、未表达联系意向','支付发起后失败/结果未知','信息虚假或联系方式不可用','撮合成功后线下未成交','双方谎报未成交、重复接触/多账号','新规则前已确认/已出账旧交易'])assert(doc.includes(scenario),scenario);
  assert(doc.includes('不可观察事实'));
  assert(doc.includes('BIT-EAST-1.pdf'));
  assert(doc.includes('不重复收费或追溯改价'));
  const questions=read(request.questionDocument);
  assert(questions.includes('第1题B已确认'));
  assert(questions.includes('第2—8题围绕第1题A'));
  const offered=[...questions.matchAll(/^\| [1-8]（(RP\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(offered.length,8);
  assert.deepEqual(offered.map(x=>x[1]),Array.from({length:8},(_,i)=>'RP'+String(i+1).padStart(2,'0')));
  assert.equal(records.offlineTransactionReplanDecisionBatches.length,1);
  assert.deepEqual(handoff.offlineTransactionReplanDecisionBatches,records.offlineTransactionReplanDecisionBatches);
  const prior=read('docs/module-specs/idle-request-questions-20261014.md');
  assert(prior.includes('本表仍未作答'));
  assert.equal([...prior.matchAll(/^\| [1-8]（IR\d{2}） /gm)].length,8);
  for(const name of ['business-addendum.md','page-spec.md','decisions-and-gaps.md'])assert(read('docs/ui-development-handoff/'+name).includes('offline-transaction-replan-20261014.md'));
});

test('B selects only the original revenue-direction question and does not answer the fixed-matching branch', () => {
  const [batch]=records.offlineTransactionReplanDecisionBatches;
  assert.equal(batch.id,'offline-replan-direction-20261014');
  assert.equal(batch.date,'2026-10-14');
  assert.equal(batch.userReply,'B');
  const rows=[...read(batch.questionDocument).matchAll(/^\| [1-8]（(RP\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(rows.length,8);
  assert.deepEqual(batch.answers,[{questionId:'RP01',answer:'B',selectedOption:rows[0][4].trim()}]);
  assert.deepEqual(batch.notApplicableQuestionIds,rows.slice(1).map(x=>x[1]));
  assert.deepEqual(handoff.offlineTransactionReplanDecisionBatches,records.offlineTransactionReplanDecisionBatches);
  assert.deepEqual(records.commissionSimplificationDirection,{confirmedAt:'2026-10-14',sourceBatch:batch.id,model:'percentage-commission',acceptOfflineBlindSpots:true,simplifyFlow:true,ratesAndCapsChanged:false,fixedMatchingFeeSelected:false,customerPlatformPaymentsSelected:false,automaticBillingMechanismApproved:false,currentRulesReplaced:false,pilotScopeConfirmed:false,readyForImplementation:false});
  assert.deepEqual(handoff.commissionSimplificationDirection,records.commissionSimplificationDirection);
  assert.equal(records.offlineTransactionReplanRequests[0].approvedModel,null);
  assert.equal(records.offlineTransactionReplanProposals[0].status,'proposal');
  assert(read('docs/module-specs/offline-transaction-replan-20261014.md').includes('不把A当已选方案'));
});

test('percentage simplification proposals preserve unknown-price, unresolved-issue and qualification barriers', () => {
  const expected={date:'2026-10-14',status:'proposal',recommendedMechanism:'preagreed-timed-provisional-commission',candidatePilotScope:['闲置'],candidateObjectionWindowHours:72,windowConfirmed:false,needsKnownMutualEffectivePrice:true,needsMutualTimeAndRuleAgreement:true,missingFactsPermitAutomaticCharge:false,unresolvedIssuePermitsAutomaticCharge:false,unknownNotificationPermitsAutomaticCharge:false,definesActualDeliveryCompleted:false,createsRatingQualification:false,createsPersonalIncome:false,automaticDebit:false,enabled:false,legalApplicabilityVerified:false,stateMigrationConfirmed:false,readyForImplementation:false};
  assert.equal(records.commissionSimplificationProposals.length,1);
  assert.deepEqual(records.commissionSimplificationProposals[0],expected);
  assert.deepEqual(handoff.commissionSimplificationProposals,records.commissionSimplificationProposals);
  for(const key of ['windowConfirmed','missingFactsPermitAutomaticCharge','unresolvedIssuePermitsAutomaticCharge','unknownNotificationPermitsAutomaticCharge','definesActualDeliveryCompleted','createsRatingQualification','createsPersonalIncome','automaticDebit','enabled','legalApplicabilityVerified','stateMigrationConfirmed','readyForImplementation']){
    const changed=structuredClone(expected);changed[key]=true;assert.throws(()=>assert.deepEqual(changed,expected));
  }
  assert.equal(records.commissionBillingRules.paymentDeadline.durationHours,72);
  assert.equal(records.commissionBillingRules.paymentDeadline.startsAt,'actual-successful-bill-issuance');
  assert.equal(records.commissionDetailRules.errandEligibility.reference,'RUN11');
  assert.equal(records.commissionDetailRules.errandEligibility.requiresNoObjectionDuring24Hours,true);
  assert.equal(records.idleTransactionRules.deliveryCompletion.automaticCompletion,false);
});

test('commission simplification approval is traceable and provisional billing remains separate from delivery, ratings, income and payment', () => {
  const doc=read('docs/module-specs/commission-simplification-20261014.md');
  for(const phrase of ['原第2—8题是撮合费分支，不适用','未知正式服务费不填0','通知失败/结果未知','不能直接变成真实完成数','仅点击同意也不能保证条款有效','没有真实计时、用户实验','初始低价，实际加价没登记'])assert(doc.includes(phrase),phrase);
  assert(doc.includes('gdca.miit.gov.cn'));
  const questions=read('docs/module-specs/commission-simplification-questions-20261014.md');
  assert(questions.includes('第2题B，其余A'));
  assert(questions.includes('不是既有出账后72小时缴款期限'));
  const offered=[...questions.matchAll(/^\| [1-8]（(CS\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(offered.length,8);
  assert.deepEqual(offered.map(x=>x[1]),Array.from({length:8},(_,i)=>'CS'+String(i+1).padStart(2,'0')));
  assert.equal(records.commissionSimplificationDecisionBatches.length,1);
  assert.deepEqual(handoff.commissionSimplificationDecisionBatches,records.commissionSimplificationDecisionBatches);
  assert.equal(Object.hasOwn(records,'idleRequestDecisionBatches'),false);
  assert.equal(handoff.items.find(x=>x.id==='HD02').confirmed.business,'跑腿');
  for(const name of ['business-addendum.md','page-spec.md','decisions-and-gaps.md']){
    const text=read('docs/ui-development-handoff/'+name);
    assert(text.includes('仅RP01B'));
    assert(text.includes('commission-simplification-20261014.md'));
    assert(text.includes('commission-simplification-questions-20261014.md'));
  }
});

test('simplification first-round reply expands all four businesses with only the second answer B and preserves earlier direction history', () => {
  const [batch]=records.commissionSimplificationDecisionBatches;
  assert.equal(batch.id,'commission-simplification-round-1-20261014');
  assert.equal(batch.date,'2026-10-14');
  assert.equal(batch.userReply,'2B, 全A');
  assert.deepEqual(batch.scope,['跑腿','维修','闲置','其它']);
  const rows=[...read(batch.questionDocument).matchAll(/^\| [1-8]（(CS\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(rows.length,8);
  assert.deepEqual(batch.answers.map(x=>x.questionId),rows.map(x=>x[1]));
  assert.deepEqual(batch.answers.map(x=>x.answer),['A','B','A','A','A','A','A','A']);
  batch.answers.forEach((answer,i)=>assert.equal(answer.selectedOption,rows[i][i===1?4:3].trim()));
  assert.deepEqual(handoff.commissionSimplificationDecisionBatches,records.commissionSimplificationDecisionBatches);
  assert.equal(records.offlineTransactionReplanDecisionBatches[0].answers.length,1);
  assert.equal(records.offlineTransactionReplanDecisionBatches[0].answers[0].answer,'B');
  assert.equal(records.commissionSimplificationDirection.automaticBillingMechanismApproved,false);
  assert.equal(records.commissionSimplificationProposals[0].windowConfirmed,false);
});

test('approved simplification retains known-price and rating barriers while activating only a design decision for the 72-hour mechanism', () => {
  const expected={confirmedAt:'2026-10-14',sourceBatch:'commission-simplification-round-1-20261014',scope:['跑腿','维修','闲置','其它'],mechanism:'preagreed-timed-provisional-commission',automaticProvisionalRecordApproved:true,enabled:false,ratesAndCapsChanged:false,
    objectionWindow:{durationHours:72,hoursConfirmed:true,startsAt:'mutually-agreed-estimated-delivery-end',distinctFromBillPaymentDeadline:true,distinctFromRUN11:true,preciseBoundaryConfirmed:false,resumptionConfirmed:false},
    amountBasis:{kind:'mutually-confirmed-effective-amount',unverifiedReductionEligible:false,unknownPermitsAutomaticBilling:false,estimateOrBudgetEligible:false,implicitZero:false,explicitFreeZeroIsKnown:true,businessAmountRulesRemain:true,repairOtherPhaseBillingPolicyConfirmed:false},
    exceptions:{noDealOrNoCompletion:'pause-entire-transaction',amountOnly:'pause-disputed-part',verificationWorkflowConfirmed:false,unresolvedNotificationsPermitProvisionalBilling:false},
    ratings:{voluntaryActualDeliveryConfirmationRetained:true,provisionalRecordCreatesQualification:false,existingLegitimateQualificationsPreserved:true,moderationPreserved:true},
    idleContactDisclosure:{contactApprovalAloneUnlocks:false,successfulTransactionAndRuleAcknowledgmentRequired:true,newChatOrSearchApproved:false,actualAuthorizationChanged:false},
    provisionalRecord:{provesActualCompletion:false,provesPayment:false,createsPersonalIncome:false,automaticDebit:false},
    billingMonthMappingConfirmed:false,errandLegacyReplacementConfirmed:false,archivePolicyConfirmed:false,oldTransactionsMigrationConfirmed:false,qualificationVerified:false,readyForImplementation:false};
  const verifyCurrent=data=>assert.deepEqual(data,expected);
  verifyCurrent(records.commissionSimplificationRules);verifyCurrent(handoff.commissionSimplificationRules);
  for(const mutate of [
    r=>{r.scope=['闲置'];},
    r=>{r.enabled=true;},
    r=>{r.objectionWindow.durationHours=24;},
    r=>{r.objectionWindow.startsAt='transaction-confirmation';},
    r=>{r.amountBasis.unverifiedReductionEligible=true;},
    r=>{r.amountBasis.unknownPermitsAutomaticBilling=true;},
    r=>{r.amountBasis.implicitZero=true;},
    r=>{r.exceptions.noDealOrNoCompletion='pause-disputed-part';},
    r=>{r.exceptions.unresolvedNotificationsPermitProvisionalBilling=true;},
    r=>{r.ratings.provisionalRecordCreatesQualification=true;},
    r=>{r.idleContactDisclosure.contactApprovalAloneUnlocks=true;},
    r=>{r.idleContactDisclosure.actualAuthorizationChanged=true;},
    r=>{r.provisionalRecord.provesActualCompletion=true;},
    r=>{r.provisionalRecord.createsPersonalIncome=true;},
    r=>{r.provisionalRecord.automaticDebit=true;},
    r=>{r.errandLegacyReplacementConfirmed=true;},
    r=>{r.oldTransactionsMigrationConfirmed=true;},
    r=>{r.readyForImplementation=true;}
  ]){const changed=structuredClone(records.commissionSimplificationRules);mutate(changed);assert.throws(()=>verifyCurrent(changed));}
});

test('approved window examples retain their source while second-round mappings are confirmed separately', () => {
  const rule=records.commissionSimplificationRules;
  assert.equal(Date.parse('2026-11-01T10:00:00+08:00')+rule.objectionWindow.durationHours*3600000,Date.parse('2026-11-04T10:00:00+08:00'));
  assert.equal(records.commissionBillingRules.paymentDeadline.startsAt,'actual-successful-bill-issuance');
  const doc=read('docs/module-specs/commission-simplification-rules.md');
  for(const text of ['1A、2B、3A、4A、5A、6A、7A、8A','2026-11-04 10:00:00','未经批准的真实降价不直接减佣','旧RUN11尚未决定取消或保留','仅联系申请获准仍打码','没有实现或验证真实计时'])assert(doc.includes(text),text);
  assert(read('CONTEXT.md').includes('**暂定计佣记录**'));
  const questions=read('docs/module-specs/commission-simplification-boundaries-questions-20261014.md');
  assert(questions.includes('本轮8题全部A'));
  const rows=[...questions.matchAll(/^\| [1-8]（(SB\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(rows.length,8);
  assert.deepEqual(rows.map(x=>x[1]),Array.from({length:8},(_,i)=>'SB'+String(i+1).padStart(2,'0')));
  assert.equal(records.commissionSimplificationBoundaryDecisionBatches.length,1);
  assert.deepEqual(handoff.commissionSimplificationBoundaryDecisionBatches,records.commissionSimplificationBoundaryDecisionBatches);
  for(const name of ['business-addendum.md','page-spec.md','decisions-and-gaps.md']){
    const text=read('docs/ui-development-handoff/'+name);
    assert(text.includes('简化第一轮实际回复“2B, 全A”'));
    assert(text.includes('commission-simplification-rules.md'));
    assert(text.includes('commission-simplification-boundaries-questions-20261014.md'));
  }
});

test('simplification second-round all-A answers map to their original options without backdating first-round pending boundaries', () => {
  const [batch]=records.commissionSimplificationBoundaryDecisionBatches;
  assert.equal(batch.id,'commission-simplification-round-2-20261014');
  assert.equal(batch.date,'2026-10-14');
  assert.equal(batch.userReply,'全A');
  assert.deepEqual(batch.scope,['跑腿','维修','闲置','其它']);
  const offered=[...read(batch.questionDocument).matchAll(/^\| [1-8]（(SB\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(offered.length,8);
  assert.deepEqual(batch.answers.map(x=>x.questionId),offered.map(x=>x[1]));
  assert.deepEqual(batch.answers.map(x=>x.answer),Array(8).fill('A'));
  batch.answers.forEach((answer,i)=>assert.equal(answer.selectedOption,offered[i][3].trim()));
  assert.deepEqual(handoff.commissionSimplificationBoundaryDecisionBatches,records.commissionSimplificationBoundaryDecisionBatches);
  assert.equal(records.commissionSimplificationRules.errandLegacyReplacementConfirmed,false);
  assert.equal(records.commissionSimplificationRules.archivePolicyConfirmed,false);
  assert.equal(records.commissionDetailRules.errandEligibility.conditionalAutomaticCompletion,true);
});

test('approved first-release boundary rules reject 24-hour automatic completion, double billing, unconfirmed extensions and false archive facts', () => {
  const expected={confirmedAt:'2026-10-14',sourceBatch:'commission-simplification-round-2-20261014',scope:['跑腿','维修','闲置','其它'],enabled:false,ratesAndCapsChanged:false,
    errandCompletion:{automaticCompletionAfter24Hours:false,actualCompletionRequiresExplicitConfirmation:true},
    earlyActualDelivery:{recordMayFormBeforeWindow:true,effectiveAmountRequired:true,pendingPriceChangeBlocks:true,updatesExistingPrimaryRecord:true,pendingExtensionCancellationHandlingConfirmed:false},
    primaryRecord:{onePerTransaction:true,firstSuccessfulFormationTimePreserved:true,identifierAndConcurrencyConfirmed:false},
    recordMonth:{basis:'first-successful-primary-record-formation',timezone:'Asia/Shanghai',useExpectedEndMonth:false,lateProcessingPolicyConfirmed:false},
    extension:{proposedBy:'either-party',requiresOtherPartyConfirmation:true,pendingBlocksProvisionalBilling:true,requestDetailsConfirmed:false},
    issueResumption:{requiresVerifiedClearance:true,startAt:'later-of-effective-clearance-and-current-agreed-estimated-end',durationHours:72,useOldRemainingTime:false,partialIssueHandlingConfirmed:false},
    phaseBilling:{scope:['维修','其它'],effectiveServiceFeeSum:true,perStageBilling:false,at:'final-estimated-end-followed-by-window-or-valid-earlier-delivery',oneServiceCap:true,useCurrentEffectiveVersions:true,materialExpensesIncluded:false,unknownFutureCostDefaultsZero:false,preciseFieldsConfirmed:false},
    archive:{automaticOnProvisionalRecord:true,onlyWhileActualDeliveryUnconfirmed:true,label:'交付未确认',retainsDisputeAccess:true,doesNotEndActualObligations:true,idleHiddenFromForSale:true,idleMarkedActuallySold:false,contactPermissionPolicyConfirmed:false},
    consent:{sameScreen:true,bothExplicitRequired:true,retainRuleVersion:true,defaultChecked:false,singlePartyCoversOther:false,fieldsConfirmed:false},
    actualCompletionOrPaymentFromProvisionalRecord:false,personalIncomeFromProvisionalRecord:false,ratingFromProvisionalRecord:false,automaticDebit:false,qualificationVerified:false,readyForImplementation:false};
  const verifyRules=data=>assert.deepEqual(data,expected);
  verifyRules(records.commissionSimplificationBoundaryRules);verifyRules(handoff.commissionSimplificationBoundaryRules);
  for(const mutate of [
    r=>{r.enabled=true;},
    r=>{r.errandCompletion.automaticCompletionAfter24Hours=true;},
    r=>{r.errandCompletion.actualCompletionRequiresExplicitConfirmation=false;},
    r=>{r.primaryRecord.onePerTransaction=false;},
    r=>{r.primaryRecord.firstSuccessfulFormationTimePreserved=false;},
    r=>{r.recordMonth.useExpectedEndMonth=true;},
    r=>{r.extension.requiresOtherPartyConfirmation=false;},
    r=>{r.extension.pendingBlocksProvisionalBilling=false;},
    r=>{r.issueResumption.requiresVerifiedClearance=false;},
    r=>{r.issueResumption.useOldRemainingTime=true;},
    r=>{r.phaseBilling.perStageBilling=true;},
    r=>{r.phaseBilling.materialExpensesIncluded=true;},
    r=>{r.phaseBilling.unknownFutureCostDefaultsZero=true;},
    r=>{r.archive.idleMarkedActuallySold=true;},
    r=>{r.archive.retainsDisputeAccess=false;},
    r=>{r.consent.defaultChecked=true;},
    r=>{r.consent.singlePartyCoversOther=true;},
    r=>{r.ratingFromProvisionalRecord=true;},
    r=>{r.automaticDebit=true;},
    r=>{r.readyForImplementation=true;}
  ]){const changed=structuredClone(records.commissionSimplificationBoundaryRules);mutate(changed);assert.throws(()=>verifyRules(changed));}
});

test('boundary time and month scenarios are exact and unresolved third-round safeguards remain proposals', () => {
  const hours=records.commissionSimplificationBoundaryRules.issueResumption.durationHours;
  const resumed=(clearance,end)=>Math.max(Date.parse(clearance),Date.parse(end))+hours*3600000;
  assert.equal(resumed('2026-11-03T12:00:00+08:00','2026-11-02T12:00:00+08:00'),Date.parse('2026-11-06T12:00:00+08:00'));
  assert.equal(resumed('2026-11-03T12:00:00+08:00','2026-11-05T18:00:00+08:00'),Date.parse('2026-11-08T18:00:00+08:00'));
  assert.equal(Date.parse('2026-10-31T23:00:00+08:00')+72*3600000,Date.parse('2026-11-03T23:00:00+08:00'));
  const month=iso=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit'}).formatToParts(new Date(iso)).filter(x=>x.type==='year'||x.type==='month').map(x=>[x.type,x.value]));return `${p.year}-${p.month}`;};
  assert.equal(month('2026-11-01T00:01:00+08:00'),'2026-11');
  assert.equal(month('2026-10-30T18:00:00+08:00'),'2026-10');
  const raw=((10000n+15000n)*1500n+5000n)/10000n;
  assert.equal(raw,3750n);
  assert.equal(raw>3000n?3000n:raw,3000n);
  const rules=read('docs/module-specs/commission-simplification-boundaries-rules.md');
  for(const phrase of ['首发业务规则规划','不规划存量交易迁移','首次成功形成时点保留','统一进入72小时窗口','11月6日12:00','11月8日18:00','没有实现或验证真实订单'])assert(rules.includes(phrase),phrase);
  assert(read('CONTEXT.md').includes('**暂定计佣归档**'));
  const questions=read('docs/module-specs/commission-simplification-operation-questions-20261014.md');
  assert(questions.includes('SO02—SO08共7题仍待答'));
  const rows=[...questions.matchAll(/^\| [1-8]（(SO\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(rows.length,8);
  assert.deepEqual(rows.map(x=>x[1]),['SO09',...Array.from({length:7},(_,i)=>'SO'+String(i+2).padStart(2,'0'))]);
  assert(questions.includes('已有明确金额/时间后'));
  assert(questions.includes('不套用首次费用未知'));
  assert.equal(Object.hasOwn(records,'commissionSimplificationOperationDecisionBatches'),false);
  assert.equal(Object.hasOwn(handoff,'commissionSimplificationOperationDecisionBatches'),false);
  for(const name of ['business-addendum.md','page-spec.md','decisions-and-gaps.md']){
    const text=read('docs/ui-development-handoff/'+name);
    assert(text.includes('衔接第二轮实际回复“全A”'));
    assert(text.includes('commission-simplification-boundaries-rules.md'));
    assert(text.includes('commission-simplification-operation-questions-20261014.md'));
  }
});

test('first-release clarification withdraws migration question without inventing answers or changing income and rating eligibility', () => {
  const expected = {
    confirmedAt:'2026-10-14',
    userReply:'现在还没写代码, 不存在旧机制新机制',
    annotationQuestion:'那如果用户懒得确认怎么办?',
    document:'docs/module-specs/planning-stage-clarification-20261014.md',
    phase:'first-release-business-planning',
    operationalLegacyMechanismExists:false,
    existingTransactionMigrationRequired:false,
    priorDocumentsAreDesignHistory:true,
    currentBoundaryRules:'commissionSimplificationBoundaryRules',
    withdrawnQuestionIds:['SO01'],
    withdrawalIsAnAnswer:false,
    pendingQuestionIds:['SO02','SO03','SO04','SO05','SO06','SO07','SO08'],
    missingCompletionClickAloneBlocksProvisionalCommission:false,
    actualCompletionIncomeAndRatingRulesChanged:false,
    enablesProductImplementation:false
  };
  const validate = data => {
    assert.deepEqual(data.planningStageClarification, expected);
    assert.equal(Object.hasOwn(data,'commissionSimplificationOperationDecisionBatches'),false);
    const boundary = data[expected.currentBoundaryRules];
    assert.equal(Object.hasOwn(boundary,'legacyErrandRule'),false);
    assert.equal(Object.hasOwn(boundary,'oldTransactionsApplicabilityConfirmed'),false);
    assert.deepEqual(boundary.errandCompletion,{automaticCompletionAfter24Hours:false,actualCompletionRequiresExplicitConfirmation:true});
    assert.equal(boundary.archive.automaticOnProvisionalRecord,true);
    assert.equal(boundary.archive.label,'交付未确认');
    assert.equal(boundary.personalIncomeFromProvisionalRecord,false);
    assert.equal(boundary.ratingFromProvisionalRecord,false);
    assert.equal(data.commissionSimplificationRules.objectionWindow.durationHours,72);
    assert.equal(data.commissionSimplificationRules.amountBasis.unknownPermitsAutomaticBilling,false);
    assert.equal(data.commissionSimplificationRules.exceptions.noDealOrNoCompletion,'pause-entire-transaction');
  };
  validate(records); validate(handoff);
  for (const mutate of [
    data => { data.planningStageClarification.existingTransactionMigrationRequired = true; },
    data => { data.planningStageClarification.withdrawalIsAnAnswer = true; },
    data => { data.commissionSimplificationOperationDecisionBatches = [{userReply:'全A'}]; },
    data => { data.planningStageClarification.missingCompletionClickAloneBlocksProvisionalCommission = true; },
    data => { data.commissionSimplificationBoundaryRules.personalIncomeFromProvisionalRecord = true; },
    data => { data.commissionSimplificationBoundaryRules.ratingFromProvisionalRecord = true; },
    data => { data.commissionSimplificationRules.amountBasis.unknownPermitsAutomaticBilling = true; }
  ]) {
    const changed = structuredClone(records); mutate(changed); assert.throws(() => validate(changed));
  }
  const doc = read(expected.document);
  for (const text of [expected.userReply,expected.annotationQuestion,'原PRD、各轮问题和实际回复是可追溯的设计历史','不需要用户再次点击完成','连续72小时','个人收入','排除垫付款','本次不代用户决定','SO02—SO08仍未作答']) assert(doc.includes(text),text);
  const pending = read('docs/module-specs/commission-simplification-operation-questions-20261014.md');
  assert(pending.includes('SO01仅为提问追溯保留，不是待答项，也没有A/B选择结果'));
  const rules = read('docs/module-specs/commission-simplification-boundaries-rules.md');
  assert(rules.includes('无需等待用户点击完成才能有条件暂定计佣'));
  assert(rules.includes('未知费用、未确认调整或有效未解决异议'));
  for (const file of [
    'docs/module-specs/README.md',
    'docs/module-specs/commission-simplification-rules.md',
    'docs/module-specs/commission-simplification-20261014.md',
    'docs/module-specs/commission-simplification-questions-20261014.md',
    'docs/module-specs/commission-simplification-boundaries-questions-20261014.md',
    'docs/ui-development-handoff/README.md',
    'docs/ui-development-handoff/business-addendum.md',
    'docs/ui-development-handoff/page-spec.md',
    'docs/ui-development-handoff/decisions-and-gaps.md'
  ]) {
    const text = read(file);
    assert(text.includes('首发阶段纠偏：2026-10-14'),file);
    assert(text.includes('planning-stage-clarification-20261014.md'),file);
  }
});

test('continued question preparation preserves eight unanswered choices and pauses them when the user changes the completion direction', () => {
  const expected={preparedAt:'2026-10-14',revision:'first-release-round-3-20261014',request:'继续',status:'paused-for-deadline-completion-planning',questionDocument:'docs/module-specs/commission-simplification-operation-questions-20261014.md',displayOrder:['SO09','SO02','SO03','SO04','SO05','SO06','SO07','SO08'],withdrawnQuestionIds:['SO01'],newlyProposedQuestionIds:['SO09'],continuationCountsAsAnswer:false,choicesApproved:false,confirmedIncomeDefinitionChanged:false,actualCompletionOrRatingRulesChanged:false,implementationEnabled:false};
  assert.deepEqual(records.commissionSimplificationOperationQuestionSet,expected);
  assert.deepEqual(handoff.commissionSimplificationOperationQuestionSet,expected);
  const doc=read(expected.questionDocument);
  const rows=[...doc.matchAll(/^\| [1-8]（(SO\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.deepEqual(rows.map(row=>row[1]),expected.displayOrder);
  assert(doc.includes('本表八题未获回答'));
  assert(doc.includes('SO01仅为提问追溯保留，不是待答项'));
  assert(doc.includes('“继续”不是选项答案'));
  assert(doc.includes('均注明“非到账金额”'));
  assert(doc.includes('详情独立展示、不占主收入'));
  assert(doc.includes('不批准仅凭暂定计佣认定真实交付或评价资格'));
  assert.equal(Object.hasOwn(records,'commissionSimplificationOperationDecisionBatches'),false);
  assert.equal(Object.hasOwn(handoff,'commissionSimplificationOperationDecisionBatches'),false);
});

test('deadline completion direction snapshot remains unchanged while first-round answers are recorded separately', () => {
  const expected={date:'2026-10-14',userReply:'都设定一个服务结束期限吧, 到了期限自动完成',scope:['跑腿','维修','闲置','其它'],document:'docs/module-specs/deadline-completion-request-20261014.md',confirmedDirection:{allBusinessRequireEndDeadline:true,automaticFlowCompletionAtDeadline:true,customerCompletionClickRequiredForAutomaticCompletion:false},preciseDeadlinePolicyConfirmed:false,relationshipTo72HourWindowConfirmed:false,exceptionPolicyConfirmed:false,feeAndCommissionLinkConfirmed:false,incomeAndRatingChangesConfirmed:false,provesActualPayment:false,implementationEnabled:false};
  const focus={date:'2026-10-14',phase:'first-release-business-planning',direction:'deadline-automatic-completion',directionDocument:expected.document,questionDocument:'docs/module-specs/deadline-completion-questions-20261014.md',status:'direction-confirmed-details-pending',pendingQuestionIds:['AF01','AF02','AF03','AF04','AF05','AF06','AF07','AF08'],priorQuestionSetPaused:true,implementationEnabled:false};
  const validate=data=>{
    assert.deepEqual(data.automaticDeadlineCompletionRequests,[expected]);
    assert.deepEqual(data.planningFocusHistory[0],focus);
    assert.equal(data.currentPlanningFocus.implementationEnabled,false);
    assert.equal(data.deadlineCompletionDecisionBatches[0].userReply,'7B, 全A');
    assert.equal(data.commissionSimplificationOperationQuestionSet.choicesApproved,false);
    assert.equal(data.commissionSimplificationBoundaryDecisionBatches[0].userReply,'全A');
    assert.equal(data.planningStageClarification.existingTransactionMigrationRequired,false);
    assert.equal(data.commissionSimplificationRules.amountBasis.unknownPermitsAutomaticBilling,false);
    assert.equal(data.commissionBillingRules.paymentDeadline.durationHours,72);
    assert.equal(data.commissionBillingRules.paymentDeadline.startsAt,'actual-successful-bill-issuance');
    assert.equal(data.commissionSimplificationBoundaryRules.primaryRecord.onePerTransaction,true);
  };
  validate(records);validate(handoff);
  for(const mutate of [
    data=>{data.automaticDeadlineCompletionRequests[0].scope=['跑腿'];},
    data=>{data.automaticDeadlineCompletionRequests[0].confirmedDirection.automaticFlowCompletionAtDeadline=false;},
    data=>{data.automaticDeadlineCompletionRequests[0].relationshipTo72HourWindowConfirmed=true;},
    data=>{data.automaticDeadlineCompletionRequests[0].incomeAndRatingChangesConfirmed=true;},
    data=>{data.automaticDeadlineCompletionRequests[0].provesActualPayment=true;},
    data=>{data.currentPlanningFocus.implementationEnabled=true;},
    data=>{data.deadlineCompletionDecisionBatches=[{userReply:'全A'}];},
    data=>{data.commissionSimplificationRules.amountBasis.unknownPermitsAutomaticBilling=true;}
  ]){const changed=structuredClone(records);mutate(changed);assert.throws(()=>validate(changed));}
  const request=read(expected.document);
  assert(request.includes(expected.userReply));
  assert(request.includes('不将系统到期行为伪称为用户点击确认或线下付款'));
  assert(request.includes('四类交易都设置结束期限'));
  const questions=read(focus.questionDocument);
  const rows=[...questions.matchAll(/^\| [1-8]（(AF\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(rows.length,8);
  assert.deepEqual(rows.map(row=>row[1]),focus.pendingQuestionIds);
  assert(questions.includes('对应1A、2A、3A、4A、5A、6A、7B、8A'));
  for(const phrase of ['预计结束时间后保留72小时','不默认0、不按未知金额计佣','未经双方确认不改变既有结束期限','首次成功形成月份归账','不重复累计自动结束后又补确认','不自动生成评分','出账成功后的72小时缴佣期限是独立时钟','不因到点就默认取得资格']) assert(questions.includes(phrase),phrase);
  for(const file of ['docs/module-specs/README.md','docs/module-specs/commission-simplification-rules.md','docs/module-specs/commission-simplification-boundaries-rules.md','docs/module-specs/planning-stage-clarification-20261014.md','docs/ui-development-handoff/README.md','docs/ui-development-handoff/business-addendum.md','docs/ui-development-handoff/page-spec.md','docs/ui-development-handoff/decisions-and-gaps.md']){
    const doc=read(file);assert(doc.includes('当前规划方向更新：'));assert(doc.includes('deadline-completion-request-20261014.md'));assert(doc.includes('deadline-completion-questions-20261014.md'));
  }
});

test('deadline first-round reply maps only AF07 to B and keeps the exact offered choices in both handoff records', () => {
  assert.equal(records.deadlineCompletionDecisionBatches.length,1);
  const [batch]=records.deadlineCompletionDecisionBatches;
  assert.equal(batch.id,'deadline-completion-round-1-20261014');
  assert.equal(batch.date,'2026-10-14');
  assert.equal(batch.userReply,'7B, 全A');
  assert.deepEqual(batch.scope,['跑腿','维修','闲置','其它']);
  const rows=[...read(batch.questionDocument).matchAll(/^\| [1-8]（(AF\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(rows.length,8);
  assert.deepEqual(batch.answers.map(answer=>answer.questionId),rows.map(row=>row[1]));
  assert.deepEqual(batch.answers.map(answer=>answer.answer),['A','A','A','A','A','A','B','A']);
  batch.answers.forEach((answer,i)=>assert.equal(answer.selectedOption,rows[i][i===6?4:3].trim()));
  assert.deepEqual(handoff.deadlineCompletionDecisionBatches,records.deadlineCompletionDecisionBatches);
  assert.equal(records.automaticDeadlineCompletionRequests[0].incomeAndRatingChangesConfirmed,false);
  assert.equal(records.planningFocusHistory[0].status,'direction-confirmed-details-pending');
  assert.equal(records.commissionSimplificationBoundaryRules.extension.pendingBlocksProvisionalBilling,true);
  assert.equal(records.deadlineCompletionRules.extension.pendingAloneBlocksCommission,false);
  assert.equal(Object.hasOwn(records,'commissionSimplificationOperationDecisionBatches'),false);
});

test('approved deadline rules keep 72 hours, allow fee-pending flow completion and voluntary ratings while preserving acknowledged-delivery income', () => {
  const expected={
    confirmedAt:'2026-10-14',sourceBatch:'deadline-completion-round-1-20261014',scope:['跑腿','维修','闲置','其它'],enabled:false,
    deadline:{mutualAgreementAt:'transaction-confirmation',expectedEndPrecision:'minute',automaticAt:'agreed-expected-end-plus-72-hours',windowHours:72,displayBothTimes:true,repeatWindow:false,proposalActorConfirmed:false,pastTimePolicyConfirmed:false},
    completion:{automatic:true,requiresReturnClick:false,automaticProvesUserAcknowledgedDelivery:false,knownFeeRequired:false,unresolvedValidDeliverySaleOrCancellationDispute:'pause',deadlineInstantPriorityConfirmed:false,pendingCancellationAlonePolicyConfirmed:false,pendingRequestClosureConfirmed:false,provesPayment:false},
    fees:{unknownOrPending:'pending-after-automatic-completion',implicitZero:false,pendingAutoConsent:false,mutualHandlingAfterAutomaticCompletion:true,postAutomaticCompletionEditScopeConfirmed:false,laterEffectiveFeeCommissionTimingConfirmed:false,explicitCompletionPendingFeeBarrierRetained:true},
    extension:{requiresMutualConfirmation:true,pendingChangesDeadline:false,pendingAloneBlocksAutomaticCompletion:false,pendingAloneBlocksCommission:false,requestLimitConfirmed:false,confirmedExtensionTimingPolicyConfirmed:false},
    commission:{atAutomaticCompletionWhenEligible:true,effectiveAmountRequired:true,unknownOrPendingPermitsBilling:false,unverifiedReductionEligible:false,onePrimaryRecordPerTransaction:true,firstFormationMonthPreserved:true,phaseCapOnce:true,automaticDebit:false,provesCustomerPayment:false},
    income:{business:'跑腿',subject:'provider',copyRetained:true,explicitDeliveryAcknowledgmentRequired:true,automaticCompletionAloneIncluded:false,automaticCompletionListedSeparately:true,advancesIncluded:false,netAfterCommission:false,representsReceivedMoney:false,duplicateOnLaterDeliveryAcknowledgment:false,detailFieldsConfirmed:false},
    ratings:{automaticCompletionOpensVoluntaryEntryWithoutUnresolvedValidDeliveryDispute:true,effectiveTransactionPartiesOnly:true,autoGeneratesStars:false,provesActualDelivery:false,cancellationCreatesQualification:false,existingDimensionsAndModerationPreserved:true,postCompletionDisputeHandlingConfirmed:false},
    contactPermissionAfterAutomaticCompletionConfirmed:false,externalQualificationVerified:false,readyForImplementation:false
  };
  const validate=rules=>assert.deepEqual(rules,expected);
  validate(records.deadlineCompletionRules);validate(handoff.deadlineCompletionRules);
  for(const mutate of [
    rules=>{rules.enabled=true;},
    rules=>{rules.deadline.windowHours=24;},
    rules=>{rules.deadline.repeatWindow=true;},
    rules=>{rules.deadline.mutualAgreementAt='unilateral-provider-edit';},
    rules=>{rules.completion.requiresReturnClick=true;},
    rules=>{rules.completion.knownFeeRequired=true;},
    rules=>{rules.completion.unresolvedValidDeliverySaleOrCancellationDispute='ignore';},
    rules=>{rules.fees.implicitZero=true;},
    rules=>{rules.fees.pendingAutoConsent=true;},
    rules=>{rules.extension.pendingAloneBlocksCommission=true;},
    rules=>{rules.extension.pendingChangesDeadline=true;},
    rules=>{rules.commission.unknownOrPendingPermitsBilling=true;},
    rules=>{rules.commission.onePrimaryRecordPerTransaction=false;},
    rules=>{rules.commission.phaseCapOnce=false;},
    rules=>{rules.income.automaticCompletionAloneIncluded=true;},
    rules=>{rules.income.copyRetained=false;},
    rules=>{rules.income.business='所有业务';},
    rules=>{rules.income.representsReceivedMoney=true;},
    rules=>{rules.ratings.automaticCompletionOpensVoluntaryEntryWithoutUnresolvedValidDeliveryDispute=false;},
    rules=>{rules.ratings.autoGeneratesStars=true;},
    rules=>{rules.ratings.cancellationCreatesQualification=true;},
    rules=>{rules.readyForImplementation=true;}
  ]){const changed=structuredClone(expected);mutate(changed);assert.throws(()=>validate(changed));}
  assert.equal(handoff.items.find(item=>item.id==='HD02').confirmed.disclosure,'非到账金额');
  assert.equal(handoff.items.find(item=>item.id==='HD02').confirmed.business,'跑腿');
  assert.deepEqual(handoff.items.find(item=>item.id==='HD02').completionIncomeResolutionHistory[0],{topic:'自动完成计入口径',sourceBatch:'deadline-completion-round-1-20261014',questionId:'AF07',answer:'B',explicitDeliveryAcknowledgmentRequired:true,automaticCompletionAloneIncluded:false,automaticCompletionListedSeparately:true});
  assert.equal(records.commissionConfirmationRules.businessConfiguration['维修'].cap.amountCents,3000);
  assert.equal(records.commissionConfirmationRules.businessConfiguration['闲置'].cap.amountCents,2000);
  assert.equal(records.commissionConfirmationRules.businessConfiguration['其它'].cap.amountCents,2000);
  assert.equal(records.commissionBillingRules.paymentDeadline.startsAt,'actual-successful-bill-issuance');
});

test('deadline acceptance examples and pending boundary questions separate completion, commission, income and rating facts', () => {
  const rule=records.deadlineCompletionRules;
  assert.equal(Date.parse('2026-10-18T18:00:00+08:00')+rule.deadline.windowHours*3600000,Date.parse('2026-10-21T18:00:00+08:00'));
  assert.equal(Date.parse('2026-10-31T23:00:00+08:00')+rule.deadline.windowHours*3600000,Date.parse('2026-11-03T23:00:00+08:00'));
  const doc=read('docs/module-specs/deadline-completion-rules.md');
  for(const text of ['1A、2A、3A、4A、5A、6A、7B、8A','正常自动完成','不能把完成月份冒充记录形成月份','不按未知金额或待确认方案计佣','没有费用值时不展示伪造0元','评价资格也不证明已付款','2026-10-21 18:00','只使用一次封顶','当前仅检查文档']) assert(doc.includes(text),text);
  const expectedFocus={date:'2026-10-14',phase:'first-release-business-planning',direction:'deadline-automatic-completion',directionDocument:'docs/module-specs/deadline-completion-request-20261014.md',ruleDocument:'docs/module-specs/deadline-completion-rules.md',sourceBatch:'deadline-completion-round-1-20261014',questionDocument:'docs/module-specs/deadline-completion-boundaries-questions-20261014.md',status:'first-round-confirmed-boundaries-pending',pendingQuestionIds:['DA01','DA02','DA03','DA04','DA05','DA06','DA07','DA08'],priorQuestionSetPaused:true,implementationEnabled:false};
  assert.deepEqual(records.planningFocusHistory[1],expectedFocus);
  assert.deepEqual(handoff.planningFocusHistory[1],expectedFocus);
  const questions=read(expectedFocus.questionDocument);
  assert(questions.includes('对应1B、2A、3A、4A、5A、6A、7A、8A'));
  const offered=[...questions.matchAll(/^\| [1-8]（(DA\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(offered.length,8);
  assert.deepEqual(offered.map(row=>row[1]),expectedFocus.pendingQuestionIds);
  assert.equal(records.deadlineCompletionBoundaryDecisionBatches[0].userReply,'1B, 全A');
  assert.deepEqual(handoff.deadlineCompletionBoundaryDecisionBatches,records.deadlineCompletionBoundaryDecisionBatches);
  assert(questions.includes('不覆盖已有有效计佣记录的后续加价/降价更正'));
  assert(questions.includes('不自动开放原费用凭据或新增运营查看权限'));
  const glossary=read('CONTEXT.md');
  assert(glossary.includes('**预计结束时间**'));
  assert(glossary.includes('**自动完成期限**'));
  assert(glossary.includes('**自动完成**'));
  assert(!glossary.includes('无人回应保持待确认，不自动完成'));
  for(const file of ['docs/module-specs/README.md','docs/module-specs/deadline-completion-request-20261014.md','docs/module-specs/commission-simplification-rules.md','docs/module-specs/commission-simplification-boundaries-rules.md','docs/module-specs/planning-stage-clarification-20261014.md','docs/ui-development-handoff/README.md','docs/ui-development-handoff/business-addendum.md','docs/ui-development-handoff/page-spec.md','docs/ui-development-handoff/decisions-and-gaps.md']){
    const text=read(file);assert(text.includes('结束期限第一轮确认：'));assert(text.includes('deadline-completion-rules.md'));assert(text.includes('deadline-completion-boundaries-questions-20261014.md'));
  }
});

test('deadline boundary reply maps only DA01 to B and preserves prior income and completion choices', () => {
  assert.equal(records.deadlineCompletionBoundaryDecisionBatches.length,1);
  const [batch]=records.deadlineCompletionBoundaryDecisionBatches;
  assert.equal(batch.id,'deadline-completion-round-2-20261014');
  assert.equal(batch.date,'2026-10-14');
  assert.equal(batch.userReply,'1B, 全A');
  assert.deepEqual(batch.scope,['跑腿','维修','闲置','其它']);
  const rows=[...read(batch.questionDocument).matchAll(/^\| [1-8]（(DA\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(rows.length,8);
  assert.deepEqual(batch.answers.map(answer=>answer.questionId),rows.map(row=>row[1]));
  assert.deepEqual(batch.answers.map(answer=>answer.answer),['B','A','A','A','A','A','A','A']);
  batch.answers.forEach((answer,i)=>assert.equal(answer.selectedOption,rows[i][i===0?4:3].trim()));
  assert.deepEqual(handoff.deadlineCompletionBoundaryDecisionBatches,records.deadlineCompletionBoundaryDecisionBatches);
  assert.equal(records.deadlineCompletionDecisionBatches[0].userReply,'7B, 全A');
  assert.equal(records.deadlineCompletionRules.deadline.proposalActorConfirmed,false);
  assert.equal(records.deadlineCompletionRules.income.automaticCompletionAloneIncluded,false);
  assert.equal(records.deadlineCompletionRules.ratings.automaticCompletionOpensVoluntaryEntryWithoutUnresolvedValidDeliveryDispute,true);
  assert.equal(records.deadlineCompletionRules.contactPermissionAfterAutomaticCompletionConfirmed,false);
  assert.equal(handoff.items.find(item=>item.id==='HD02').completionIncomeResolutionHistory[0].answer,'B');
});

test('approved deadline boundaries reject unilateral time changes, silent cancellations, early completion and unearned billing or private access', () => {
  const expected={
    confirmedAt:'2026-10-14',sourceBatch:'deadline-completion-round-2-20261014',scope:['跑腿','维修','闲置','其它'],enabled:false,
    timeProposal:{by:'customer',explicitCounterpartyAcceptanceRequired:true,usedAtTransactionConfirmation:true,secondWorkerAcceptanceAfterSelectionRequired:false,perBusinessEntryConfirmed:false},
    timeValidation:{at:'server-side-transaction-confirmation',pastExpectedEnd:'reject-and-reagree-future',silentTimeShift:false,equalMomentPolicyConfirmed:false},
    extensionRequest:{maxPendingPerTransaction:1,edit:'withdraw-before-resubmit',preserveHistory:true,combinedWithFeeOrCancelLimit:false,withdrawActorsConfirmed:false},
    deadlineBoundary:{clock:'server-effective-receipt',validIssueReceivedExactlyAtDeadlineAccepted:true,automaticCompletionPermittedAtDeadline:false,automaticCompletionRequiresStrictlyAfterDeadline:true,lateAppealsRetained:true,fullConcurrencyPolicyConfirmed:false},
    pendingCancellation:{aloneBlocksAutomaticCompletion:false,silenceIsAgreement:false,validDisputePauses:true,alreadyCancelledCanAutomaticallyComplete:false},
    lateFeeCommission:{scope:'automatically-completed-without-primary-record-first-formal-fee-unknown-or-pending',startsAt:'formal-fee-effective',windowHours:72,requiresNoEffectiveBlocker:true,reopensFlow:false,unknownDefaultsZero:false,appliesToExistingRecordChanges:false,firstFormationMonthRetained:true,exactBoundaryConfirmed:false,repricingWithinWindowPolicyConfirmed:false},
    requestClosure:{onSuccessfulNormalAutomaticCompletion:true,pendingExtensionsClosed:true,pendingCancellationsClosed:true,preserveHistory:true,closureMeansAgreement:false,pendingFeesRetained:true,validIssuesAutoResolved:false},
    contact:{maskCounterpartyAfterAutomaticCompletion:true,closeCounterpartyPrivateAddressAccess:true,preserveFeeAndIssueEntries:true,preserveOwnNecessaryHistoryAndManagement:true,recoveryWorkflowConfirmed:false,receiptPermissionsExpanded:false,automaticReceiptClosurePolicyConfirmed:false,operatorAccessGranted:false,realAuthorizationChanged:false},
    firstRoundIncomeAndRatingRulesChanged:false,ratesAndCapsChanged:false,automaticDebit:false,provesCustomerPayment:false,readyForImplementation:false
  };
  const validate=rules=>assert.deepEqual(rules,expected);
  validate(records.deadlineCompletionBoundaryRules);validate(handoff.deadlineCompletionBoundaryRules);
  for(const mutate of [
    rules=>{rules.enabled=true;},
    rules=>{rules.timeProposal.by='provider';},
    rules=>{rules.timeProposal.explicitCounterpartyAcceptanceRequired=false;},
    rules=>{rules.timeProposal.secondWorkerAcceptanceAfterSelectionRequired=true;},
    rules=>{rules.timeValidation.silentTimeShift=true;},
    rules=>{rules.extensionRequest.maxPendingPerTransaction=2;},
    rules=>{rules.extensionRequest.edit='edit-in-place';},
    rules=>{rules.deadlineBoundary.clock='client-clock';},
    rules=>{rules.deadlineBoundary.automaticCompletionPermittedAtDeadline=true;},
    rules=>{rules.deadlineBoundary.validIssueReceivedExactlyAtDeadlineAccepted=false;},
    rules=>{rules.pendingCancellation.aloneBlocksAutomaticCompletion=true;},
    rules=>{rules.pendingCancellation.silenceIsAgreement=true;},
    rules=>{rules.lateFeeCommission.startsAt='automatic-completion';},
    rules=>{rules.lateFeeCommission.windowHours=0;},
    rules=>{rules.lateFeeCommission.reopensFlow=true;},
    rules=>{rules.lateFeeCommission.unknownDefaultsZero=true;},
    rules=>{rules.lateFeeCommission.appliesToExistingRecordChanges=true;},
    rules=>{rules.requestClosure.pendingFeesRetained=false;},
    rules=>{rules.requestClosure.closureMeansAgreement=true;},
    rules=>{rules.requestClosure.validIssuesAutoResolved=true;},
    rules=>{rules.contact.maskCounterpartyAfterAutomaticCompletion=false;},
    rules=>{rules.contact.closeCounterpartyPrivateAddressAccess=false;},
    rules=>{rules.contact.receiptPermissionsExpanded=true;},
    rules=>{rules.firstRoundIncomeAndRatingRulesChanged=true;},
    rules=>{rules.readyForImplementation=true;}
  ]){const changed=structuredClone(expected);mutate(changed);assert.throws(()=>validate(changed));}
  assert.equal(records.commissionBillingRules.paymentDeadline.startsAt,'actual-successful-bill-issuance');
  assert.equal(records.deadlineCompletionRules.commission.onePrimaryRecordPerTransaction,true);
  assert.equal(records.commissionConfirmationRules.businessConfiguration['维修'].cap.amountCents,3000);
});

test('deadline boundary examples keep exact cutoff and late fee clocks separate while the next historical focus gains its own answers', () => {
  const rule=records.deadlineCompletionBoundaryRules;
  const cutoff=Date.parse('2026-10-21T18:00:00+08:00');
  assert.equal(rule.deadlineBoundary.automaticCompletionRequiresStrictlyAfterDeadline,true);
  assert.equal(Date.parse('2026-10-21T18:00:00+08:00')>cutoff,false);
  assert.equal(Date.parse('2026-10-21T18:00:00.001+08:00')>cutoff,true);
  assert.equal(rule.deadlineBoundary.validIssueReceivedExactlyAtDeadlineAccepted,true);
  assert.equal(Date.parse('2026-11-01T09:00:00+08:00')+rule.lateFeeCommission.windowHours*3600000,Date.parse('2026-11-04T09:00:00+08:00'));
  assert.equal(rule.lateFeeCommission.exactBoundaryConfirmed,false);
  const doc=read('docs/module-specs/deadline-completion-boundaries-rules.md');
  for(const text of ['1B、2A、3A、4A、5A、6A、7A、8A','不以沉默同意','不增加选人后的接单员二次接单','超过截止时点后才可自动完成','不重开流程','不倒填完成月份','不新增费用凭据或运营权限','2026-11-04 09:00','个人页仍执行AF07/B']) assert(doc.includes(text),text);
  const focus={date:'2026-10-14',phase:'first-release-business-planning',direction:'deadline-automatic-completion',directionDocument:'docs/module-specs/deadline-completion-request-20261014.md',ruleDocument:'docs/module-specs/deadline-completion-boundaries-rules.md',sourceBatch:'deadline-completion-round-2-20261014',questionDocument:'docs/module-specs/deadline-completion-entry-questions-20261014.md',status:'second-round-confirmed-entries-pending',pendingQuestionIds:['DC01','DC02','DC03','DC04','DC05','DC06','DC07','DC08'],priorQuestionSetPaused:true,implementationEnabled:false};
  assert.deepEqual(records.planningFocusHistory[2],focus);assert.deepEqual(handoff.planningFocusHistory[2],focus);
  assert.deepEqual(handoff.planningFocusHistory,records.planningFocusHistory);
  const questions=read(focus.questionDocument);
  assert(questions.includes('对应1A、2A、3A、4A、5B、6A、7A、8A'));
  const rows=[...questions.matchAll(/^\| [1-8]（(DC\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(rows.length,8);assert.deepEqual(rows.map(row=>row[1]),focus.pendingQuestionIds);
  assert.equal(records.deadlineCompletionEntryDecisionBatches[0].userReply,'5B, 全A');
  assert.deepEqual(handoff.deadlineCompletionEntryDecisionBatches,records.deadlineCompletionEntryDecisionBatches);
  for(const phrase of ['不新增接单员二次接单','不把空金额强制为0','不自动解码联系方式或新增聊天','仅针对该帖已获准买家','不改已存在主记录的更正流程','不授予一方自行解除']) assert(questions.includes(phrase),phrase);
  const glossary=read('CONTEXT.md');assert(glossary.includes('**补计佣申报窗口**'));assert(glossary.includes('由客户先提出、对方明确接受'));
  for(const file of ['docs/module-specs/README.md','docs/module-specs/deadline-completion-request-20261014.md','docs/module-specs/deadline-completion-rules.md','docs/module-specs/commission-simplification-rules.md','docs/module-specs/commission-simplification-boundaries-rules.md','docs/module-specs/planning-stage-clarification-20261014.md','docs/ui-development-handoff/README.md','docs/ui-development-handoff/business-addendum.md','docs/ui-development-handoff/page-spec.md','docs/ui-development-handoff/decisions-and-gaps.md']){
    const text=read(file);assert(text.includes('结束期限第二轮确认：'));assert(text.includes('deadline-completion-boundaries-rules.md'));assert(text.includes('deadline-completion-entry-questions-20261014.md'));
  }
});

test('deadline entry reply maps only DC05 to B and preserves both prior replies and income resolution', () => {
  assert.equal(records.deadlineCompletionEntryDecisionBatches.length,1);
  const [batch]=records.deadlineCompletionEntryDecisionBatches;
  assert.equal(batch.id,'deadline-completion-round-3-20261014');
  assert.equal(batch.date,'2026-10-14');
  assert.equal(batch.userReply,'5B, 全A');
  assert.deepEqual(batch.scope,['跑腿','维修','闲置','其它']);
  const rows=[...read(batch.questionDocument).matchAll(/^\| [1-8]（(DC\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(rows.length,8);
  assert.deepEqual(batch.answers.map(answer=>answer.questionId),rows.map(row=>row[1]));
  assert.deepEqual(batch.answers.map(answer=>answer.answer),['A','A','A','A','B','A','A','A']);
  batch.answers.forEach((answer,i)=>assert.equal(answer.selectedOption,rows[i][i===4?4:3].trim()));
  assert.deepEqual(handoff.deadlineCompletionEntryDecisionBatches,records.deadlineCompletionEntryDecisionBatches);
  assert.equal(records.deadlineCompletionBoundaryDecisionBatches[0].userReply,'1B, 全A');
  assert.equal(records.deadlineCompletionDecisionBatches[0].userReply,'7B, 全A');
  assert.equal(handoff.items.find(item=>item.id==='HD02').completionIncomeResolutionHistory[0].answer,'B');
  assert.equal(records.deadlineCompletionBoundaryRules.contact.automaticReceiptClosurePolicyConfirmed,false);
  assert.equal(records.deadlineCompletionEntryRules.receipts.afterAutomaticCompletion,'neither-party');
});

test('approved entry rules reject default time consent, false sold facts, private receipt access and repeated repricing windows', () => {
  const expected={
    confirmedAt:'2026-10-14',sourceBatch:'deadline-completion-round-3-20261014',scope:['跑腿','维修','闲置','其它'],enabled:false,
    acceptanceEntries:{repairOther:{customerEntersAt:'demand-publication',workerAcceptsAt:'application',expectedEndRequiredAtPublication:true,revalidateFutureAtSelection:true,estimatedFeeRequired:false},errand:{customerEntersAt:'demand-publication',workerAcceptsAt:'quote-submission',expectedEndRequiredAtPublication:true,revalidateAtQuoteSelection:true,quoteTimeChangePolicyConfirmed:false},idle:{buyerEntersAt:'contact-request',sellerAcceptsAt:'transaction-request',sameVersionBuyerConfirmationRequired:true,approvedContactTargetRequired:true,earlyContactDisclosure:false,expiredBuyerTimePolicyConfirmed:false},defaultConsent:false,secondWorkerAcceptanceAfterSelectionRequired:false},
    confirmedExtension:{deadline:'new-agreed-expected-end-plus-72-hours',windowHours:72,preserveHistory:true,unilateral:false,reopensEndedFlow:false,rangeAndAdvancePolicyConfirmed:false},
    idlePublicState:{label:'已售',automaticCompletionSourceVisible:true,provesVerifiedDelivery:false,provesPayment:false,createsVerifiedActualSaleStatistics:false,incomeDefinitionChanged:false,reopeningPolicyConfirmed:false},
    receipts:{afterAutomaticCompletion:'neither-party',preserveFeeTextHistory:true,preserveFeeHandlingEntry:true,newUploadApproved:false,newPartyAccessGranted:false,operatorAccessGranted:false,physicalDeletionApproved:false,retentionPeriodConfirmed:false,realAuthorizationChanged:false},
    lateFeeRepricing:{scope:'late-fee-window-without-primary-record',mutualAmountConfirmationRequired:true,resetsOriginalWindow:false,preservesOriginalCutoff:true,pendingProposalAutoConsent:false,unresolvedAmountIssueBypassed:false,appliesToExistingRecordCorrection:false,postCutoffEffectiveFeePolicyConfirmed:false},
    deliveryIssueResumption:{startAt:'later-of-effective-clearance-and-current-agreed-expected-end',windowHours:72,appliesTo:'automatic-flow-completion-clock',unilateralClearanceAllowed:false,clearanceAuthorityConfirmed:false,operatorServiceMediationApproved:false,otherClockMappingConfirmed:false},
    initialIncomeAndRatingRulesChanged:false,ratesAndCapsChanged:false,automaticDebit:false,provesCustomerPayment:false,readyForImplementation:false
  };
  const validate=rules=>assert.deepEqual(rules,expected);
  validate(records.deadlineCompletionEntryRules);validate(handoff.deadlineCompletionEntryRules);
  for(const mutate of [
    rules=>{rules.enabled=true;},
    rules=>{rules.acceptanceEntries.defaultConsent=true;},
    rules=>{rules.acceptanceEntries.secondWorkerAcceptanceAfterSelectionRequired=true;},
    rules=>{rules.acceptanceEntries.repairOther.estimatedFeeRequired=true;},
    rules=>{rules.acceptanceEntries.idle.buyerEntersAt='seller-request';},
    rules=>{rules.acceptanceEntries.idle.sameVersionBuyerConfirmationRequired=false;},
    rules=>{rules.acceptanceEntries.idle.earlyContactDisclosure=true;},
    rules=>{rules.confirmedExtension.windowHours=144;},
    rules=>{rules.confirmedExtension.unilateral=true;},
    rules=>{rules.idlePublicState.label='交易自动完成';},
    rules=>{rules.idlePublicState.automaticCompletionSourceVisible=false;},
    rules=>{rules.idlePublicState.provesVerifiedDelivery=true;},
    rules=>{rules.idlePublicState.provesPayment=true;},
    rules=>{rules.receipts.afterAutomaticCompletion='both-parties';},
    rules=>{rules.receipts.physicalDeletionApproved=true;},
    rules=>{rules.receipts.preserveFeeHandlingEntry=false;},
    rules=>{rules.receipts.operatorAccessGranted=true;},
    rules=>{rules.lateFeeRepricing.resetsOriginalWindow=true;},
    rules=>{rules.lateFeeRepricing.unresolvedAmountIssueBypassed=true;},
    rules=>{rules.lateFeeRepricing.appliesToExistingRecordCorrection=true;},
    rules=>{rules.deliveryIssueResumption.startAt='original-remaining-window';},
    rules=>{rules.deliveryIssueResumption.unilateralClearanceAllowed=true;},
    rules=>{rules.initialIncomeAndRatingRulesChanged=true;},
    rules=>{rules.readyForImplementation=true;}
  ]){const changed=structuredClone(expected);mutate(changed);assert.throws(()=>validate(changed));}
  assert.equal(records.deadlineCompletionRules.income.automaticCompletionAloneIncluded,false);
  assert.equal(records.deadlineCompletionBoundaryRules.lateFeeCommission.windowHours,72);
  assert.equal(records.commissionConfirmationRules.businessConfiguration['闲置'].cap.amountCents,2000);
});

test('entry timing examples preserve their source while the fourth-round focus is answered separately', () => {
  const rule=records.deadlineCompletionEntryRules;
  const hour=3600000;
  assert.equal(Date.parse('2026-10-22T10:00:00+08:00')+rule.confirmedExtension.windowHours*hour,Date.parse('2026-10-25T10:00:00+08:00'));
  const resumed=(cleared,end)=>Math.max(Date.parse(cleared),Date.parse(end))+rule.deliveryIssueResumption.windowHours*hour;
  assert.equal(resumed('2026-10-23T12:00:00+08:00','2026-10-22T10:00:00+08:00'),Date.parse('2026-10-26T12:00:00+08:00'));
  assert.equal(resumed('2026-10-23T12:00:00+08:00','2026-10-25T10:00:00+08:00'),Date.parse('2026-10-28T10:00:00+08:00'));
  assert.equal(rule.lateFeeRepricing.preservesOriginalCutoff,true);
  assert.equal(Date.parse('2026-11-01T09:00:00+08:00')+72*hour,Date.parse('2026-11-04T09:00:00+08:00'));
  const doc=read('docs/module-specs/deadline-completion-entry-rules.md');
  for(const text of ['1A、2A、3A、4A、5B、6A、7A、8A','不默认勾选接受','不能把未回应当已接受','费用文字历史','此前仅标自动完成','11月4日09:00保留','不把V1的接受当认可V2','从10月25日10:00起72小时','没有真实交易']) assert(doc.includes(text),text);
  const focus={date:'2026-10-14',phase:'first-release-business-planning',direction:'deadline-automatic-completion',directionDocument:'docs/module-specs/deadline-completion-request-20261014.md',ruleDocument:'docs/module-specs/deadline-completion-entry-rules.md',sourceBatch:'deadline-completion-round-3-20261014',questionDocument:'docs/module-specs/deadline-completion-detail-questions-20261014.md',status:'third-round-confirmed-details-pending',pendingQuestionIds:['DT01','DT02','DT03','DT04','DT05','DT06','DT07','DT08'],priorQuestionSetPaused:true,implementationEnabled:false};
  assert.deepEqual(records.planningFocusHistory[3],focus);assert.deepEqual(handoff.planningFocusHistory[3],focus);
  assert.deepEqual(handoff.planningFocusHistory,records.planningFocusHistory);
  const questions=read(focus.questionDocument);
  assert(questions.includes('对应1B、第2题自定义三天、3B、4A、5A、6A、7A、8A'));
  const rows=[...questions.matchAll(/^\| [1-8]（(DT\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(rows.length,8);assert.deepEqual(rows.map(row=>row[1]),focus.pendingQuestionIds);
  assert.equal(records.deadlineCompletionDetailDecisionBatches[0].userReply,'1B, 2设三天长期服务再由双方延期, 3B, 全A');
  assert.deepEqual(handoff.deadlineCompletionDetailDecisionBatches,records.deadlineCompletionDetailDecisionBatches);
  for(const text of ['30天只是待确认','不设统一最长周期','不用于首次正式费用尚未知','不延长/扩张联系方式或地址授权','一方点击或沉默自动解除'])assert(questions.includes(text),text);
  assert(read('CONTEXT.md').includes('**已售（自动完成来源）**'));
  for(const file of ['docs/module-specs/README.md','docs/module-specs/deadline-completion-request-20261014.md','docs/module-specs/deadline-completion-rules.md','docs/module-specs/deadline-completion-boundaries-rules.md','docs/module-specs/commission-simplification-rules.md','docs/module-specs/commission-simplification-boundaries-rules.md','docs/module-specs/planning-stage-clarification-20261014.md','docs/ui-development-handoff/README.md','docs/ui-development-handoff/business-addendum.md','docs/ui-development-handoff/page-spec.md','docs/ui-development-handoff/decisions-and-gaps.md']){
    const text=read(file);assert(text.includes('结束期限第三轮确认：'));assert(text.includes('deadline-completion-entry-rules.md'));assert(text.includes('deadline-completion-detail-questions-20261014.md'));
  }
});

test('fourth deadline reply preserves two B answers and the custom three-day answer without treating it as thirty days or unlimited', () => {
  assert.equal(records.deadlineCompletionDetailDecisionBatches.length,1);
  const [batch]=records.deadlineCompletionDetailDecisionBatches;
  assert.equal(batch.id,'deadline-completion-round-4-20261014');
  assert.equal(batch.date,'2026-10-14');
  assert.equal(batch.userReply,'1B, 2设三天长期服务再由双方延期, 3B, 全A');
  assert.deepEqual(batch.scope,['跑腿','维修','闲置','其它']);
  const rows=[...read(batch.questionDocument).matchAll(/^\| [1-8]（(DT\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(rows.length,8);
  assert.deepEqual(batch.answers.map(answer=>answer.questionId),rows.map(row=>row[1]));
  assert.deepEqual(batch.answers.map(answer=>answer.answer),['B','CUSTOM','B','A','A','A','A','A']);
  batch.answers.forEach((answer,i)=>{
    if(i===1){assert.equal(answer.userCustomValue,'三天，长期服务再由双方延期');assert.equal(answer.selectedOption,'初次/延期预计结束时间最远设三天，长期服务再由双方延期');}
    else assert.equal(answer.selectedOption,rows[i][i===0||i===2?4:3].trim());
  });
  assert.deepEqual(handoff.deadlineCompletionDetailDecisionBatches,records.deadlineCompletionDetailDecisionBatches);
  assert.equal(records.deadlineCompletionEntryDecisionBatches[0].userReply,'5B, 全A');
  assert.equal(records.deadlineCompletionBoundaryDecisionBatches[0].userReply,'1B, 全A');
  assert.equal(records.deadlineCompletionDetailRules.horizon.maxDays,3);
  assert.equal(records.deadlineCompletionDetailRules.horizon.maxDurationHours,null);
  assert.equal(handoff.items.find(item=>item.id==='HD02').completionIncomeResolutionHistory[0].answer,'B');
});

test('approved fourth-round rules reject guessed day arithmetic, selecting stale time acceptance and silently clearing real disputes', () => {
  const expected={
    confirmedAt:'2026-10-14',sourceBatch:'deadline-completion-round-4-20261014',scope:['跑腿','维修','闲置','其它'],enabled:false,
    equality:{at:'server-side-confirmation',equalExpectedEndAllowed:true,pastExpectedEndAllowed:false,minuteSecondNormalizationConfirmed:false},
    horizon:{maxDays:3,appliesTo:['initial','extension'],anchor:'confirmation',fixedDurationRequired:false,longServicesUseMutualExtensions:true,dayInterpretationConfirmed:false,maxDurationHours:null,changesObjectionWindow:false},
    errandChangedTime:{retainQuoteAmount:true,explicitCurrentTimeAcceptanceBeforeSelectionRequired:true,oldAcceptanceAppliesToNewTime:false,workerSecondAcceptanceAfterSelectionRequired:false,changesAlreadySelectedFee:false,acceptanceEntryConfirmed:false,sortEffectConfirmed:false},
    idleExpiredTime:{scope:'approved-contact-before-effective-transaction',approvedRelationshipPreserved:true,buyerUpdatesTime:true,withdrawOldPendingTransactionBeforeNew:true,sellerReinitiates:true,sameNewVersionConfirmationRequired:true,contactPermissionExpanded:false,preserveHistory:true},
    extension:{pendingWithdrawalBy:'initiator-only',counterpartyMayAcceptOrRefuse:true,effectiveExtensionCanBeWithdrawn:false,onlyLaterThanCurrentExpectedEnd:true,sameTimeRefreshAllowed:false,earlierCompletionUsesExplicitDeliveryAcknowledgment:true,refusalReasonPolicyConfirmed:false},
    ordinaryRepricingTimeout:{scope:'late-fee-window-without-primary-record-with-existing-effective-amount',durationHours:24,startsAt:'successful-request-effectiveness',closesUnconfirmedAdjustment:true,preservesPreviousEffectiveFee:true,meansAutoConsent:false,firstUnknownFeeExcluded:true,realUnresolvedAmountDeliveryOrSaleIssuesExcluded:true,exactCutoffPriorityConfirmed:false,latePrimaryRecordResumptionConfirmed:false},
    deliveryClearance:{bothExplicitAgreementRequired:true,singlePartyOrSilenceClears:false,operatorRecordOnly:true,operatorServiceAdjudicationGranted:false,amountVerificationAuthorityChanged:false,actionModelConfirmed:false},
    incomeRatingAndSoldRulesChanged:false,ratesAndCapsChanged:false,automaticDebit:false,provesCustomerPayment:false,readyForImplementation:false
  };
  const validate=rules=>assert.deepEqual(rules,expected);
  validate(records.deadlineCompletionDetailRules);validate(handoff.deadlineCompletionDetailRules);
  for(const mutate of [
    rules=>{rules.enabled=true;},
    rules=>{rules.equality.equalExpectedEndAllowed=false;},
    rules=>{rules.equality.pastExpectedEndAllowed=true;},
    rules=>{rules.horizon.maxDays=30;},
    rules=>{rules.horizon.maxDurationHours=72;},
    rules=>{rules.horizon.dayInterpretationConfirmed=true;},
    rules=>{rules.horizon.fixedDurationRequired=true;},
    rules=>{rules.horizon.changesObjectionWindow=true;},
    rules=>{rules.errandChangedTime.retainQuoteAmount=false;},
    rules=>{rules.errandChangedTime.oldAcceptanceAppliesToNewTime=true;},
    rules=>{rules.errandChangedTime.workerSecondAcceptanceAfterSelectionRequired=true;},
    rules=>{rules.idleExpiredTime.approvedRelationshipPreserved=false;},
    rules=>{rules.idleExpiredTime.contactPermissionExpanded=true;},
    rules=>{rules.extension.pendingWithdrawalBy='either-party';},
    rules=>{rules.extension.sameTimeRefreshAllowed=true;},
    rules=>{rules.ordinaryRepricingTimeout.durationHours=72;},
    rules=>{rules.ordinaryRepricingTimeout.preservesPreviousEffectiveFee=false;},
    rules=>{rules.ordinaryRepricingTimeout.meansAutoConsent=true;},
    rules=>{rules.ordinaryRepricingTimeout.firstUnknownFeeExcluded=false;},
    rules=>{rules.ordinaryRepricingTimeout.realUnresolvedAmountDeliveryOrSaleIssuesExcluded=false;},
    rules=>{rules.deliveryClearance.singlePartyOrSilenceClears=true;},
    rules=>{rules.deliveryClearance.operatorServiceAdjudicationGranted=true;},
    rules=>{rules.incomeRatingAndSoldRulesChanged=true;},
    rules=>{rules.readyForImplementation=true;}
  ]){const changed=structuredClone(expected);mutate(changed);assert.throws(()=>validate(changed));}
  assert.equal(records.deadlineCompletionRules.income.automaticCompletionAloneIncluded,false);
  assert.equal(records.deadlineCompletionRules.deadline.windowHours,72);
  assert.equal(records.commissionBillingRules.paymentDeadline.durationHours,72);
});

test('fourth-round boundary examples retain their source when the next round changes the horizon and leaves one question unanswered', () => {
  const rule=records.deadlineCompletionDetailRules;
  const exact=Date.parse('2026-10-14T10:00:00+08:00');
  assert.equal(rule.equality.equalExpectedEndAllowed,true);
  assert.equal(Date.parse('2026-10-14T10:00:00+08:00'),exact);
  assert.equal(rule.equality.pastExpectedEndAllowed,false);
  assert.equal(rule.horizon.dayInterpretationConfirmed,false);
  assert.equal(rule.horizon.maxDurationHours,null);
  assert.equal(Date.parse('2026-11-02T09:00:00+08:00')+rule.ordinaryRepricingTimeout.durationHours*3600000,Date.parse('2026-11-03T09:00:00+08:00'));
  assert.equal(rule.ordinaryRepricingTimeout.exactCutoffPriorityConfirmed,false);
  const doc=read('docs/module-specs/deadline-completion-detail-rules.md');
  for(const text of ['第2题自定义三天','相同预计时间可用延期刷新72小时','不先填72小时作为范围实现值','允许相等','金额保留，未明确接受V2前不能选定','不能靠超时自动解决','双方明确同意解除','不代裁决']) assert(doc.includes(text),text);
  const focus={date:'2026-10-14',phase:'first-release-business-planning',direction:'deadline-automatic-completion',directionDocument:'docs/module-specs/deadline-completion-request-20261014.md',ruleDocument:'docs/module-specs/deadline-completion-detail-rules.md',sourceBatch:'deadline-completion-round-4-20261014',questionDocument:'docs/module-specs/deadline-completion-operation-questions-20261014.md',status:'fourth-round-confirmed-clock-definition-pending',pendingQuestionIds:['DO01','DO02','DO03','DO04','DO05','DO06','DO07','DO08'],priorQuestionSetPaused:true,implementationEnabled:false};
  assert.deepEqual(records.planningFocusHistory[4],focus);assert.deepEqual(handoff.planningFocusHistory[4],focus);
  assert.deepEqual(handoff.planningFocusHistory,records.planningFocusHistory);
  const questions=read(focus.questionDocument);
  assert(questions.includes('第2题实际回复“没听懂”'));
  const rows=[...questions.matchAll(/^\| [1-8]（(DO\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(rows.length,8);assert.deepEqual(rows.map(row=>row[1]),focus.pendingQuestionIds);
  assert.equal(records.deadlineCompletionOperationDecisionBatches[0].answers.length,7);
  assert.deepEqual(handoff.deadlineCompletionOperationDecisionBatches,records.deadlineCompletionOperationDecisionBatches);
  for(const text of ['最多连续72小时','确认当天算第1天','不假称已有跑腿排序方案','不新增选定后的接单员二次接单','不能绕过真实未解决金额争议','不复制旧买家时间、私人信息或旧交易授权']) assert(questions.includes(text),text);
  assert(read('CONTEXT.md').includes('**三天可选范围**'));
  for(const file of ['docs/module-specs/README.md','docs/module-specs/deadline-completion-request-20261014.md','docs/module-specs/deadline-completion-rules.md','docs/module-specs/deadline-completion-boundaries-rules.md','docs/module-specs/deadline-completion-entry-rules.md','docs/module-specs/commission-simplification-rules.md','docs/module-specs/commission-simplification-boundaries-rules.md','docs/module-specs/planning-stage-clarification-20261014.md','docs/ui-development-handoff/README.md','docs/ui-development-handoff/business-addendum.md','docs/ui-development-handoff/page-spec.md','docs/ui-development-handoff/decisions-and-gaps.md']){
    const text=read(file);assert(text.includes('结束期限第四轮确认：'));assert(text.includes('deadline-completion-detail-rules.md'));assert(text.includes('deadline-completion-operation-questions-20261014.md'));
  }
});

test('fifth-round reply records the custom 30/7 ranges and six A answers but never answers the misunderstood DO02', () => {
  assert.equal(records.deadlineCompletionOperationDecisionBatches.length,1);
  const [batch]=records.deadlineCompletionOperationDecisionBatches;
  assert.equal(batch.id,'deadline-completion-round-5-20261014');
  assert.equal(batch.userReply,'1. 初次按"从确认时起最多 30 天，长期服务再由双方延期", 延期按七天\n2. 没听懂\n\n全A');
  assert.deepEqual(batch.scope,['跑腿','维修','闲置','其它']);
  const rows=[...read(batch.questionDocument).matchAll(/^\| [1-8]（(DO\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(rows.length,8);
  assert.equal(batch.answers.length,7);
  assert.deepEqual(batch.answers.map(answer=>answer.questionId),['DO01','DO03','DO04','DO05','DO06','DO07','DO08']);
  assert.deepEqual(batch.answers.map(answer=>answer.answer),['CUSTOM','A','A','A','A','A','A']);
  assert.equal(batch.answers[0].userCustomValue,'初次从确认时起最多30天，长期服务再由双方延期；延期七天');
  batch.answers.slice(1).forEach(answer=>assert.equal(answer.selectedOption,rows.find(row=>row[1]===answer.questionId)[3].trim()));
  assert.deepEqual(batch.unanswered,[{questionId:'DO02',userReply:'没听懂',status:'clarification-required'}]);
  assert.equal(batch.replyInterpretation,'explicit-not-understood-overrides-all-A-for-DO02');
  assert.deepEqual(handoff.deadlineCompletionOperationDecisionBatches,records.deadlineCompletionOperationDecisionBatches);
  assert.equal(records.deadlineCompletionDetailRules.horizon.maxDays,3);
  assert.equal(records.deadlineCompletionOperationRules.horizon.initialMaxDays,30);
  assert.equal(records.deadlineCompletionOperationRules.horizon.extensionMaxDays,7);
});

test('fifth-round rules forbid guessing day algorithms or DO02 consent and retain truthful late-billing, issue-clearance and resale boundaries', () => {
  const expected={
    confirmedAt:'2026-10-14',sourceBatch:'deadline-completion-round-5-20261014',scope:['跑腿','维修','闲置','其它'],enabled:false,
    horizon:{initialMaxDays:30,initialAnchor:'transaction-confirmation',extensionMaxDays:7,extensionAnchorConfirmed:false,extensionAnchor:null,dayInterpretationConfirmed:false,initialMaxHours:null,extensionMaxHours:null,fixedDurationRequired:false,longServicesUseMutualExtensions:true,supersedesThreeDayRange:true,changesObjectionWindow:false},
    timeReacceptanceEntry:{sourceQuestion:'DO02',status:'clarification-required',confirmed:false,selectedOption:null,preservesExistingQuoteAmountRule:true},
    quoteOrdering:{scope:'errand',basis:'first-successful-quote-time',direction:'earliest-first',timeReacceptanceChangesPosition:false,preserveOriginalSubmissionFact:true,amountEditPolicyConfirmed:false,tiePolicyConfirmed:false},
    extensionRefusal:{reasonRequired:false,reasonMaxLength:300,closesRequest:true,originalTimeRetained:true,cancelsTransaction:false,clearsValidDeliveryDispute:false},
    repricingCutoff:{clock:'server-effective-receipt',effectiveConfirmationAtCutoffAccepted:true,unconfirmedClosureRequiresStrictlyAfterCutoff:true,localClickBackfillAllowed:false,fullConcurrencyPolicyConfirmed:false},
    lateFeeAfterTimeout:{requiresPreviousEffectiveFee:true,requiresOriginalWindowEnded:true,requiresNoEffectiveBlocker:true,formsPrimaryRecordWhenEligible:true,addsAnother72HourWindow:false,firstSuccessfulFormationMonth:true,duplicatePrimaryRecordAllowed:false,existingRecordCorrectionIncluded:false},
    deliveryClearanceAction:{proposedBy:'either-party',proposalAcknowledgesClearance:true,counterpartyExplicitSameVersionConfirmationRequired:true,silenceClears:false,retainsIssueHistoryAndEvidence:true,operatorApprovalGranted:false,pendingRequestLimitConfirmed:false,withdrawalRefusalPoliciesConfirmed:false,validIssueSubmissionPolicyConfirmed:false},
    idleResale:{mode:'new-post',ownPublicContentCopyAsDraftAllowed:true,originalPostAndTransactionHistoryPreserved:true,restoreOriginalForSale:false,oldBuyerTimeCopied:false,oldPrivateInformationCopied:false,oldAuthorizationCopied:false,publishingRequirementsRetained:true,waivesOriginalCommission:false,createsRealPostAutomatically:false,preciseCopyFieldsConfirmed:false},
    incomeRatingSoldAndRatesChanged:false,automaticDebit:false,provesCustomerPayment:false,readyForImplementation:false
  };
  const validate=rules=>assert.deepEqual(rules,expected);
  validate(records.deadlineCompletionOperationRules);validate(handoff.deadlineCompletionOperationRules);
  for(const mutate of [
    rules=>{rules.enabled=true;},
    rules=>{rules.horizon.initialMaxDays=3;},
    rules=>{rules.horizon.extensionMaxDays=30;},
    rules=>{rules.horizon.initialMaxHours=720;},
    rules=>{rules.horizon.extensionAnchor='current-expected-end';},
    rules=>{rules.horizon.dayInterpretationConfirmed=true;},
    rules=>{rules.timeReacceptanceEntry.confirmed=true;},
    rules=>{rules.timeReacceptanceEntry.selectedOption='A';},
    rules=>{rules.quoteOrdering.timeReacceptanceChangesPosition=true;},
    rules=>{rules.extensionRefusal.reasonRequired=true;},
    rules=>{rules.extensionRefusal.clearsValidDeliveryDispute=true;},
    rules=>{rules.repricingCutoff.effectiveConfirmationAtCutoffAccepted=false;},
    rules=>{rules.repricingCutoff.localClickBackfillAllowed=true;},
    rules=>{rules.lateFeeAfterTimeout.requiresNoEffectiveBlocker=false;},
    rules=>{rules.lateFeeAfterTimeout.addsAnother72HourWindow=true;},
    rules=>{rules.lateFeeAfterTimeout.duplicatePrimaryRecordAllowed=true;},
    rules=>{rules.deliveryClearanceAction.counterpartyExplicitSameVersionConfirmationRequired=false;},
    rules=>{rules.deliveryClearanceAction.silenceClears=true;},
    rules=>{rules.deliveryClearanceAction.operatorApprovalGranted=true;},
    rules=>{rules.idleResale.restoreOriginalForSale=true;},
    rules=>{rules.idleResale.oldPrivateInformationCopied=true;},
    rules=>{rules.idleResale.waivesOriginalCommission=true;},
    rules=>{rules.readyForImplementation=true;}
  ]){const changed=structuredClone(expected);mutate(changed);assert.throws(()=>validate(changed));}
  assert.equal(records.deadlineCompletionRules.deadline.windowHours,72);
  assert.equal(records.commissionBillingRules.paymentDeadline.startsAt,'actual-successful-bill-issuance');
  assert.equal(handoff.items.find(item=>item.id==='HD02').completionIncomeResolutionHistory[0].automaticCompletionAloneIncluded,false);
});

test('misunderstood time-entry explanation and sixth-round questions remain reviewable without importing the prior all-A reply', () => {
  const doc=read('docs/module-specs/deadline-completion-operation-rules.md');
  for(const text of ['DO02未选、需解释','没听懂','下午5点','下午3点','原报价金额保留','接单员明确接受新时间','不执行或固化DO02','延期最大七天，起算点','不倒填窗口月份']) assert(doc.includes(text),text);
  const focus={date:'2026-10-14',phase:'first-release-business-planning',direction:'deadline-automatic-completion',directionDocument:'docs/module-specs/deadline-completion-request-20261014.md',ruleDocument:'docs/module-specs/deadline-completion-operation-rules.md',sourceBatch:'deadline-completion-round-5-20261014',questionDocument:'docs/module-specs/deadline-completion-clarification-questions-20261014.md',status:'fifth-round-partial-time-entry-clarification-required',pendingQuestionIds:['DX01','DX02','DX03','DX04','DX05','DX06','DX07','DX08'],unresolvedOriginalQuestionIds:['DO02'],priorQuestionSetPaused:true,implementationEnabled:false};
  assert.deepEqual(records.planningFocusHistory[5],focus);assert.deepEqual(handoff.planningFocusHistory[5],focus);
  assert.equal(records.planningFocusHistory.length,14);assert.deepEqual(handoff.planningFocusHistory,records.planningFocusHistory);
  const questions=read(focus.questionDocument);
  assert(questions.includes('8题全部选择A'));assert(questions.includes('重述尚未选的原DO02'));
  const rows=[...questions.matchAll(/^\| [1-8]（(DX\d{2})） \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)];
  assert.equal(rows.length,8);assert.deepEqual(rows.map(row=>row[1]),focus.pendingQuestionIds);
  assert.equal(records.deadlineCompletionClarificationDecisionBatches.length,1);
  assert.deepEqual(handoff.deadlineCompletionClarificationDecisionBatches,records.deadlineCompletionClarificationDecisionBatches);
  for(const text of ['在原报价旁直接点','初次30天、延期七天','从原有效预计结束时间起','不将资料提交成功当争议事实已核实','不回退已成功的撤回或拒绝']) assert(questions.includes(text),text);
  const glossary=read('CONTEXT.md');assert(glossary.includes('**初次可选范围**'));assert(glossary.includes('**延期可选范围**'));assert(glossary.includes('仅作设计历史，不作为当前实施范围'));
  for(const file of ['docs/module-specs/README.md','docs/module-specs/deadline-completion-request-20261014.md','docs/module-specs/deadline-completion-rules.md','docs/module-specs/deadline-completion-boundaries-rules.md','docs/module-specs/deadline-completion-entry-rules.md','docs/module-specs/deadline-completion-detail-rules.md','docs/module-specs/commission-simplification-rules.md','docs/module-specs/commission-simplification-boundaries-rules.md','docs/module-specs/planning-stage-clarification-20261014.md','docs/ui-development-handoff/README.md','docs/ui-development-handoff/business-addendum.md','docs/ui-development-handoff/page-spec.md','docs/ui-development-handoff/decisions-and-gaps.md']){
    const text=read(file);assert(text.includes('结束期限第五轮部分确认：'));assert(text.includes('deadline-completion-operation-rules.md'));assert(text.includes('deadline-completion-clarification-questions-20261014.md'));
  }
});

test('exception batch preserves the fourth and fifth B answers and per-question business scope', () => {
  const [batch] = records.exceptionRatingDecisionBatches;
  assert.equal(records.exceptionRatingDecisionBatches.length, 1);
  assert.equal(batch.userReply, '全A, 4B, 5B');
  assert.equal(batch.date, '2026-10-11');
  assert.deepEqual(batch.scope, ['维修', '其它']);
  assert.equal(batch.questionDocument, 'docs/module-specs/exception-rating-questions-20261011.md');
  const document = read(batch.questionDocument);
  assert(document.includes('1A、2A、3A、4B、5B、6A、7A、8A'));
  const offered = [...document.matchAll(/（(EQ\d{2})）\r?\n\r?\nA：(.+?)B：(.+?)\r?\n/g)];
  assert.equal(offered.length, 8);
  assert.deepEqual(batch.answers.map(answer => answer.questionId), Array.from({length: 8}, (_, index) => `EQ${String(index + 1).padStart(2, '0')}`));
  assert.deepEqual(batch.answers.map(answer => answer.answer), ['A', 'A', 'A', 'B', 'B', 'A', 'A', 'A']);
  batch.answers.forEach((answer, index) => {
    assert.equal(answer.selectedOption, offered[index][answer.answer === 'A' ? 2 : 3].trim().replace(/。$/, ''));
    assert.deepEqual(answer.scope, index === 5 ? ['维修'] : index === 6 ? ['其它'] : ['维修', '其它']);
  });
  assert.deepEqual(handoff.exceptionRatingDecisionBatches, records.exceptionRatingDecisionBatches);
  for (const id of ['HD01', 'HD04']) {
    assert(handoff.items.find(item => item.id === id).confirmed.includes('异常与评价第四轮4B/5B、其余A'));
  }
});

test('exception integrity prevents operator mediation, two endings, forced proof, cancelled-service scoring and cross-business mixing', () => {
  verify(records);
  for (const mutate of [
    item => { item.completionRules.evidenceFields.description.required = false; },
    item => { item.completionRules.evidenceFields.description.maxLength = 1000; },
    item => { item.completionRules.evidenceFields.attachments.required = true; },
    item => { item.cancellationRules.evidenceFields.description.required = false; },
    item => { item.cancellationRules.refusalRules.reasonRequired = false; },
    item => { item.cancellationRules.refusalRules.endsService = true; },
    item => { item.terminationRequests.completionAndCancellationMayCoexist = false; },
    item => { item.terminationRequests.endingPolicy = 'client-first-click'; },
    item => { item.terminationRequests.closeOtherOnEnd = false; },
    item => { item.terminationRequests.preserveOtherHistory = false; },
    item => { item.disputeRules.operatorServiceMediation = true; },
    item => { item.disputeRules.existingReportAndRatingAppealUnaffected = false; },
    item => { item.disputeRules.objectionFields.description.required = false; },
    item => { item.ratingRules.qualification.trigger = 'selected'; },
    item => { item.ratingRules.qualification.requiresWorkerCompletionRequest = false; },
    item => { item.ratingRules.qualification.additionalExperienceConfirmationRequired = true; },
    item => { item.ratingRules.qualification.cancellationCreatesQualification = true; },
    item => { item.ratingRules.mutual = false; },
    item => { item.ratingRules.statistics.separateFromOtherBusinesses = false; },
    item => { item.ratingRules.statistics.business = '跑腿'; },
    item => { item.ratingRules.preserveExistingValidQualificationsAndRatings = false; }
  ]) {
    for (const index of [0, 1]) {
      const changed = structuredClone(records);
      mutate(changed.items[index].confirmed);
      assert.throws(() => verify(changed));
    }
  }
  assert(read('docs/module-specs/exception-rating-rules.md').includes('取消先有效时，服务只为已取消、完成申请关闭并留历史'));
  assert(read('docs/module-specs/exception-rating-rules.md').includes('接单申请仍不设单独拒绝'));
  assert(read('docs/module-specs/exception-rating-rules.md').includes('既有举报、内容审核、评分核查和评价申诉仍按原职责处理'));
  assert(read('docs/module-specs/exception-rating-rules.md').includes('没有实现或验证真实并发结束'));
  assert.equal(handoff.items.find(item => item.id === 'HD02').confirmed.business, '跑腿');
  assert.equal(handoff.items.find(item => item.id === 'HD02').confirmed.wallet, false);
});

test('fulfillment all-A answer maps only to the eight questions in its own round and is synchronized with handoff', () => {
  const [batch] = records.fulfillmentDecisionBatches;
  assert.equal(records.fulfillmentDecisionBatches.length, 1);
  assert.equal(batch.userReply, '全A');
  assert.equal(batch.date, '2026-10-11');
  assert.deepEqual(batch.scope, ['维修', '其它']);
  assert.equal(batch.questionDocument, 'docs/module-specs/fulfillment-questions-20261011.md');
  const document = read(batch.questionDocument);
  assert(document.includes('8题全部选择A'));
  const offered = [...document.matchAll(/（(LQ\d{2})）\r?\n\r?\nA：(.+?)B：/g)];
  assert.equal(offered.length, 8);
  assert.deepEqual(batch.answers.map(answer => answer.questionId), Array.from({length: 8}, (_, index) => `LQ${String(index + 1).padStart(2, '0')}`));
  batch.answers.forEach((answer, index) => {
    assert.equal(answer.answer, 'A');
    assert.equal(answer.selectedOption, offered[index][2].trim().replace(/。$/, ''));
  });
  assert.deepEqual(handoff.fulfillmentDecisionBatches, records.fulfillmentDecisionBatches);
  assert.equal(records.applicationDecisionBatches[0].answers[3].answer, 'B');
  assert.equal(handoff.items.find(item => item.id === 'HD02').confirmed.business, '跑腿');
  assert.equal(handoff.items.find(item => item.id === 'HD05').userReply, '只显示“服务时间”，暂不填值');
  assert(read('docs/module-specs/fulfillment-rules.md').includes('原PRD跑腿24小时自动完成规则不受本轮影响'));
  assert(read('docs/module-specs/fulfillment-rules.md').includes('没有实现或验证真实履约功能'));
});

test('fulfillment integrity rejects automatic endings, unilateral changes, restored applicants and permanent contact access', () => {
  verify(records);
  for (const mutate of [
    item => { item.demandChanges.afterSelection.requiresBothPartiesConfirmation = false; },
    item => { item.demandChanges.afterSelection.previousVersionEffectiveUntilConfirmed = false; },
    item => { item.appointmentRules.required = true; },
    item => { item.appointmentRules.changesRequireBothPartiesConfirmation = false; },
    item => { item.completionRules.initiator = 'publisher'; },
    item => { item.completionRules.requiresPublisherConfirmation = false; },
    item => { item.completionRules.noResponse.autoComplete = true; },
    item => { item.completionRules.noResponse.autoCompleteHours = 24; },
    item => { item.cancellationRules.requiresCounterpartyConfirmation = false; },
    item => { item.cancellationRules.noResponse.autoCancel = true; },
    item => { item.cancellationRules.noResponse.autoCancelHours = 48; },
    item => { item.reopeningRules.afterConfirmedCancellation = false; },
    item => { item.reopeningRules.restoreOldApplications = true; },
    item => { item.reopeningRules.preserveServiceAndFeeHistory = false; },
    item => { item.contactVisibility.afterServiceEnd.completedContact = 'full'; },
    item => { item.contactVisibility.afterServiceEnd.cancelledContact = 'full'; },
    item => { item.contactVisibility.afterServiceEnd.selectedWorkerFullAddressAccess = true; },
    item => { item.contactVisibility.afterServiceEnd.publisherMayManageOwnAddress = false; }
  ]) {
    for (const index of [0, 1]) {
      const changed = structuredClone(records);
      mutate(changed.items[index].confirmed);
      assert.throws(() => verify(changed));
    }
  }
  for (const item of records.items) {
    assert.equal(item.confirmed.feeAgreement.cancellation.impliesSettled, false);
  }
});

test('application batch preserves the exact reply and the fourth answer exception instead of treating it as all-A', () => {
  const [batch] = records.applicationDecisionBatches;
  assert.equal(records.applicationDecisionBatches.length, 1);
  assert.equal(batch.userReply, '全A, 4选B, 6皆不设同时接单上限,');
  assert.equal(batch.date, '2026-10-11');
  assert.deepEqual(batch.scope, ['维修', '其它']);
  assert.equal(batch.questionDocument, 'docs/module-specs/application-questions-20261011.md');
  const questions = read(batch.questionDocument);
  assert(questions.includes('1A、2A、3A、4B、5A、6A'));
  assert(!questions.includes('8题全部待答'));
  const offered = [...questions.matchAll(/（(AQ\d{2})）\r?\n\r?\nA：(.+?)B：(.+?)\r?\n/g)];
  assert.equal(offered.length, 8);
  assert.deepEqual(batch.answers.map(answer => answer.questionId), Array.from({length: 8}, (_, index) => `AQ${String(index + 1).padStart(2, '0')}`));
  assert.deepEqual(batch.answers.map(answer => answer.answer), ['A', 'A', 'A', 'B', 'A', 'A', 'A', 'A']);
  batch.answers.forEach((answer, index) => {
    assert.equal(answer.selectedOption, offered[index][answer.answer === 'A' ? 2 : 3].trim().replace(/。$/, ''));
  });
  assert.equal(batch.answers[5].userClarification, '6皆不设同时接单上限');
  assert.deepEqual(handoff.applicationDecisionBatches, records.applicationDecisionBatches);
  for (const id of ['HD01', 'HD04']) {
    const item = handoff.items.find(row => row.id === id);
    assert(item.confirmed.includes('不设单独拒绝申请'));
    assert(item.confirmed.includes('维修和其它均不设同时接单上限'));
    assert(!item.pending.includes('接单员同时接单规则'));
  }
});

test('application integrity rejects secondary acceptance, rejection bans, compulsory quotes, public addresses and stale selection', () => {
  for (const mutate of [
    item => { item.selectionRules.workerReconfirmationRequired = true; },
    item => { item.selectionRules.effectiveAfterPublisherSelectionSuccess = false; },
    item => { item.selectionRules.otherApplications.end = false; },
    item => { item.selectionRules.otherApplications.notify = false; },
    item => { item.selectionRules.otherApplications.autoReplacement = true; },
    item => { item.applicationRules.reapplication.cooldownHours = 24; },
    item => { item.applicationRules.individualRejectionAllowed = true; },
    item => { item.applicationFields.description.required = true; },
    item => { item.applicationFields.description.maxLength = 1000; },
    item => { item.applicationFields.estimatedServiceFee.required = true; },
    item => { item.applicationFields.estimatedServiceFee.missingLabel = '0元'; },
    item => { item.applicationFields.estimatedServiceFee.isFeeAgreement = true; },
    item => { item.concurrentTaskLimit = { kind: 'fixed', count: 1 }; },
    item => { item.contactVisibility.privateAddress.optionalAtPublishing = false; },
    item => { item.contactVisibility.privateAddress.public = true; },
    item => { item.contactVisibility.privateAddress.releaseTo = 'all-applicants'; },
    item => { item.demandChanges.beforeSelection.invalidateApplications = false; },
    item => { item.demandChanges.beforeSelection.notifyApplicants = false; },
    item => { item.demandChanges.beforeSelection.reapplyRequired = false; }
  ]) {
    for (const index of [0, 1]) {
      const changed = structuredClone(records);
      mutate(changed.items[index].confirmed);
      assert.throws(() => verify(changed));
    }
  }
  assert(read('docs/module-specs/application-rules.md').includes('草选、请求失败或结果未知不算成功'));
  assert(read('docs/module-specs/application-rules.md').includes('费用按[费用规则]'));
  assert.equal(handoff.items.find(item => item.id === 'HD02').confirmed.business, '跑腿');
  assert.equal(handoff.items.find(item => item.id === 'HD05').productionAllowed, true);
});

test('single selected worker approval is dated and synchronized for both businesses without imposing an applicant cap', () => {
  const [other, repair] = records.items;
  assert.equal(records.updatedAt, '2026-10-15');
  assert.equal(handoff.updatedAt, records.updatedAt);
  const answer = other.followUp[3];
  assert.equal(answer.date, '2026-10-11');
  assert.equal(answer.userReply, 'A');
  assert(answer.selectedOption.includes('申请人数另行讨论'));
  assert.deepEqual(repair.followUp[0], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD01').followUp[1], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD04').followUp[3], answer);
  assert(read('docs/module-specs/README.md').includes('每条需求最终选1位'));
  assert(read('docs/ui-development-handoff/business-addendum.md').includes('第6题明确两类同时接单均不设上限'));
});

test('applicant-cap answer is retained and independent approval now covers concurrent tasks without allowing duplicate applications', () => {
  const [other, repair] = records.items;
  const answer = other.followUp[4];
  assert.equal(answer.date, '2026-10-11');
  assert.equal(answer.userReply, 'A');
  assert.equal(answer.selectedOption, '维修和其它每条需求不设产品申请人数上限；允许多人申请，发布者最终选1位');
  assert.deepEqual(repair.followUp[1], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD01').followUp[2], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD04').followUp[4], answer);
  for (const item of records.items) {
    assert.deepEqual(item.confirmed.applicantLimit, { kind: 'no-product-cap' });
    assert.equal(item.confirmed.selectedWorkerCount, 1);
    assert.equal(item.confirmed.applicationRules.activePerPersonPerRequest, 1);
    assert(!item.pending.includes('接单员同时接单规则'));
    assert.deepEqual(item.confirmed.concurrentTaskLimit, { kind: 'no-product-cap' });
  }
  assert(read('CONTEXT.md').includes('用户已独立确认维修和其它均不设置此上限'));
});

test('one active editable application and immediate reapplication are synchronized without approving withdrawal after selection', () => {
  const [other, repair] = records.items;
  const answer = other.followUp[6];
  assert.equal(answer.date, '2026-10-11');
  assert.equal(answer.userReply, 'A');
  assert.equal(answer.selectedOption, '维修和其它同一人对同一需求只保留1份有效申请；选定前可修改或撤回；重复点击申请不新增记录');
  assert.deepEqual(repair.followUp[2], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD01').followUp[3], answer);
  assert.deepEqual(handoff.items.find(item => item.id === 'HD04').followUp[6], answer);
  for (const item of records.items) {
    assert.deepEqual(item.confirmed.applicationRules.reapplication, { allowedWhenOpen: true, cooldownHours: 0 });
    assert.equal(Object.hasOwn(item.confirmed.applicationRules, 'withdrawableAfterSelection'), false);
    assert(item.pending.some(text => text.includes('申请同时间排序/历史展示')));
  }
  assert(read('CONTEXT.md').includes('重复点击申请不新增记录'));
  assert(read('docs/module-specs/README.md').includes('选定前可撤回申请不代表选定后可单方取消服务'));
});

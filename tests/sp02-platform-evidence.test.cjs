'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const load=()=>JSON.parse(read('docs/sp02-platform-evidence-20261027.json'));
const gates=['E01','E02','E03','E04','E05','E06','QG01','AG01','DG01'];

test('SP02 accounts for all nine real qualification gates without treating unknown as passed',()=>{
 const record=load(),plan=JSON.parse(read('docs/v1-executable-development-plan-20261027.json')),preflight=JSON.parse(read('docs/v1-development-preflight-20261018.json'));
 a.deepEqual(record.gates.map(g=>g.id),gates);for(const id of plan.tasks.find(t=>t.id==='SP02').evidenceGates)a(gates.includes(id),'SP02 references unknown gate '+id);
 for(const gate of record.gates){a(gate.title&&gate.evidenceLevel&&gate.knownEvidence&&gate.missingEvidence&&gate.owner&&gate.releaseCondition,gate.id);a.equal(gate.gatePassed,false,gate.id+' has no current project-specific pass evidence');}
 a.equal(record.account.appId,preflight.accountProgress.newMiniappAppId);a.equal(record.account.appIdEvidenceLevel,preflight.accountProgress.evidenceLevel);a.equal(record.account.finalServiceCategories,null);a.equal(record.account.filingApproved,false);
 a.equal(record.capabilities.paymentMerchantStatus,'not-applied-user-reported');a.equal(record.account.newCloudDevelopmentStatus,'not-opened-user-reported-2026-10-18');a.equal(record.capabilities.identityVerificationStatus,'not-applied-or-contacted-user-reported');a.equal(record.capabilities.newCloudEnvironmentVerified,false);
 a.equal(record.oldDevelopmentEnvironment.appId,'wx358290e451cb06e7');a.equal(record.oldDevelopmentEnvironment.environmentId,'cloud1-d1g1mv89t76512a25');a.equal(record.oldDevelopmentEnvironment.scope,'development-and-controlled-testing-only');a.equal(record.oldDevelopmentEnvironment.newAccountAttributionVerified,false);a.deepEqual(record.oldDevelopmentEnvironment.userScreenshotObservations,['cloud1','微信体验版','暂无数据','找不到可用的集合']);
 a.equal(record.capabilities.paymentProductEligibilityVerified,false);const paymentRefs=record.officialReferences.filter(x=>x.topic==='wechat-mini-program-payment');a.equal(paymentRefs.length,3);a(paymentRefs.every(x=>x.url.startsWith('https://pay.wechatpay.cn/')));a(paymentRefs.every(x=>x.sourceType==='official-primary-source'&&x.supports.length&&x.doesNotProve.length));a(record.gates.find(g=>g.id==='E04').knownEvidence.some(x=>x.includes('个体工商户')));
 a.equal(record.ai.selectedProvider,null);a.equal(record.ai.measured,false);a.equal(record.data.retentionByCategory,null);a.equal(record.externalConsultation.sent,false);
 const sp02=plan.tasks.find(t=>t.id==='SP02');a.equal(sp02.status,'complete');a.equal(sp02.productAcceptancePassed,false);a.equal(sp02.completion.commit,'2b3dd5d940fb04d6cedeb5d59f2de77bd1025a43');a.equal(sp02.completion.environment,'Windows 11 local documentation and tests; no external actions');a(sp02.completion.evidence.length>=3);a(sp02.executionProgress.completedChecks.some(v=>v.includes('cloud1-d1g1mv89t76512a25')));a(plan.sources.includes('docs/sp02-platform-evidence-20261027.md'));a(plan.sources.includes('docs/sp02-platform-evidence-20261027.json'));
});

test('SP02 human handoff preserves non-authoritative AI claims and forbids unsent external actions',()=>{
 const record=load(),doc=read('docs/sp02-platform-evidence-20261027.md');
 for(const text of ['wx2414399d423dfb65','用户报告','未最终添加服务类目','备案尚未提交/通过','微信开发者助手','小微AI','不能作为项目适用的官方准入证据','cloud1-d1g1mv89t76512a25','图片本身未显示AppID','微信支付公开资料','个体工商户','当前商户号已申请/获批','未发送','没有采购','真实调用或支付','实际证据'])a(doc.includes(text),text);
 a.equal(record.externalConsultation.sent,false);a.equal(record.authorization.purchase,false);a.equal(record.authorization.realAiCalls,false);a.equal(record.authorization.realPayments,false);
 for(const source of record.sources)a(fs.existsSync(path.join(root,source)),source);
});

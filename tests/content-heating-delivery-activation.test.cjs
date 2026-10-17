'use strict';
// Approved planning contract only; does not open real promotion, payment, analytics or timers.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),recordPath="docs/merchant-pricing-confirmed-20261016.json",entries=["docs/merchant-pricing-confirmed-20261016.md","docs/prd.md","docs/development-plan.md","docs/structured-design.md","docs/v2-roadmap.md","docs/ascii-design-prd-2.1.md","docs/module-specs/current-development-basis-20261015.md","docs/module-specs/merchant-banner-direction-20261015.md","CONTEXT.md"];
const read=p=>new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(path.join(root,p))),load=()=>JSON.parse(read(recordPath));
const at=(rev,p)=>cp.execFileSync('git',['show',rev+':'+p],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n');
const expectedResponses=[{"questionItemId":"[\"request_user_input_async\",\"call_a4f468478d6a4c6c938bd5fce4acf101\",0]","id":"content-heating-purchase-unit","selected":null,"question":"第二版内容加热的49元／30天候选价，按什么单位购买？共享池和统一推广密度的方向不变；本题不确定并行购买上限或换帖规则。","answer":"这部分, 我还有点纠结, 你给出几个方案并列出优劣吧"},{"questionItemId":"[\"request_user_input_async\",\"call_a4f468478d6a4c6c938bd5fce4acf101\",1]","id":"content-heating-delivery-commitment","selected":"A","question":"内容加热起步采用哪种交付承诺？当前没有真实流量数据，不能据此认定49元已经具有足够投放价值。","answer":"A（推荐）：提供30天正常参与共享池轮换的权益，披露不承诺固定排名、保底曝光量或成交量；实际曝光／点击如实记录，统计口径另定。"},{"questionItemId":"[\"request_user_input_async\",\"call_a4f468478d6a4c6c938bd5fce4acf101\",2]","id":"content-heating-review-payment-activation","selected":"A","question":"内容加热的推广审核、付款和30天起算，采用哪种顺序？这里的“生效”指推广可正常参与共享池轮换，不以首次访客看到广告为起算条件；实际支付通道仍待核实。","answer":"A（推荐）：先通过推广审核、确认可投放，再付款；付款成功且推广实际生效、可正常参与轮换后起算30天。"}],expectedCommitment={"service":"normal-shared-pool-rotation-participation","periodDays":30,"fixedRankGuaranteed":false,"minimumImpressionsGuaranteed":false,"transactionsGuaranteed":false,"actualImpressionsAndClicksRecordedTruthfully":true,"metricDefinitions":null},expectedSequence=["promotion-review-approval","delivery-availability-confirmation","payment","actual-promotion-effectiveness-and-normal-rotation-availability"],expectedActivation={"requiresPromotionApproved":true,"requiresDeliveryAvailabilityConfirmed":true,"requiresPaymentSucceeded":true,"requiresActuallyEffective":true,"requiresNormalRotationEligibility":true,"periodDays":30,"start":"actual-promotion-effectiveness-after-payment-and-normal-rotation-availability","firstVisitorImpressionRequired":false,"paymentAloneStartsClock":false};
function validate(r){
 const d=r.contentHeatingDeliveryAndActivationDecision,b=r.contentHeating;
 assert.deepEqual(d.responses,expectedResponses);assert.deepEqual(d.approvedResponseIds,expectedResponses.slice(1).map(x=>x.id));assert.deepEqual(d.pendingResponseIds,[expectedResponses[0].id]);
 assert.deepEqual(b.deliveryCommitment,expectedCommitment);assert.deepEqual(b.purchaseSequence,expectedSequence);assert.deepEqual(b.activation,expectedActivation);
 assert.equal(b.globalOrganicInterval,null);assert.equal(b.rotationRulesComplete,false);assert.equal(b.purchaseEligibility.includesNewMainPosting,false);assert.equal(b.purchaseEligibility.activeToolMembershipRequired,false);
 assert.equal(d.realSalesAuthorized,false);for(const value of Object.values(r.execution))assert.equal(value,false);return true;
}
test('first answer stays undecided while only the exact second and third A answers are approved',()=>{
 const live=load(),r=JSON.parse(at(live.contentHeatingPurchaseModelDecision.sourceCommit,recordPath)),d=r.contentHeatingDeliveryAndActivationDecision;assert.equal(r.contentHeating.purchaseUnit,null);assert.equal(validate(r),true);assert.equal(d.sourceCommit,'77c8da25a0ddb6b8ae8f41a0e23d39dcfdb7cf84');assert.equal(d.date,'2026-10-17');assert.equal(d.responseType,'structured-question-replies');assert.equal(d.scope,'v2-content-heating-rotation-delivery-commitment-and-review-payment-activation-order-only');assert.equal(Object.hasOwn(d,'userReply'),false);
});
test('only the two approved commercial rules and undecided unit record change earlier contracts',()=>{
 const live=load(),r=JSON.parse(at(live.contentHeatingPurchaseModelDecision.sourceCommit,recordPath)),prior=JSON.parse(at(r.contentHeatingDeliveryAndActivationDecision.sourceCommit,recordPath));delete r.contentHeatingDeliveryAndActivationDecision;
 for(const key of ['purchaseUnit','deliveryCommitment','purchaseSequence','activation'])delete r.contentHeating[key];assert.deepEqual(r,prior);
 for(const p of ['docs/merchant-banner-refund-confirmed-20261017.json','docs/merchant-banner-refund-confirmed-20261017.md','docs/merchant-membership-refund-confirmed-20261017.json','docs/merchant-membership-refund-confirmed-20261017.md'])assert.equal(read(p).replace(/\r\n/g,'\n'),at('77c8da25a0ddb6b8ae8f41a0e23d39dcfdb7cf84',p),p);
});
test('nine current entries preserve mixed reply status, honest delivery and actual activation boundaries',()=>{
 for(const p of entries){const s=read(p),line=s.split(/\r?\n/).find(x=>x.startsWith('内容加热交付及起算两项确认'));
 for(const phrase of ['第一题要求比较方案，未选择计费单位','第2、3题分别选择A','30天正常参与共享池轮换','不承诺固定排名、保底曝光量或成交量','实际曝光/点击如实记录，统计口径另定','先通过推广审核、确认可投放，再付款','付款成功且推广实际生效、可正常参与轮换后起算','不等首次访客看到广告','不因仅付款就起算','计费单位该组当时未选，现按后续B确认；并行数量与换帖细则仍待确认'])assert(line&&line.includes(phrase),p+': '+phrase);
 const target=line.match(/\[内容加热确认第4\.2节\]\(([^)]+)\)/)[1];assert(fs.existsSync(path.resolve(root,path.dirname(p),target)),p+': source link');
 }
 const s=read('docs/merchant-pricing-confirmed-20261016.md');for(const x of expectedResponses){assert(s.includes(x.question));assert(s.includes(x.answer));}
 for(const phrase of ['#### 4.2','purchaseUnit保持null','不将整组记为“全A”','故障补救和退款细则仍待确认','首次访客看到广告不是起算前提'])assert(s.includes(phrase),phrase);
});
test('PRD and roadmap carry delivery and activation while preserving first-release task boundaries',()=>{
 for(const p of ['docs/prd.md','docs/v2-roadmap.md']){const row=read(p).match(/^\| VP05 \|[^\r\n]+/m)[0];for(const phrase of ['交付30天正常共享轮换且不保底排名/曝光/成交','先推广审核并确认可投放再付款','实际生效可正常轮换才起算30天','计费对象'])assert(row.includes(phrase),p+': '+phrase);}
 assert.equal([...read('docs/development-plan.md').matchAll(/^\| DP\d{2} \|/gm)].length,57);assert.deepEqual(JSON.parse(read('docs/development-remapping-20261015.json')).deferredTaskIds,['DP30','DP31','DP32','DP33','DP34','DP35']);
});
test('historical undecided reply cannot be rewritten into an approval or implicit guarantee',()=>{
 for(const change of [r=>r.contentHeatingDeliveryAndActivationDecision.responses[0].selected='A',r=>r.contentHeatingDeliveryAndActivationDecision.approvedResponseIds.unshift('content-heating-purchase-unit'),r=>r.contentHeating.deliveryCommitment.minimumImpressionsGuaranteed=true,r=>r.contentHeating.deliveryCommitment.fixedRankGuaranteed=true,r=>r.contentHeating.deliveryCommitment.transactionsGuaranteed=true,r=>r.contentHeating.deliveryCommitment.metricDefinitions='unverified']){const r=load();change(r);assert.throws(()=>validate(r));}
});
test('payment alone or first impression cannot replace normal rotation activation or enable execution',()=>{
 for(const change of [r=>r.contentHeating.purchaseSequence.reverse(),r=>r.contentHeating.activation.requiresPromotionApproved=false,r=>r.contentHeating.activation.requiresNormalRotationEligibility=false,r=>r.contentHeating.activation.paymentAloneStartsClock=true,r=>r.contentHeating.activation.firstVisitorImpressionRequired=true,r=>r.contentHeating.activation.periodDays=31,r=>r.execution.realSalesEnabled=true]){const r=load();change(r);assert.throws(()=>validate(r));}
});

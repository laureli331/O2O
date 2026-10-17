'use strict';
// Planning-only reference arithmetic. This is not a product refund implementation.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(path.join(root,p)));
const proposalPath='docs/merchant-membership-refund-proposal-20261016.json';
const get=()=>JSON.parse(read(proposalPath));
const pricing=()=>JSON.parse(read('docs/merchant-pricing-confirmed-20261016.json'));
function validateDraft(p){
 assert.equal(p.status,'historical-draft-three-decisions-confirmed-separately','Draft status');
 assert.deepEqual(p.authorization,{userReply:'全a',choice:'membership-refund-proposal-only',designOnly:true,formulaApproved:false,extraChargesApproved:false},'Design authorization only');
 assert.equal(p.scope,'proposed-voluntary-early-termination-of-platform-owned-v2-membership');
 assert.deepEqual(p.basis,{membershipMonthlyPriceCents:9900,batchDays:30,textUnitsPerBatch:100,imageUnitsPerBatch:30,textPackagePriceCents:490,textPackageUnits:100,imagePackagePriceCents:990,imagePackageUnits:10,allocationType:'proposed-contract-apportionment-not-api-cost',formalPricesVerified:false,fullCostsVerified:false},'Candidate inputs only');
 const c=p.proposedCalculation;
 assert.equal(c.eligibleUnusedAi,'current-valid-batch-and-all-future-unstarted-batches');
 assert.equal(c.pastExpiredUnusedAiRefundableUnderVoluntaryPolicy,false);
 assert.equal(c.expiredUnusedUnitsCountAsActuallyGenerated,false);
 assert.equal(c.timingUnit,'actual-seconds');
 assert.equal(c.rounding,'sum-exact-rational-components-then-nearest-cent-half-up-once');
 assert.equal(c.feeCents,0);
 assert.equal(c.totalRefundCap,'actual-payment-for-that-purchase-period');
 assert.equal(c.repriceUsedUnits,false);
 assert.equal(c.unknownUsage,'verify-records-before-calculating-not-zero');
 assert.equal(c.repeatedRefundAllowed,false);
 assert.equal(p.proposedDisclosure.canonicalGiftWordingChangedNow,false);
 assert.equal(p.proposedDisclosure.retroactiveGiftClawback,false);
 assert.equal(p.proposedDisclosure.discloseAllocationAndRefundExamplesBeforePurchase,true);
 assert.equal(p.proposedDisclosure.purchaseSnapshotRequiredIfAdopted,true);
 for(const k of ['legalApplicabilityVerified','implementationAuthorized','realSalesEnabled','realRefundsExecuted'])assert.equal(p[k],false,k);
 assert.equal(p.nonconformingDeliveryHandledSeparately,true);
 assert.equal(p.requiresExplicitReview.length,4);
}

function exactRefund(example){
 const {days,actualPaidCents,elapsedSeconds,usedByBatch}=example;
 assert([30,90].includes(days),'Supported candidate term');
 assert(Number.isSafeInteger(actualPaidCents)&&actualPaidCents>=0,'Known actual payment');
 assert(Number.isSafeInteger(elapsedSeconds)&&elapsedSeconds>=0,'Known elapsed seconds');
 const n=days/30,total=days*86400;
 assert.equal(usedByBatch.length,n,'Exactly one usage record per batch');
 let text=0,images=0;
 usedByBatch.forEach((used,index)=>{
  assert(Number.isInteger(used.text)&&used.text>=0&&used.text<=100,'Known text usage within allowance');
  assert(Number.isInteger(used.images)&&used.images>=0&&used.images<=30,'Known image usage within allowance');
  const start=index*30*86400,end=start+30*86400;
  if(start>elapsedSeconds)assert(used.text===0&&used.images===0,'Future batch cannot be consumed');
  if(end>elapsedSeconds){text+=100-used.text;images+=30-used.images;}
 });
 // Cents: P*6440*remaining/(9900*D) + P*(49*Ut+990*Ui)/(99000*n).
 const p=BigInt(actualPaidCents),a=p*6440n*BigInt(Math.max(0,total-elapsedSeconds)),b=9900n*BigInt(total);
 const c=p*BigInt(49*text+990*images),d=99000n*BigInt(n);
 const numerator=a*d+c*b,denominator=b*d;
 const rounded=(2n*numerator+denominator)/(2n*denominator);
 return Number(rounded>p?p:rounded);
}

test('original design authorization stays historical while selected rules are confirmed separately',()=>{
 const p=get(),r=pricing();validateDraft(p);
 assert.equal(r.aiAllowanceAndRefundHandlingDecision.membershipRefundFormulaApproved,false);
 assert.equal(r.aiAllowanceAndRefundHandlingDecision.membershipRefundProposal,p.document);
 assert.equal(r.membership.refundRule.record,'docs/merchant-membership-refund-confirmed-20261017.json');
 assert.equal(p.followUpConfirmation.record,r.membership.refundRule.record);
 assert.equal(p.followUpConfirmation.allDraftDetailsApproved,false);
 assert.equal(r.membership.aiAllowance,null);
 assert.equal(r.membership.aiTrial.finalAllowanceApproved,false);
 assert.equal(r.aiAddOnPackages.refundRule.expiredPackagesEligible,true,'Separate paid packages retain expired-unused refunds');
 assert.equal(r.aiAddOnPackages.refundRule.processingTimeLimit.reviewAndInitiateHours,72);
});

test('monthly and quarterly allocations reconcile to actual candidate payment without double discount',()=>{
 const p=get(),r=pricing(),b=p.basis;
 assert.equal(b.membershipMonthlyPriceCents,r.membership.candidateMonthlyPriceCents);
 assert.equal(b.textPackagePriceCents,r.aiAddOnPackages.products[0].candidatePriceCents);
 assert.equal(b.imagePackagePriceCents,r.aiAddOnPackages.products[1].candidatePriceCents);
 const ai=b.textPackagePriceCents+b.imagePackagePriceCents*3;
 assert.equal(ai,3460);
 for(const term of p.candidateTerms){
  const n=term.days/30;
  assert.equal(term.toolAllocationCents+term.aiAllocationCents,term.actualPaidCents);
  assert.equal(term.aiAllocationPerBatchCents*n,term.aiAllocationCents);
  assert.equal(term.toolAllocationCents*9900,6440*term.actualPaidCents);
  assert.equal(term.aiAllocationCents*9900,ai*term.actualPaidCents);
 }
 assert.equal(p.candidateTerms[1].actualPaidCents,26730);
});

for(const example of get().examples)test('draft refund arithmetic: '+example.id,()=>{
 assert.equal(exactRefund(example),example.expectedRefundCents);
 assert(example.expectedRefundCents>=0&&example.expectedRefundCents<=example.actualPaidCents);
});

test('expired-but-unused member allowance stays distinct from actual generations',()=>{
 const examples=get().examples;
 const used=examples.find(x=>x.id==='quarter-day-45-first-batch-exhausted');
 const unused=examples.find(x=>x.id==='quarter-day-45-first-batch-unused');
 assert.notDeepEqual(used.usedByBatch[0],unused.usedByBatch[0]);
 assert.equal(exactRefund(used),exactRefund(unused),'Proposed voluntary policy excludes past batch, never fakes usage');
});

test('full-precision components round only once rather than rounding per-unit AI price',()=>{
 const e=get().examples.find(x=>x.id==='month-day-10-used-20-text-6-images');
 assert.equal(exactRefund(e),7061);
 // Incorrectly rounding .049 yuan to .05 before multiplying yields 70.69 instead.
 assert.equal(Math.round(6440*20/30+80*5+24*99),7069);
 assert.notEqual(exactRefund(e),7069);
});

test('elapsed service is measured by seconds, including sub-day differences',()=>{
 const e=get().examples.find(x=>x.id==='month-day-1-ai-exhausted');
 const halfDay={...e,elapsedSeconds:43200};
 assert.equal(exactRefund(halfDay),6333);
 assert.notEqual(exactRefund(halfDay),exactRefund(e));
});

for(const [name,mutate] of [
 ['unknown usage',e=>e.usedByBatch[0].text=null],
 ['negative usage',e=>e.usedByBatch[0].text=-1],
 ['fractional usage',e=>e.usedByBatch[0].images=0.5],
 ['over-allowance usage',e=>e.usedByBatch[0].images=31],
 ['unknown elapsed time',e=>e.elapsedSeconds=null],
 ['unknown payment',e=>e.actualPaidCents=null],
 ['future quota consumed early',e=>e.usedByBatch[2].text=1]
])test('draft example rejects '+name,()=>{
 const e=structuredClone(get().examples.find(x=>x.id==='quarter-day-10-used-20-text-6-images'));mutate(e);
 assert.throws(()=>exactRefund(e));
});

for(const [name,mutate] of [
 ['draft silently approved',p=>p.authorization.formulaApproved=true],
 ['implementation activated',p=>p.implementationAuthorized=true],
 ['extra charge authorized',p=>p.authorization.extraChargesApproved=true],
 ['expired unused quota rewritten as generated',p=>p.proposedCalculation.expiredUnusedUnitsCountAsActuallyGenerated=true],
 ['used service repriced',p=>p.proposedCalculation.repriceUsedUnits=true],
 ['legal applicability asserted',p=>p.legalApplicabilityVerified=true],
 ['gift promise retroactively changed',p=>p.proposedDisclosure.retroactiveGiftClawback=true]
])test('draft boundary rejects '+name,()=>{const p=get();mutate(p);assert.throws(()=>validateDraft(p));});

test('draft has concrete assumptions, formulas, examples, tradeoffs and review decisions',()=>{
 const p=get(),s=read(p.document);
 for(const phrase of ['先核对99元/30天','本文件是待审草案','64.40元','34.60元','173.88元','93.42元','31.14元','P/(99×n)','64.40×n×k×r','0.049×U文案＋0.99×U图片','62.25元','70.61元','77.53元','241.75元','142.99元','178.20元','不高价重算已用部分','不自动套用本数值','不把未知当0','跨续购期衔接','建议查证','生活消费领域'])assert(s.includes(phrase),phrase);
 assert(s.includes('https://www.court.gov.cn/zixun/xiangqing/459321.html'));
 for(const m of s.matchAll(/\]\(([^)]+)\)/g)){if(/^https?:\/\//.test(m[1]))continue;assert(fs.existsSync(path.resolve(root,path.dirname(p.document),m[1])),'Draft link '+m[1]);}
 const lines=s.split(/\r?\n/);let width=0;
 for(const line of lines){if(!line.startsWith('|')){width=0;continue;}const count=(line.match(/\|/g)||[]).length;if(width)assert.equal(count,width);width=count;}
});

test('quota-priority scenarios preserve earlier expiry even when it is purchased quota',()=>{
 const r=pricing(),policy=r.aiAllowanceConsumption;
 assert.equal(policy.primaryOrder,'earliest-expiry-first');
 const select=pools=>pools.filter(x=>x.kind==='text'&&x.valid&&x.available).sort((a,b)=>a.expiry-b.expiry||policy.sameExpirySourceOrder.indexOf(a.source)-policy.sameExpirySourceOrder.indexOf(b.source)||a.activation-b.activation)[0].id;
 const gift={id:'gift',kind:'text',valid:true,available:true,expiry:20,source:'included-or-gift',activation:1};
 const paid={id:'paid',kind:'text',valid:true,available:true,expiry:2,source:'purchased',activation:0};
 assert.equal(select([gift,paid]),'paid');
 assert.equal(select([paid,{...gift,expiry:2}]),'gift');
 assert.equal(select([{...paid,id:'later',activation:1},paid]),'paid');
 assert.equal(select([{...paid,valid:false},gift]),'gift');
 assert.equal(select([{...paid,available:false},gift]),'gift');
 assert.equal(select([{...paid,kind:'standard-images'},gift]),'gift');
});

test('refund handling spans nights and weekends without guaranteeing arrival',()=>{
 const s=pricing().aiAddOnPackages.refundRule.processingTimeLimit;
 const received=Date.parse('2026-10-16T22:00:00+08:00');
 const completed=Date.parse('2026-10-17T23:00:00+08:00');
 assert.equal(new Date(received+s.firstResponseHours*3600000).toISOString(),'2026-10-17T14:00:00.000Z');
 assert.equal(new Date(completed+s.reviewAndInitiateHours*3600000).toISOString(),'2026-10-20T15:00:00.000Z');
 assert.equal(s.firstResponseStart,'request-received');
 assert.equal(s.reviewAndInitiateStart,'complete-valid-application-submitted-successfully');
 assert.equal(s.arrivalTimeGuaranteed,false);
 assert.equal(s.arrivalTimeLimit,null);
});

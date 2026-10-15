'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const read = p => new TextDecoder('utf-8', {fatal:true}).decode(fs.readFileSync(path.join(root,p)));
const recordPath = 'docs/monetization-decisions-20261015.json';
function bundle() {
  return {
    record: JSON.parse(read(recordPath)),
    prd: read('docs/prd.md'), plan: read('docs/development-plan.md'),
    design: read('docs/structured-design.md'), ascii: read('docs/ascii-design-prd-2.1.md'),
    roadmap: read('docs/v2-roadmap.md'), reserve: read('docs/saas-reserve.md'),
    decisions: read('docs/monetization-decisions-20261015.md'),
  };
}
function validate(b) {
  const r = b.record;
  assert.equal(r.status,'directions-and-bundle-confirmed-details-pending');
  assert.deepEqual(r.commission.currentConfiguration, {
    '跑腿': {rateBasisPoints:1500,cap:{kind:'none'}},
    '维修': {rateBasisPoints:1500,cap:{kind:'fixed',amountCents:3000,unit:'entire-service'}},
    '闲置': {rateBasisPoints:100,cap:{kind:'fixed',amountCents:2000,unit:'single-transaction'}},
    '其它': {rateBasisPoints:1000,trial:true,cap:{kind:'fixed',amountCents:2000,unit:'entire-service'}},
  },'Current commission and caps');
  assert.equal(r.commission.previousIdleRateBasisPoints,500);
  assert.equal(r.commission.reviewDaysAfterActualActivation,30);
  assert.equal(r.commission.existingLockedSnapshotsRetained,true);
  assert.equal(r.commission.customerFundsCollected,false);
  assert(b.prd.includes('| 闲置 | 1% | 每笔交易20元 |'),'PRD idle rate');
  assert(b.plan.includes('闲置1%每笔20'),'Plan idle rate');
  assert(b.design.includes('闲置1%每笔20元'),'Design idle rate');
  assert(b.ascii.includes('佣金：1%，单笔最多20元') && b.ascii.includes('闲置：1% / 每笔20元'),'ASCII idle rate');
  assert.equal(r.bundle.kind,'tools-membership-with-optional-purchases');
  assert.deepEqual(r.bundle.included,['basic-tools','basic-campaign-tools','defined-ai-allowance']);
  assert.equal(r.bundle.nonmemberSinglePurchase,true);
  assert.equal(r.bundle.exposurePurchasedSeparately,true);
  assert.equal(r.bundle.includedEntitlementsChargedAgain,false);
  assert.equal(r.bundle.automaticAdditionalPurchase,false);
  for (const key of ['membershipPriceCents','billingCycle','aiAllowance','extraAiPriceCents','singlePurchasePrices','exposurePrices']) assert.equal(r.bundle[key],null,'Pending '+key);
  assert.equal(r.marketingAi.mode,'self-service');
  assert.equal(r.marketingAi.release,'v2');
  assert.equal(r.marketingAi.v1ResidentAiChargingChanged,false);
  assert.equal(r.exposure.billing,'display-period');
  assert.equal(r.exposure.actualReport,true);
  assert.equal(r.exposure.slotRelease,null,'No inferred Banner release');
  assert.equal(r.exposure.deliveryRulesComplete,false);
  assert.equal(r.campaign.release,'v2');
  assert.deepEqual(r.campaign.features,['activity-page','free-coupon-claim','in-store-redemption']);
  assert.equal(r.publisherAds.release,'v2');
  assert.equal(r.publisherAds.mode,'limited-display-ad-trial');
  assert.equal(r.publisherAds.rewardedVideoApproved,false);
  assert.equal(r.publisherAds.coreFlowAdGate,false);
  assert.deepEqual(r.secondVersionScope,['VP01','VP02','VP03','VP04','VP05','VP06','VP07']);
  assert.deepEqual([...b.roadmap.matchAll(/^\| (VP\d{2}) \|/gm)].map(m=>m[1]),r.secondVersionScope,'Roadmap scope');
  assert.deepEqual([...b.prd.matchAll(/^\| (VP\d{2}) \|/gm)].map(m=>m[1]),r.secondVersionScope,'PRD scope');
  assert.equal(r.saas.status,'long-term-reserve');
  assert.deepEqual(r.saas.excludedReleases,['v1','v2']);
  assert.equal(r.saas.startDate,null);
  assert.equal(r.saas.pilotAuthorized,false);
  assert(b.reserve.includes('第一版、第二版均不纳入'),'SaaS narrative exclusion');
  assert(b.decisions.includes('价格、额度和交付细则尚未定稿'),'No invented commercial completion');
  for(const key of ['productImplemented','realServicesEnabled','merchantPermissionVerified','realFeesVerified','reminderConfigurationUpdated','technicalDetailingResumed','visualDesignResumed']) assert.equal(r.execution[key],false,key);
  assert.equal(r.approvals.length,8);
  assert.equal(r.approvals[0].userReply,'我同意你的建议');
  assert.equal(r.approvals[4].userReply,'a, 这个留到第二版吧');
  assert.equal(r.approvals[6].userReply,'这里单独做个保留, 有机会再上线, 先不纳入第一版和第二版');
  assert.equal(r.approvals[7].userReply,'没问题');
  return true;
}
test('approved monetization scope, current commission, release boundaries and unknown prices agree',()=>assert.equal(validate(bundle()),true));
const changes = [
  ['restore obsolete idle rate',b=>b.record.commission.currentConfiguration['闲置'].rateBasisPoints=500,/commission/],
  ['raise repair cap',b=>b.record.commission.currentConfiguration['维修'].cap.amountCents=5000,/commission/],
  ['stale PRD idle rate',b=>b.prd=b.prd.replace('| 闲置 | 1% |','| 闲置 | 5% |'),/PRD idle rate/],
  ['stale plan rate',b=>b.plan=b.plan.replace('闲置1%每笔20','闲置5%每笔20'),/Plan idle rate/],
  ['stale design rate',b=>b.design=b.design.replace('闲置1%每笔20元','闲置5%每笔20元'),/Design idle rate/],
  ['stale ASCII rate',b=>b.ascii=b.ascii.replace('佣金：1%，单笔最多20元','佣金：5%，单笔最多20元'),/ASCII idle rate/],
  ['fabricated membership price',b=>b.record.bundle.membershipPriceCents=990,/Pending/],
  ['fabricated AI allowance',b=>b.record.bundle.aiAllowance=100,/Pending/],
  ['charge twice for included tools',b=>b.record.bundle.includedEntitlementsChargedAgain=true,/Expected values/],
  ['force nonmembers to subscribe',b=>b.record.bundle.nonmemberSinglePurchase=false,/Expected values/],
  ['automatic top-up',b=>b.record.bundle.automaticAdditionalPurchase=true,/Expected values/],
  ['move campaigns to first release',b=>b.record.campaign.release='v1',/Expected values/],
  ['approve rewarded ads implicitly',b=>b.record.publisherAds.rewardedVideoApproved=true,/Expected values/],
  ['infer Banner release',b=>b.record.exposure.slotRelease='v1',/Banner release/],
  ['omit publisher ads from roadmap',b=>b.roadmap=b.roadmap.replace(/^\| VP07 \|[^\r\n]+\r?\n/m,''),/Roadmap scope/],
  ['sell SaaS in second release',b=>b.record.saas.excludedReleases=['v1'],/Expected values/],
  ['schedule SaaS without approval',b=>b.record.saas.startDate='2027-01-01',/Expected values/],
  ['claim permission verified',b=>b.record.execution.merchantPermissionVerified=true,/merchantPermissionVerified/],
  ['restart technical detailing',b=>b.record.execution.technicalDetailingResumed=true,/technicalDetailingResumed/],
];
for(const [name,change,error] of changes) test('monetization rejects '+name,()=>{
  const b=bundle();change(b);assert.throws(()=>validate(b),error);
});
test('original business replies, reminder configuration, archives and first-version task statuses are preserved',()=>{
  const r=bundle().record, prior=p=>JSON.parse(cp.execFileSync('git',['show',r.sourceCommit+':'+p],{cwd:root,encoding:'utf8'}));
  for(const p of ['docs/module-specs/decisions.json','docs/development-decisions.json']){
    const old=prior(p),current=JSON.parse(read(p));
    for(const key of Object.keys(old)) assert.deepEqual(current[key],old[key],p+': original '+key);
    assert.equal(current.monetizationSupplement.record,recordPath);
  }
  assert.equal(prior('docs/module-specs/decisions.json').commissionConfirmationRules.businessConfiguration['闲置'].rateBasisPoints,500);
  assert.deepEqual(JSON.parse(read('docs/development-remapping-20261015.json')),prior('docs/development-remapping-20261015.json'));
});
test('current entry points link the supplement and new documents keep valid links and tables',()=>{
  for(const p of ['docs/prd.md','docs/development-plan.md','docs/structured-design.md','docs/ascii-design-prd-2.1.md','docs/v2-roadmap.md','docs/module-specs/current-development-basis-20261015.md','docs/module-specs/README.md','CONTEXT.md']) assert(read(p).includes('monetization-decisions-20261015.md'),p+' supplement link');
  for(const p of ['docs/monetization-decisions-20261015.md','docs/saas-reserve.md','docs/v2-roadmap.md']){
    const text=read(p);let width=0;
    for(const line of text.split(/\r?\n/)){if(!line.startsWith('|')){width=0;continue;}const n=(line.match(/\|/g)||[]).length;if(width)assert.equal(n,width,p);width=n;}
    const fences = new RegExp('^'+String.fromCharCode(96).repeat(3),'gm');
    assert.equal((text.match(fences)||[]).length%2,0,p);
    for(const m of text.matchAll(/\]\(([^)]+)\)/g)){if(/^(https?:\/\/|#)/.test(m[1]))continue;assert(fs.existsSync(path.resolve(root,path.dirname(p),m[1].split('#')[0])),p+': '+m[1]);}
  }
});

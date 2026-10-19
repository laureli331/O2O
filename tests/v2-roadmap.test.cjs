'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => new TextDecoder('utf-8', {fatal:true}).decode(fs.readFileSync(path.join(root,p)));
function current() {
  return {prd:read('docs/prd.md'), plan:read('docs/development-plan.md'), design:read('docs/structured-design.md'), roadmap:read('docs/v2-roadmap.md'), record:JSON.parse(read('docs/development-decisions.json'))};
}
function ids(text,prefix) {
  return [...text.matchAll(new RegExp('^\\| ('+prefix+'\\d{2}) \\|','gm'))].map(m=>m[1]);
}
function validate(b) {
  const legacyScope=['VP01','VP02','VP03','VP04','VP05'];
  const scope=JSON.parse(read('docs/monetization-decisions-20261015.json')).secondVersionScope;
  assert.deepEqual(ids(b.prd,'VP'),scope,'PRD second-version scope');
  assert.deepEqual(ids(b.roadmap,'VP'),scope,'Roadmap second-version scope');
  assert.deepEqual(b.record.featurePlanning.v2Scope,legacyScope,'Original feature-planning scope is retained as history');
  assert.equal(b.record.featurePlanning.merchantSquareRelease,'v2','Historical merchant-square release remains v2');
  assert.equal(b.record.discoveryFirstReleaseDecision.release,'v1','Current decision moves free base discovery into v1');
  assert.equal(b.record.discoveryFirstReleaseDecision.overridesHistoricalMerchantSquareRelease,true,'Current decision explicitly overrides the historical release assignment');
  assert.equal(b.record.discoveryFirstReleaseDecision.excludedCapabilities.includes('content-heating'),true,'Content heating stays outside v1');
  assert.equal(b.record.featurePlanning.merchantSquareMainPosts,'merchants-only','Only merchants publish square main posts');
  assert.deepEqual(b.record.featurePlanning.merchantSquareCustomerActions,['comment','favorite','wechat-share'],'Customer square actions');
  assert.equal(b.record.featurePlanning.merchantCommercialTermsConfirmed,false,'Commercial terms remain unconfirmed');
  assert.equal(b.record.featurePlanning.merchantPrices,null,'No fabricated merchant prices');
  assert.equal(b.record.featurePlanning.merchantTransactionCommissionPlanned,false,'No third-party transaction commission');
  assert.equal(b.record.featurePlanning.merchantPermissionVerified,false,'Merchant permission is not verified');
  assert.equal(b.record.featurePlanning.userRestrictionCorrection,'third-party-transaction-entry-and-commission-not-all-payment','Payment versus commission correction');
  assert.equal(ids(b.plan,'DP').length,60,'Current plan adds only approved first-version discovery work without implementing the second-version scope');
  assert.equal(ids(b.prd,'M').length,15,'PRD 2.1 modules include discovery, other business and commission');
  assert.equal(ids(b.prd,'F').length,22,'PRD 2.1 fields include discovery, time, staged fees and commission');
  assert.equal(ids(b.prd,'V').length,23,'PRD 2.1 page groups include discovery and commission billing');
  assert.equal(['T','RT','AT','DT','BX'].reduce((n,p)=>n+ids(b.prd,p).length,0),82,'PRD 2.1 acceptance includes discovery and confirmed exception rules');
  const r=b.record.versionTwoReminder;
  assert.equal(r.kind,'heartbeat','Reminder is attached to the current chat');
  assert.equal(r.status,'ACTIVE','Reminder must be active');
  assert.equal(r.target,'current-thread','Reminder target');
  assert.equal(r.timezone,'Asia/Shanghai','Reminder timezone');
  assert.equal(r.localCheckTime,'20:00','Verified reminder time');
  assert.deepEqual(r.scope,legacyScope,'Original saved reminder scope is retained without claiming an app update');
  assert.equal(r.fullLaunchAcceptanceRequired,true,'Full real launch acceptance required');
  assert.equal(r.continuousStableDaysRequired,14,'Fourteen stable days required');
  assert.equal(r.stableEvidenceRequired,true,'Stable evidence required');
  assert.equal(r.resetAfterBlockingOrSevereIncident,true,'Blocking or severe incident resets observation');
  assert.equal(r.resetOrigin,'repair-acceptance-passed','Reset starts after repair acceptance');
  assert.equal(r.silenceProvesStability,false,'Silence is not stability evidence');
  assert.equal(r.creationDateIsObservationStart,false,'Reminder creation is not the observation start');
  assert.equal(r.notifyOncePerStableCycle,true,'No repeated reminder for the same cycle');
  assert.equal(r.automaticImplementation,false,'Reminder does not authorize implementation');
  for(const term of ['连续14天','从修复验收通过时重新计时','没有故障报告、没有消息也不能证明稳定','文档测试、演示、模拟或部分流程通过不能替代','入驻费/推流费/服务费','不写成所有收款受限','不自动开发/收费/上线']) {
    assert(b.roadmap.includes(term),'Roadmap boundary: '+term);
  }
  return true;
}
test('second-version scope, original scope and created conditional reminder agree',()=>assert.equal(validate(current()),true));
const changes=[
  ['historical merchant scope rewritten in place', b=>b.record.featurePlanning.merchantSquareRelease='v1', /Historical merchant-square/],
  ['current first-release override removed', b=>delete b.record.discoveryFirstReleaseDecision, /release/],
  ['unconfirmed merchant price filled in', b=>b.record.featurePlanning.merchantPrices={entry:99}, /fabricated/],
  ['merchant permission claimed verified', b=>b.record.featurePlanning.merchantPermissionVerified=true, /not verified/],
  ['all payment confused with commission', b=>b.record.featurePlanning.userRestrictionCorrection='all-payment-blocked', /correction/],
  ['stable records omitted', b=>b.record.versionTwoReminder.stableEvidenceRequired=false, /Stable evidence/],
  ['incident reset removed', b=>b.record.versionTwoReminder.resetAfterBlockingOrSevereIncident=false, /resets observation/],
  ['clock starts before repair acceptance', b=>b.record.versionTwoReminder.resetOrigin='incident-reported', /repair acceptance/],
  ['no news treated as stable', b=>b.record.versionTwoReminder.silenceProvesStability=true, /Silence/],
  ['today used as observation start', b=>b.record.versionTwoReminder.creationDateIsObservationStart=true, /creation/],
  ['reminder turned into automatic development', b=>b.record.versionTwoReminder.automaticImplementation=true, /does not authorize/],
  ['marketing item omitted from roadmap', b=>b.roadmap=b.roadmap.replace(/^\| VP05 \|[^\r\n]+\r?\n/m,''), /Roadmap second-version/],
];
for(const [name,change,error] of changes)test(name+' is rejected',()=>{
  const b=current();change(b);assert.throws(()=>validate(b),error);
});
test('actual launch dates and stable records have not been fabricated',()=>{
  const r=current().record.versionTwoReminder;
  for(const key of ['formalReleaseVersion','fullLaunchAcceptanceAt','observationStartedAt','lastRepairAcceptanceAt','reminderDeliveredAt'])assert.equal(r[key],null,key);
  assert.deepEqual(r.stableEvidence,[]);
});
test('roadmap uses valid links, UTF-8, table columns and paired fences',()=>{
  const text=current().roadmap;
  let width=0;
  for(const line of text.split(/\r?\n/)){
    if(!line.startsWith('|')){width=0;continue;}
    const next=(line.match(/\|/g)||[]).length;
    if(width)assert.equal(next,width,'Table width');width=next;
  }
  assert.equal((text.match(/^```/gm)||[]).length%2,0);
  for(const m of text.matchAll(/\]\(([^)]+)\)/g)){
    if(/^(https?:\/\/|#)/.test(m[1]))continue;
    assert(fs.existsSync(path.resolve(root,'docs',m[1].split('#')[0])),'Link: '+m[1]);
  }
});

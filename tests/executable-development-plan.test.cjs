'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),load=()=>JSON.parse(read('docs/v1-executable-development-plan-20261027.json'));
const scope=JSON.parse(read('docs/v1-scope-confirmed-20261026.json')),tech=JSON.parse(read('docs/development-decisions.json'));
function validate(p){
 a.equal(p.taskCount,p.tasks.length);a.equal(p.taskCount,36);a.equal(p.deliveryScope,'documentation-and-validation-only');
 const ids=p.tasks.map(t=>t.id);a.deepEqual(ids,Array.from({length:36},(_,i)=>'SP'+String(i+1).padStart(2,'0')));const byId=new Map(p.tasks.map(t=>[t.id,t]));
 const legacy=new Set([...read('docs/development-plan.md').matchAll(/^\| (DP\d{2}) \|/gm)].map(m=>m[1]));const covered=new Set();
 for(const t of p.tasks){a(t.title&&t.deliverable);a(t.steps.length>=2&&t.steps.every(Boolean));a(t.acceptance.length>=2&&t.acceptance.every(Boolean));a(['planned','in-progress','awaiting-acceptance','complete'].includes(t.status));if(t.status==='complete')a(t.completion?.commit&&t.completion?.environment&&t.completion?.evidence?.length,'completion needs evidence');else a.equal(t.productAcceptancePassed,false);for(const id of t.legacyTasks){a(legacy.has(id),'unknown legacy '+id);covered.add(id);}for(const dep of t.dependsOn)a(byId.has(dep),'unknown predecessor '+dep);for(const g of t.evidenceGates)a(['E01','E02','E03','E04','E05','E06','QG01','AG01','DG01'].includes(g));}
 a.deepEqual([...covered].sort(),[...legacy].sort());
 const visiting=new Set(),done=new Set();function visit(id){a(!visiting.has(id),'cyclic dependency '+id);if(done.has(id))return;visiting.add(id);byId.get(id).dependsOn.forEach(visit);visiting.delete(id);done.add(id);}ids.forEach(visit);
 const ancestors=id=>new Set(byId.get(id).dependsOn.flatMap(d=>[d,...ancestors(d)]));
 a.equal(p.firstProductTask,'SP07');a.deepEqual(p.firstProductTaskPrerequisites,['SP01','SP02','SP03','SP04','SP05','SP06']);for(const id of p.firstProductTaskPrerequisites)a(ancestors('SP07').has(id),'engineering prerequisite '+id);for(const id of ids.slice(7))a(ancestors(id).has('SP07'),'product bypass '+id);
 a(ancestors('SP23').has('SP22'),'core before merchant');
 for(const key of ['firstRelease','conditionalNotEnabled','deferred','excluded'])a.deepEqual(p.scope[key],scope[key]);
 const features=new Set(p.tasks.flatMap(t=>t.features));for(const f of scope.firstRelease)a(features.has(f),'missing first release '+f);for(const f of features)a(scope.firstRelease.includes(f),'unapproved first-release feature '+f);
 a.equal(p.scope.couponsIncludedInOnboarding,true);a(p.tasks.find(t=>t.id==='SP25').pages.includes('V26'));
 for(const v of Object.values(p.authorization))a.equal(v,false,'plan is not production approval');
 a.equal(p.architecture.frontend,tech.approval.frontend);a.equal(p.architecture.backend,tech.approval.backend);a.equal(p.architecture.managementAccounts,1);a.equal(p.architecture.actualHumanAttribution,false);a.equal(p.architecture.databaseMode,null);a.equal(p.architecture.cloudRuntimeVersion,null);a.equal(p.architecture.sdkVersions,null);a.equal(p.accountEvidence.licenseObtainedRecorded,tech.businessLicenseCompletion.licenseObtained);a.equal(p.accountEvidence.formalNewAppId,tech.accountRouteDecision.newAppId);a.equal(p.accountEvidence.liveCloudRevalidatedThisDelivery,false);
 a.equal(p.openItems.length,8);for(const x of p.openItems){a(x.title&&x.kind);a.equal(typeof x.humanDecisionNeeded,'boolean');for(const id of x.tasks)a(byId.has(id));}
 for(const source of p.sources)a(fs.existsSync(path.join(root,source)),source);
 return true;
}
test('executable plan covers all first-release modules and all 60 legacy references with a gated acyclic task graph',()=>a.equal(validate(load()),true));
test('human plan and structured 36 delivery cards agree on work, dependencies and acceptance',()=>{const p=load(),s=read(p.document);for(const t of p.tasks){const start=s.indexOf('### '+t.id+' '+t.title);a(start>=0,t.id);const next=s.indexOf('\n### ',start+1),block=s.slice(start,next<0?s.indexOf('\n## 7.',start):next);a(block.includes(t.deliverable),t.id+' deliverable');for(const v of [...t.dependsOn,...t.steps,...t.acceptance])a(block.includes(v),t.id+' '+v);}for(const [,target]of s.matchAll(/\]\(([^)]+)\)/g))if(!/^https?:/.test(target))a(fs.existsSync(path.resolve(path.dirname(path.join(root,p.document)),target.split('#')[0])),target);a(s.indexOf('## 1. 验证方案')<s.indexOf('## 6. 36张'));});
test('repository inventory is an as-of source snapshot and does not prohibit creating a future product',()=>{const p=load();a.match(p.sourceCommit,/^[a-f0-9]{40}$/);const names=cp.execFileSync('git',['ls-tree','--name-only',p.sourceCommit],{cwd:root,encoding:'utf8'}).split(/\r?\n/);for(const name of ['miniprogram','cloudfunctions','packages','package.json','project.config.json'])a(!names.includes(name));a.equal(p.inventory.formalProjectPresent,false);a.equal(p.inventory.localVersionsAreCloudVersions,false);});
test('current plan entry points preserve legacy rows and point to the new execution document',()=>{for(const file of ['docs/development-plan.md','docs/post-registration-development.md','docs/module-specs/current-development-basis-20261015.md','CONTEXT.md'])a(read(file).includes('v1-executable-development-plan-20261027.md'),file);const p=load();a(p.legacyOverrides.some(x=>x.legacy.includes('DP14')&&x.decision==='provider-profiles-only-no-people-directory'));a(p.legacyOverrides.some(x=>x.legacy.includes('DP25')&&x.decision==='existing-legal-history-only-v17-archived'));a.equal(p.tasks.flatMap(t=>t.pages).includes('V17'),false);a(!scope.remainingDecisionsOrEvidence.includes('new-onboarding-and-coupon-ascii-html-design'));a.equal(scope.prototypeDelivery.realAbilitiesVerified,false);a.equal(scope.formalDevelopmentReady,false);});
for(const [name,mutate]of [
 ['missing task',p=>p.tasks.pop()],
 ['unknown predecessor',p=>p.tasks[6].dependsOn.push('SP99')],
 ['dependency cycle',p=>p.tasks[0].dependsOn=['SP07']],
 ['engineering before prerequisites',p=>p.tasks[6].dependsOn=[]],
 ['silently enabled balance',p=>p.tasks[12].features.push('platform-service-balance')],
 ['silent production approval',p=>p.authorization.productionDeploymentAuthorized=true],
 ['invented runtime',p=>p.architecture.cloudRuntimeVersion='24'],
 ['invented completion',p=>{p.tasks[6].status='complete';p.tasks[6].productAcceptancePassed=true;}],
 ['missing module',p=>p.tasks[27].features=[]],
 ['invented legacy id',p=>p.tasks[0].legacyTasks.push('DP99')]
])test('execution validator rejects '+name,()=>{const p=load();mutate(p);a.throws(()=>validate(p));});

function validateUiProgress(p){
 const ui=p.prototypeUiDelivery,proof=JSON.parse(read('docs/ui-consistency-verification-20261027.json')),manifest=JSON.parse(read('docs/ui-consistency-pages-20261027.json'));
 a.equal(ui.status,'complete-prototype-only');a.equal(ui.commit,cp.execFileSync('git',['rev-parse','f729b0e'],{cwd:root,encoding:'utf8'}).trim());
 a.deepEqual(ui.activePages,manifest.pages.map(x=>x.file));a.deepEqual(ui.excludedPages,manifest.excludedPages);a.equal(ui.stylesheetSha256,proof.stylesheetSha256);
 for(const key of ['layoutStateChecks','pilotInteractionChecks','nodeTests'])a.equal(ui.validation[key],proof[key]);
 a.equal(ui.realMiniProgramTested,false);a.equal(ui.livePaymentTested,false);a.equal(ui.formalTaskCompleted,false);
 const sp=p.tasks.find(x=>x.id==='SP05');a.equal(sp.prototypeProgress.uiDeliveryRef,'prototypeUiDelivery');a.equal(sp.status,'planned');a.equal(sp.productAcceptancePassed,false);a(sp.prototypeProgress.remaining.length>=3);
 for(const f of ui.evidence)a(p.sources.includes(f)&&fs.existsSync(path.join(root,f)));
 return true;
}
test('development plan records completed UI rollout separately from unfinished formal task SP05',()=>a(validateUiProgress(load())));
test('all current execution entry documents expose the completed UI baseline and implementation source',()=>{
 for(const f of ['docs/v1-executable-development-plan-20261027.md','docs/development-plan.md','docs/post-registration-development.md','CONTEXT.md']){const doc=read(f);a(doc.includes('ui-consistency-rollout-delivery-20261027.md'),f);a(doc.includes('f729b0e'),f);}
 const p=load(),doc=read(p.document);for(const text of p.tasks.find(t=>t.id==='SP05').prototypeProgress.remaining)a(doc.includes(text),text);
});
test('UI progress cannot claim real-device completion or omit accepted page coverage',()=>{
 for(const mutate of [p=>p.prototypeUiDelivery.realMiniProgramTested=true,p=>p.prototypeUiDelivery.activePages.pop(),p=>p.tasks.find(t=>t.id==='SP05').status='complete']){const p=load();mutate(p);a.throws(()=>validateUiProgress(p));}
});

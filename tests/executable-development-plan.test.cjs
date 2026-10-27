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
 a.equal(p.architecture.frontend,tech.approval.frontend);a.equal(p.architecture.backend,tech.approval.backend);a.equal(p.architecture.managementAccounts,1);a.equal(p.architecture.actualHumanAttribution,false);a.equal(p.architecture.databaseMode,null);a.equal(p.architecture.cloudRuntimeVersion,null);a.equal(p.architecture.sdkVersions,null);a.equal(p.accountEvidence.licenseObtainedRecorded,tech.businessLicenseCompletion.licenseObtained);a.equal(p.accountEvidence.formalNewAppId,JSON.parse(read('docs/v1-development-preflight-20261018.json')).accountProgress.newMiniappAppId);a.equal(p.accountEvidence.liveCloudRevalidatedThisDelivery,false);
 a.equal(p.openItems.length,8);for(const x of p.openItems){a(x.title&&x.kind);a.equal(typeof x.humanDecisionNeeded,'boolean');for(const id of x.tasks)a(byId.has(id));}
 for(const source of p.sources)a(fs.existsSync(path.join(root,source)),source);
 return true;
}
test('executable plan covers all first-release modules and all 60 legacy references with a gated acyclic task graph',()=>a.equal(validate(load()),true));
test('human plan and structured 36 delivery cards agree on work, dependencies and acceptance',()=>{const p=load(),s=read(p.document);for(const t of p.tasks){const start=s.indexOf('### '+t.id+' '+t.title);a(start>=0,t.id);const next=s.indexOf('\n### ',start+1),block=s.slice(start,next<0?s.indexOf('\n## 7.',start):next);a(block.includes(t.deliverable),t.id+' deliverable');for(const v of [...t.dependsOn,...t.steps,...t.acceptance])a(block.includes(v),t.id+' '+v);}for(const [,target]of s.matchAll(/\]\(([^)]+)\)/g))if(!/^https?:/.test(target))a(fs.existsSync(path.resolve(path.dirname(path.join(root,p.document)),target.split('#')[0])),target);a(s.indexOf('## 1. 验证方案')<s.indexOf('## 6. 36张'));});
test('repository inventory is an as-of source snapshot and does not prohibit creating a future product',()=>{const p=load();a.match(p.sourceCommit,/^[a-f0-9]{40}$/);const names=cp.execFileSync('git',['ls-tree','--name-only',p.sourceCommit],{cwd:root,encoding:'utf8'}).split(/\r?\n/);for(const name of ['miniprogram','cloudfunctions','packages','package.json','project.config.json'])a(!names.includes(name));a.equal(p.inventory.formalProjectPresent,false);a.equal(p.inventory.localVersionsAreCloudVersions,false);});
test('plan uses the latest reported registration record without inventing a cloud environment',()=>{const p=load(),preflight=JSON.parse(read('docs/v1-development-preflight-20261018.json')),progress=preflight.accountProgress,sp01=p.tasks.find(t=>t.id==='SP01'); a.equal(progress.newMiniappRegistered,true);a.equal(p.accountEvidence.formalNewAppId,progress.newMiniappAppId);a.equal(p.accountEvidence.formalNewAppIdEvidence,progress.evidenceLevel);a.equal(p.accountEvidence.formalNewAppIdSource,progress.sourceDocument);a.equal(p.accountEvidence.formalNewEnvironmentId,null);a.equal(p.accountEvidence.formalNewEnvironmentStatus,'not-verified');a.equal(preflight.integrationProgressUpdate.newSubjectCloudDevelopment.openingStatus,'not-opened-user-reported');a.equal(sp01.status,'in-progress');a.equal(sp01.productAcceptancePassed,false);a.equal(sp01.executionProgress.blockedChecks.length,3);a(p.sources.includes('docs/miniapp-filing-progress-20261018.md'));});
test('SP01 execution record distinguishes local evidence, official candidates, and failed live cloud lookup',()=>{const p=load(),doc=read('docs/sp01-technical-environment-20261027.md'),planDoc=read('docs/v1-executable-development-plan-20261027.md');for(const text of ['Node.js 24.18.0','npm 11.16.0','login=true','code 10','system error','wx2414399d423dfb65','Node.js 24.11','Nodejs24.11','未取得环境清单','cloud1-d1g1mv89t76512a25','wx358290e451cb06e7','图片本身未显示AppID','没有创建、修改或部署任何云资源','回退','Codex 客户端授权返回 authorized=true、alreadyTrusted=true','CONNECT_ERROR','未收到目标AppID的云端响应','用户确认重新打开微信开发者工具','本次再次显式授权后仍为','安装诊断返回 compatible=true'])a(doc.includes(text),text);a(planDoc.includes('重启后再次查询云环境仍在本地连接层返回'));for(const url of ['https://docs.cloudbase.net/en/cloud-function/runtime-support','https://docs.cloudbase.net/cli-v1/functions/configs','https://docs.cloudbase.net/en/database/transaction','https://docs.cloudbase.net/storage/data-permission'])a(doc.includes(url),url);a.equal(p.architecture.cloudRuntimeVersion,null);a.equal(p.architecture.databaseMode,null);a.equal(p.architecture.sdkVersions,null);a.equal(p.accountEvidence.liveCloudRevalidatedThisDelivery,false);a.equal(p.accountEvidence.latestReadOnlyQueryAttempt.clientName,'Codex');a.equal(p.accountEvidence.latestReadOnlyQueryAttempt.cliAuthorization,'already-trusted');a.equal(p.accountEvidence.latestReadOnlyQueryAttempt.queryStatus,'connect-error-before-cloud-response');a.equal(p.accountEvidence.latestReadOnlyQueryAttempt.environmentListRetrieved,false);a.equal(p.accountEvidence.latestReadOnlyQueryAttempt.devtoolsRestartConfirmedByUser,true);a.deepEqual(p.accountEvidence.latestReadOnlyQueryAttempt.processObservationAfterRestart,{processId:51712,startedAtLocal:'2026-10-27 20:06:15'});a.equal(p.accountEvidence.latestReadOnlyQueryAttempt.postRestartAuthorization.authorized,true);a.equal(p.accountEvidence.latestReadOnlyQueryAttempt.postRestartAuthorization.alreadyTrusted,true);a.equal(p.inventory.wechatDevToolsInstallationDiagnostic.compatible,true);a.equal(p.inventory.wechatDevToolsInstallationDiagnostic.version,'2.02.2608080');a.equal(p.inventory.wechatDevToolsInstallationDiagnostic.provesBridgeConnection,false);a(p.tasks.find(t=>t.id==='SP01').executionProgress.blockedChecks[0].includes('重启后再次查询仍返回CONNECT_ERROR'));a.equal(p.accountEvidence.oldCloudEnvironmentReadOnlyEvidence.appId,'wx358290e451cb06e7');a.equal(p.accountEvidence.oldCloudEnvironmentReadOnlyEvidence.environmentId,'cloud1-d1g1mv89t76512a25');a.equal(p.accountEvidence.oldCloudEnvironmentReadOnlyEvidence.scope,'development-and-controlled-testing-only');a.equal(p.accountEvidence.oldCloudEnvironmentReadOnlyEvidence.screenshotAppIdVisible,false);});

test('SP01 keeps the post-restart CLI status error separate from login state', () => {
  const record = load();
  const doc = read('docs/sp01-technical-environment-20261027.md');
  a.deepEqual(record.accountEvidence.latestReadOnlyQueryAttempt.postRestartStatusCheck, {
    tool: 'check_wechatide_status',
    errorType: 'CONNECT_ERROR',
    loginExpired: null,
    versionRelation: null,
  });
  a(doc.includes('重启后的CLI状态检查'));
  a(doc.includes('未取得`versionRelation`或`loginExpired`字段'));
});

test('SP01 records current CLI authorization and listener separately from failed IDE tool calls', () => {
  const record = load();
  const attempt = record.accountEvidence.latestReadOnlyQueryAttempt;
  a.deepEqual(attempt.bridgeListenerObserved, {
    address: '127.0.0.1',
    port: 31781,
    processId: 51712,
    listening: true,
  });
  a.equal(attempt.latestCliAuthorization.authorized, true);
  a.equal(attempt.latestCliAuthorization.alreadyTrusted, true);
  a.equal(attempt.latestCliAuthorization.cliTokenRequired, false);
  a.deepEqual(attempt.latestToolCalls, [
    { tool: 'cloud_env_list', errorType: 'CONNECT_ERROR', cloudResponseReceived: false },
    { tool: 'check_wechatide_status', errorType: 'CONNECT_ERROR', cloudResponseReceived: false },
  ]);
  const doc = read('docs/sp01-technical-environment-20261027.md');
  a.ok(doc.includes('本机`127.0.0.1:31781`仍由PID `51712`监听'));
  a.ok(doc.includes('本次再次显式授权后仍为'));
  a.ok(doc.includes('`cloud_env_list`和`check_wechatide_status`均继续在本地连接层返回`CONNECT_ERROR`'));
});

test('SP01 records the local diagnostic project AppID separately from the new target AppID', () => {
  const record = load();
  a.deepEqual(record.accountEvidence.currentWindowObservation, {
    visibleProjectLabel: 'PERMISSION-CHECK',
    visibleMessage: '仅用于检查本地开发环境。没有业务功能、真实数据或云服务连接。',
    appIdVisible: false,
    projectConfigPath: '.local/permission-check/project.config.json',
    projectConfigAppId: 'wx358290e451cb06e7',
    matchesFormalNewAppId: false,
    evidenceMethod: 'read-only-local-config',
  });
  a.equal(record.accountEvidence.formalNewAppId, 'wx2414399d423dfb65');
  a.equal(record.accountEvidence.formalNewAppIdEvidence, 'user-report-and-project-record-not-live-platform-verification');
  a.equal(record.accountEvidence.newAppIdCurrentProjectConfirmedByUser, false);
  a.equal(record.accountEvidence.historicalUserReportCurrentProjectAppIdMatch, true);
  a.ok(record.tasks.find((task) => task.id === 'SP01').executionProgress.completedChecks.some((check) => check.includes('PERMISSION-CHECK') && check.includes('云服务连接')));
  for (const file of [
    'docs/sp01-technical-environment-20261027.md',
    'docs/sp02-platform-evidence-20261027.md',
    'docs/sp04-operations-configuration-20261027.md',
    'docs/v1-executable-development-plan-20261027.md',
  ]) {
    const doc = read(file);
    a.ok(doc.includes('wx358290e451cb06e7'), file);
    a.ok(doc.includes('wx2414399d423dfb65'), file);
    a.ok(doc.includes('不匹配'), file);
  }
});

test('SP04 plan progress records no confirmed service providers as a blocker and keeps product engineering gated', () => {
  const p = load();
  const task = p.tasks.find((entry) => entry.id === 'SP04');
  const doc = read('docs/v1-executable-development-plan-20261027.md');
  a.equal(task.status, 'in-progress');
  a.equal(task.productAcceptancePassed, false);
  a(task.executionProgress.completedChecks.some((check) => check.includes('目前没有已确认愿意接单的家电维修或代买代取服务者')));
  a(task.executionProgress.blockedChecks.some((check) => check.includes('资质审核状态和十个地点的实际覆盖尚未确认')));
  a(doc.includes('目前没有已确认愿意接单的家电维修或代买代取服务者'));
  a.equal(p.firstProductTask, 'SP07');
  a.deepEqual(p.firstProductTaskPrerequisites, ['SP01', 'SP02', 'SP03', 'SP04', 'SP05', 'SP06']);
});
test('SP01 scopes the DevTools project-manager inventory to its visible registered projects', () => {
  const record = load();
  a.deepEqual(record.accountEvidence.devtoolsProjectManagerObservation, {
    observationDate: '2026-10-27',
    visibleRegisteredProjectCount: 1,
    visibleProjects: [{
      name: 'O2O environment verification',
      path: 'E:\\O2O\\.local\\permission-check',
    }],
    targetFormalAppId: 'wx2414399d423dfb65',
    targetProjectListed: false,
    appIdVisibleInProjectManager: false,
    scope: 'wechat-devtools-registered-project-list-only',
    evidenceMethod: 'read-only-visible-ui-observation',
  });
  const doc = read('docs/sp01-technical-environment-20261027.md');
  a.ok(doc.includes('“项目→查看所有项目”列表'));
  a.ok(doc.includes('列表外、其他目录、账号或设备中的工程是否存在仍未核实'));
});
test('SP01 separates the original wizard screenshot from the current live state without inferring CloudBase creation', () => {
  const record = load();
  const observation = record.accountEvidence.devtoolsProjectCreationWizardObservation;
  a.deepEqual(observation, {
    observationDate: '2026-10-27',
    screenshot: 'codex-clipboard-1a1ebb2d-4268-435e-8f86-40237ba5cd56.png',
    projectName: 'miniprogram-1',
    directory: 'C:\\Users\\laureli\\WeChatProjects\\miniprogram-1',
    targetAppId: 'wx2414399d423dfb65',
    targetAppIdSelected: true,
    cloudBackendSelected: true,
    screenshotCloudTermsAgreementChecked: false,
    initializationMode: 'template',
    selectedTemplate: '云开发基础模板（官方）',
    previewEnvironmentLabel: 'cloud1',
    projectCreated: false,
    scope: 'user-provided-screenshot-baseline-with-later-live-ui-observation',
    officialCloudEnablementSource: 'https://developer.cloud.tencent.com/article/1840315?policyId=1003',
    currentPricingSource: 'https://cloud.tencent.com/document/product/876/127357',
    newUserGuideSource: 'https://cloud.tencent.com/document/product/876/56375',
    pricingPolicyObservedAt: '2026-10-27',
    freeTrialPolicy: {
      policyScope: 'console-resource-point-redemption-code-trial',
      priceCny: 0,
      resourcePointsPerMonth: 3000,
      renewalTermMonths: 6,
      autoRenewal: false,
      appliesToWechatExperience: false,
      publishedMiniProgramExpiryDays: 15,
      afterExpiry: 'isolation-then-destruction-if-not-converted-to-paid',
      redemptionCodeEnvironmentsPerCloudBaseAccount: 1,
    },
    newUserGuideTrial: {
      policyScope: 'cloudbase-new-user-onboarding-guide',
      firstUseOffer: 'one-month-free-personal-plan-environment',
      firstUseEligibilityVerified: false,
      currentWizardMappingVerified: false,
    },
    currentCloudBaseAccountFreeTrialEligibilityVerified: false,
    wizardOfferTypeAndPriceVerified: false,
    wizardPostTrialBillingVerified: false,
    latestObservation: {
      observationDate: '2026-10-27',
      method: 'computer-use-read-only-window-capture',
      targetAppId: 'wx2414399d423dfb65',
      targetAppIdVisible: true,
      cloudBackendSelected: true,
      cloudTermsAgreementChecked: true,
      checkboxActorVerified: false,
      projectCreated: false,
      directoryExists: false,
      previewEnvironmentLabel: 'cloud1',
      feesOrExpiryVerified: false,
    },
  });
  a.equal(record.accountEvidence.formalNewEnvironmentId, null);
  a.equal(record.accountEvidence.liveCloudRevalidatedThisDelivery, false);
  const sp01 = record.tasks.find((task) => task.id === 'SP01');
  a.equal(sp01.status, 'in-progress');
  a.equal(sp01.productAcceptancePassed, false);
  a(sp01.executionProgress.blockedChecks.some((check) => check.includes('条款框已勾选') && check.includes('操作人未知')));
  a(sp01.executionProgress.nextAction.includes('不要点击创建'));
  const doc = read('docs/sp01-technical-environment-20261027.md');
  a(doc.includes('用户最初提供的截图显示微信开发者工具“创建小程序”向导'));
  a(doc.includes('条款框未勾选'));
  a(doc.includes('最新只读观察显示条款框已勾选，操作人无法从画面确认'));
  a(doc.includes('项目未创建'));
  a(doc.includes('不能据此认定已创建新环境'));
  a(doc.includes('预览`cloud1`不是环境归属证据'));
  a(doc.includes('提供3000点/月'));
  a(doc.includes('不支持自动续费'));
  a(doc.includes('微信体验版不适用'));
  a(doc.includes('上线后的第15天'));
  a(doc.includes('目标账号当前免费资格'));
  a(doc.includes('免费体验入口和适用规则有区别'));
  a(doc.includes('初次使用可免费体验1个月个人版环境'));
  a(doc.includes('通过一次性兑换码创建一个控制台免费体验环境'));
  a(doc.includes('也不能判断开发者工具向导中的“免费体验一个月”对应哪一种体验'));
  a(doc.includes('首次创建云开发环境前需完成云开发服务开通，包括同意服务条款和完成服务角色权限授权'));
  a(doc.includes('3000点/月'));
});
test('SP01 excludes old cloud1 after the user reports different subjects and keeps target-environment activation deferred', () => {
  const record = load();
  const assessment = record.accountEvidence.oldCloudEnvironmentReuseAssessment;
  a.deepEqual(assessment, {
    resourceAppId: 'wx358290e451cb06e7',
    resourceEnvironmentId: 'cloud1-d1g1mv89t76512a25',
    targetAppId: 'wx2414399d423dfb65',
    status: 'excluded-by-user-reported-different-subject',
    scopeIfEligible: null,
    subjectRelationshipUserReport: {
      resourceSubject: 'personal',
      targetSubjectCategory: 'individual-business-or-company',
      targetLegalFormConfirmed: false,
      sameSubject: false,
      date: '2026-10-27',
      evidenceLevel: 'user-report-not-live-platform-verification',
    },
    officialRequirements: [
      'resource and target mini-programs must have the same subject',
      'resource mini-program must explicitly enable environment sharing and authorize the target mini-program',
      'environment sharing is resource authorization, not cross-account environment migration',
    ],
    sameSubjectVerified: false,
    sameSubjectRequirementSatisfiedBasedOnUserReport: false,
    sharingEnabledOrAuthorized: false,
    sharingConfigurationMutationAuthorized: false,
    accountBindingConstraint: 'one Tencent Cloud account can bind one mini-program; official FAQ says same-subject mini-programs may use environment sharing for CloudBase resources including cloud functions and cloud database',
    sources: [
      'https://cloud.tencent.com/document/faq/876/57380',
      'https://cloud.tencent.com/document/faq/876/18438',
      'https://docs.cloudbase.net/run/develop/access/mini',
    ],
  });
  a.equal(record.accountEvidence.formalNewEnvironmentId, null);
  a.equal(record.accountEvidence.devtoolsProjectCreationWizardObservation.screenshotCloudTermsAgreementChecked, false);
  a.equal(record.accountEvidence.devtoolsProjectCreationWizardObservation.latestObservation.cloudTermsAgreementChecked, true);
  const task = record.tasks.find((entry) => entry.id === 'SP01');
  a.equal(task.status, 'in-progress');
  a.equal(task.productAcceptancePassed, false);
  a(task.executionProgress.nextAction.includes('不要点击创建'));
  a(task.executionProgress.nextAction.includes('旧cloud1不再作为共享候选'));
  a(task.executionProgress.nextAction.includes('目标AppID自己的环境是否已存在'));
  const sp01 = read('docs/sp01-technical-environment-20261027.md');
  const plan = read('docs/v1-executable-development-plan-20261027.md');
  for (const text of [
    '一个腾讯云账号只能绑定一个小程序',
    '同主体的其他小程序/公众号',
    '云开发环境不支持跨账号迁移',
    '用户于2026-10-27明确确认，旧号为个人主体，新号属于个体工商户/公司',
    '不符合官方同主体共享前提',
    '未授权修改环境共享设置',
    '当前建议不要点击“创建”',
  ]) a(sp01.includes(text), text);
  a(plan.includes('旧号为个人主体、新号为个体工商户/公司主体'));
});
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

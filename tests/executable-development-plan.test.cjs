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
 a.equal(p.architecture.frontend,tech.approval.frontend);a.equal(p.architecture.backend,tech.approval.backend);a.equal(p.architecture.managementAccounts,1);a.equal(p.architecture.actualHumanAttribution,false);a.equal(p.architecture.databaseMode,null);a.equal(p.architecture.cloudRuntimeVersion,null);a.equal(p.architecture.sdkVersions,null);a.equal(p.accountEvidence.licenseObtainedRecorded,tech.businessLicenseCompletion.licenseObtained);a.equal(p.accountEvidence.formalNewAppId,JSON.parse(read('docs/v1-development-preflight-20261018.json')).accountProgress.newMiniappAppId);a.equal(p.accountEvidence.liveCloudRevalidatedThisDelivery,true);
 a.equal(p.openItems.length,8);for(const x of p.openItems){a(x.title&&x.kind);a.equal(typeof x.humanDecisionNeeded,'boolean');for(const id of x.tasks)a(byId.has(id));}
 for(const source of p.sources)a(fs.existsSync(path.join(root,source)),source);
 return true;
}
test('executable plan covers all first-release modules and all 60 legacy references with a gated acyclic task graph',()=>a.equal(validate(load()),true));
test('human plan and structured 36 delivery cards agree on work, dependencies and acceptance',()=>{const p=load(),s=read(p.document);for(const t of p.tasks){const start=s.indexOf('### '+t.id+' '+t.title);a(start>=0,t.id);const next=s.indexOf('\n### ',start+1),block=s.slice(start,next<0?s.indexOf('\n## 7.',start):next);a(block.includes(t.deliverable),t.id+' deliverable');for(const v of [...t.dependsOn,...t.steps,...t.acceptance])a(block.includes(v),t.id+' '+v);}for(const [,target]of s.matchAll(/\]\(([^)]+)\)/g))if(!/^https?:/.test(target))a(fs.existsSync(path.resolve(path.dirname(path.join(root,p.document)),target.split('#')[0])),target);a(s.indexOf('## 1. 验证方案')<s.indexOf('## 6. 36张'));});
test('repository inventory is an as-of source snapshot and does not prohibit creating a future product',()=>{const p=load();a.match(p.sourceCommit,/^[a-f0-9]{40}$/);const names=cp.execFileSync('git',['ls-tree','--name-only',p.sourceCommit],{cwd:root,encoding:'utf8'}).split(/\r?\n/);for(const name of ['miniprogram','cloudfunctions','packages','package.json','project.config.json'])a(!names.includes(name));a.equal(p.inventory.formalProjectPresent,false);a.equal(p.inventory.localVersionsAreCloudVersions,false);});
test('plan records the user-confirmed target CloudBase environment and appid-scoped API confirmation',()=>{const p=load(),preflight=JSON.parse(read('docs/v1-development-preflight-20261018.json')),progress=preflight.accountProgress,sp01=p.tasks.find(t=>t.id==='SP01'); a.equal(progress.newMiniappRegistered,true);a.equal(p.accountEvidence.formalNewAppId,progress.newMiniappAppId);a.equal(p.accountEvidence.formalNewAppIdEvidence,progress.evidenceLevel);a.equal(p.accountEvidence.formalNewAppIdSource,progress.sourceDocument);a.equal(p.accountEvidence.newSubjectCloudDevelopmentOpeningStatus,'user-reported-free-experience-opened-screenshot-shows-cloud1');a.equal(p.accountEvidence.formalNewEnvironmentId,'cloud1-d2gjahlq39bf141c7');a.equal(p.accountEvidence.formalNewEnvironmentStatus,'screenshot-and-cli-cloud-env-list-confirmed-associated-runtime-not-verified');a.equal(p.accountEvidence.formalNewEnvironmentIdEvidenceLevel,'user-screenshot-and-cli-environment-list-visible-appid-and-envid-not-runtime-verified');a.equal(preflight.integrationProgressUpdate.newSubjectCloudDevelopment.openingStatus,'not-opened-user-reported');a.equal(sp01.status,'in-progress');a.equal(sp01.productAcceptancePassed,false);a.equal(sp01.executionProgress.blockedChecks.length,5);a(sp01.executionProgress.blockedChecks.some((check)=>check.includes('用户已确认Node.js 20.19，但云函数尚未创建或运行')));a(sp01.executionProgress.blockedChecks.some((check)=>check.includes('用户已提供三台手机、微信版本、Chrome及家中/公共WiFi场景')));a(p.sources.includes('docs/miniapp-filing-progress-20261018.md'));});
test('SP01 records CloudBase screenshots separately from the user-confirmed target-project association',()=>{
  const p=load(),scaffold=p.inventory.userCreatedQuickStartScaffold,current=p.accountEvidence.latestUserCreatedProjectAndCloudConsoleObservation,task=p.tasks.find(x=>x.id==='SP01'),doc=read('docs/sp01-technical-environment-20261027.md'),plan=read('docs/v1-executable-development-plan-20261027.md'),settings=current.latestSettingsScreenshot,fees=current.latestFeeManagementScreenshot;
  a.equal(scaffold.present,true);a.equal(scaffold.createdByUser,true);a.equal(scaffold.appId,p.accountEvidence.formalNewAppId);a.equal(scaffold.matchesFormalTargetAppId,true);a.equal(scaffold.containsProductImplementation,false);a.equal(scaffold.cloudEnvironmentIdConfigured,true);a.equal(scaffold.appJsEnvironmentValue,'cloud1-d2gjahlq39bf141c7');a.equal(scaffold.envListIsEmpty,true);a.equal(current.configuredAppIdMatchesFormalTarget,true);a.equal(current.scaffoldOnly,true);a.equal(current.environmentIdConfigured,true);a.equal(current.confirmedCloudEnvironmentId,'cloud1-d2gjahlq39bf141c7');a.equal(current.userConfirmedCloudEnvironmentCreatedFromTargetProject,true);a.equal(current.cloudEnvironmentBindingApiVerified,true);a.equal(current.cloudEnvironmentBindingApiEvidenceDate,'2026-10-28');a.equal(current.cloudEnvironmentBindingApiEvidenceMethod,'target-appid-scoped-cloud-env-list');
  a.equal(current.cloudConsoleScreenshot.visibleEnvironmentLabel,'cloud1');a.equal(current.cloudConsoleScreenshot.visiblePlanLabel,'微信体验版');a.equal(current.cloudConsoleScreenshot.visibleDatabaseState,'not-shown-in-this-screenshot');a.equal(current.cloudConsoleScreenshot.appIdVisible,false);a.equal(current.cloudConsoleScreenshot.exactEnvironmentIdVisible,false);a.equal(current.cloudConsoleScreenshot.expiryVisible,false);a.equal(current.cloudConsoleScreenshot.billingOrAutoRenewalVisible,false);a.equal(current.cloudConsoleScreenshot.userReportsNoPayment,true);a.equal(current.cloudConsoleScreenshot.provesBindingToFormalTargetAppId,false);
  a.equal(settings.visibleEnvironmentLabel,'cloud1');a.equal(settings.visibleEnvironmentId,'cloud1-d2gjahlq39bf141c7');a.equal(settings.visiblePlanLabel,'微信体验版');a.equal(settings.visibleSettingsTab,'权限设置');a.equal(settings.appIdVisible,false);a.equal(settings.expiryVisible,false);a.equal(settings.billingOrAutoRenewalVisible,false);a.equal(settings.provesBindingToFormalTargetAppId,false);
  a.equal(fees.visibleEnvironmentLabel,'cloud1');a.equal(fees.visibleEnvironmentId,null);a.equal(fees.visiblePlanLabel,'微信体验版');a.equal(fees.visibleSection,'费用管理');a.equal(fees.visibleTab,'套餐管理');a.equal(fees.displayedMonthlyResourcePoints,40000);a.equal(fees.displayedMonthlyPriceRmb,19.9);a.equal(fees.purchaseButtonVisible,true);a.equal(fees.payAsYouGoEnabled,false);a.equal(fees.autoRenewalEnabled,false);a.equal(fees.expiryVisible,false);a.equal(fees.appIdVisible,false);a.equal(fees.provesPaidSubscription,false);a.equal(fees.provesBindingToFormalTargetAppId,false);
  a.equal(current.currentRecommendation,'use-free-experience-for-development-and-testing; do-not-buy-paid-plan-until-capability-or-quota-need-is-evidenced');a.equal(task.status,'in-progress');a.equal(task.productAcceptancePassed,false);a(task.executionProgress.nextAction.includes('费用核查按用户要求略过'));a(task.executionProgress.nextAction.includes('cloud_env_list'));a(!task.executionProgress.nextAction.includes('CONNECT_ERROR'));a(!task.executionProgress.nextAction.includes('DescribeBillingInfo'));
  a(doc.includes('cloud1-d2gjahlq39bf141c7'));a(doc.includes('用户之后明确确认该`cloud1`是在目标AppID项目中创建'));a(doc.includes('到期日'));a(doc.includes('购买按钮旁的价格不是已扣款证据'));a(doc.includes('按量付费与自动续费均关闭'));a(doc.includes('新建环境没有集合和调用数据是正常空态'));a(plan.includes('不能据截图的配额、价格按钮或套餐标签推断实际扣款和到期'));a(doc.includes('用户表示若上线后出现实际付费提示，将自行办理'));a(plan.includes('用户手动创建了'));a(plan.includes('套餐/账单截图显示“微信体验版”'));
});
test('SP01 distinguishes mini-program trial testing from the free CloudBase environment expiry and paid conversion rule',()=>{
  const p=load(),r=p.accountEvidence.miniProgramExperienceAndCloudBasePlanDistinction;
  const doc=read('docs/sp01-technical-environment-20261027.md'),plan=read('docs/v1-executable-development-plan-20261027.md');
  a.deepEqual(r.userReportedExperienceVersionUnderstanding,{purpose:'internal-core-feature-validation-before-release',reportedExperienceMemberLimit:15,reportedWechatPaymentAvailable:false,evidenceLevel:'user-reported-research-not-verified-for-target-appid'});
  a.equal(r.officialCloudBaseEvidence.source,'https://cloud.tencent.com/document/product/876/127357');
  a.equal(r.officialCloudBaseEvidence.sourceUpdatedAt,'2026-10-26');
  a.equal(r.officialCloudBaseEvidence.freeEnvironmentExpiryAfterMiniProgramReleaseDays,15);
  a.equal(r.officialCloudBaseEvidence.expiryAnchor,'mini-program-publication');
  a.equal(r.officialCloudBaseEvidence.afterExpiry,'service-isolation-then-destruction-if-not-converted-to-paid');
  a.equal(r.officialCloudBaseEvidence.conversionToPaidNeededToRetainFreeEnvironment,true);
  a.equal(r.officialCloudBaseEvidence.sixMonthTrialRenewalAppliesToWechatExperienceLabel,false);
  a.equal(r.officialCloudBaseEvidence.personalPlanPublicMonthlyPriceRmb,19.9);
  a.equal(r.officialCloudBaseEvidence.personalPlanPriceIsPromotional,true);
  a.equal(r.officialCloudBaseEvidence.priceRequiresPurchase,true);
  a.equal(r.currentTargetEnvironment.environmentBindingToTargetAppIdVerified,true);a.equal(r.currentTargetEnvironment.environmentBindingToTargetAppIdApiVerified,true);
  a.equal(r.currentTargetEnvironment.userConfirmedCloudEnvironmentCreatedFromTargetProject,true);
  a.equal(r.currentTargetEnvironment.environmentIdFromUserEvidence,'cloud1-d2gjahlq39bf141c7');
  a.equal(r.currentTargetEnvironment.freeEnvironmentStatusVerified,false);
  a.equal(r.currentTargetEnvironment.exactPlanAndExpiryVerified,false);
  a.equal(r.currentTargetEnvironment.paidOrderVerified,false);
  a(r.interpretation.includes('distinct'));
  a(r.interpretation.includes('If the bound environment is a free CloudBase environment'));
  a(r.interpretation.includes('Screenshot and CLI environment-list results confirm app/environment association'));
  a(r.interpretation.includes('runtime access'));
  a(r.interpretation.includes('free-environment status, and exact expiry remain unverified'));
  a(doc.includes('小程序体验版本与CloudBase环境套餐分开判断'));
  a(doc.includes('用户报告'));
  a(doc.includes('发布后第15天'));
  a(doc.includes('若绑定环境确属免费CloudBase环境'));
  a(doc.includes('个人版当前公开价为¥19.9/月且属限时优惠'));
  a(doc.includes('环境类型和到期日尚未通过接口核验'));
  a(plan.includes('与截图中的CloudBase套餐名“微信体验版”是两个概念'));
  a(plan.includes('最新详情截图同屏显示目标AppID `wx2414399d423dfb65` 与环境ID `cloud1-d2gjahlq39bf141c7`'));
  a(plan.includes('应在发布准备中安排转付费以避免到期停服'));
});
test('SP01 execution record separates historical CLI failures from current read-only CloudBase results',()=>{
  const p=load(),doc=read('docs/sp01-technical-environment-20261027.md'),planDoc=read('docs/v1-executable-development-plan-20261027.md');
  for(const text of ['Node.js 24.18.0','npm 11.16.0','login=true','code 10','system error','wx2414399d423dfb65','Node.js 24.11','Nodejs24.11','未取得环境清单','cloud1-d1g1mv89t76512a25','较早截图本身未显示AppID','没有创建/修改云资源','回退','CLI授权成功','CONNECT_ERROR','现有截图和只读CLI结果共同确认AppID/环境关联','用户确认重新打开微信开发者工具','安装诊断返回`compatible=true`','项目本地AppID已核验','本轮按用户要求跳过套餐、账单和到期核查'])a(doc.includes(text),text);
  a(planDoc.includes('之后有一次命令因Shell解析到项目内辅助CLI而返回`CONNECT_ERROR`'));
  a(planDoc.includes('改用安装目录`E:\\微信web开发者工具\\wechatide.cmd`后，状态查询成功'));
  a(planDoc.includes('云环境列表查询已恢复'));
  a(!planDoc.includes('本轮新AppID环境列表查询失败'));
  a(!planDoc.includes('云环境清单查询受阻'));
  a(!planDoc.includes('当前开发者工具“查看所有项目”列表只显示'));
  for(const url of ['https://docs.cloudbase.net/en/cloud-function/runtime-support','https://docs.cloudbase.net/cli-v1/functions/configs','https://docs.cloudbase.net/database/transaction','https://docs.cloudbase.net/storage/data-permission'])a(doc.includes(url),url);
  a.equal(p.architecture.cloudRuntimeVersion,null);a.equal(p.architecture.databaseMode,null);a.equal(p.architecture.sdkVersions,null);a.equal(p.accountEvidence.liveCloudRevalidatedThisDelivery,true);
  a.equal(p.accountEvidence.previousReadOnlyQueryAttempt.clientName,'Codex');a.equal(p.accountEvidence.previousReadOnlyQueryAttempt.cliAuthorization,'already-trusted');a.equal(p.accountEvidence.previousReadOnlyQueryAttempt.queryStatus,'connect-error-before-cloud-response');a.equal(p.accountEvidence.previousReadOnlyQueryAttempt.environmentListRetrieved,false);a.equal(p.accountEvidence.previousReadOnlyQueryAttempt.devtoolsRestartConfirmedByUser,true);a.deepEqual(p.accountEvidence.previousReadOnlyQueryAttempt.processObservationAfterRestart,{processId:51712,startedAtLocal:'2026-10-27 20:06:15'});a.equal(p.accountEvidence.previousReadOnlyQueryAttempt.postRestartAuthorization.authorized,true);a.equal(p.accountEvidence.previousReadOnlyQueryAttempt.postRestartAuthorization.alreadyTrusted,true);
  a.equal(p.inventory.wechatDevToolsInstallationDiagnostic.compatible,true);a.equal(p.inventory.wechatDevToolsInstallationDiagnostic.version,'2.02.2608080');a.equal(p.inventory.wechatDevToolsInstallationDiagnostic.provesBridgeConnection,false);
  a(p.tasks.find(t=>t.id==='SP01').executionProgress.blockedChecks.some((check)=>check.includes('用户已确认Node.js 20.19，但云函数尚未创建或运行')));
  a.equal(p.accountEvidence.oldCloudEnvironmentReadOnlyEvidence.appId,'wx358290e451cb06e7');a.equal(p.accountEvidence.oldCloudEnvironmentReadOnlyEvidence.environmentId,'cloud1-d1g1mv89t76512a25');a.equal(p.accountEvidence.oldCloudEnvironmentReadOnlyEvidence.scope,'development-and-controlled-testing-only');a.equal(p.accountEvidence.oldCloudEnvironmentReadOnlyEvidence.screenshotAppIdVisible,false);
});

test('SP01 labels the missing DevTools project-list entry as a historical observation', () => {
  const doc = read('docs/sp01-technical-environment-20261027.md');
  a(doc.includes('2026-10-27那次列表快照只显示1个已登记工程`O2O environment verification`'));
  a(doc.includes('目标新AppID对应工程在该次快照未列出'));
  a(doc.includes('2026-10-27那次列表快照只显示1个已登记工程'));
  a(!doc.includes('当前只显示`O2O environment verification`'));
  a(doc.includes('本次直接CLI的`project_list`已列出目标'));
});

test('SP01 keeps the post-restart CLI status error separate from login state', () => {
  const record = load();
  const doc = read('docs/sp01-technical-environment-20261027.md');
  a.deepEqual(record.accountEvidence.previousReadOnlyQueryAttempt.postRestartStatusCheck, {
    tool: 'check_wechatide_status',
    errorType: 'CONNECT_ERROR',
    loginExpired: null,
    versionRelation: null,
  });
  a(doc.includes('初始新主体云环境查询（历史）'));
  a(doc.includes('这些是历史命令入口结果'));
});

test('SP01 preserves the historical CLI authorization, listener and project-wrapper failures', () => {
  const record = load();
  const attempt = record.accountEvidence.previousReadOnlyQueryAttempt;
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
  a.ok(doc.includes('历史连接记录：用户确认重新打开微信开发者工具后，本机端口PID'));
  a.ok(doc.includes('此前Shell命令解析到项目内辅助入口'));
  a.ok(doc.includes('改用真实安装目录入口'));
});

test('SP01 resolves the CLI wrapper path and records the read-only target environment checks', () => {
  const record = load();
  a.deepEqual(record.accountEvidence.latestBridgeRecheck, {
    date: '2026-10-28',
    evidenceMethod: 'read-only-process-inventory-and-direct-installed-CLI',
    processId: 51712,
    activeWindowTitle: '湘邻湘友',
    executablePath: 'E:\\微信web开发者工具\\微信开发者工具.exe',
    localProjectPath: 'E:\\O2O\\miniprogram',
    localProjectAppId: 'wx2414399d423dfb65',
    activeProjectPathVerified: false,
    registeredTargetProjectVerified: true,
    installationDiagnostic: { compatible: true, version: '2.02.2608080' },
    cliAuthorization: { authorized: true, alreadyTrusted: true, cliTokenRequired: false },
    pathResolvedCli: { path: 'E:\\O2O\\.local\\tools\\wechat-devtools\\wechatide.cmd', statusCheckError: 'CONNECT_ERROR', environmentListError: 'CONNECT_ERROR' },
    installedCliPath: 'E:\\微信web开发者工具\\wechatide.cmd',
    statusCheck: { ok: true, loginExpired: false, versionRelation: 'equal' },
    environmentList: { ok: true, appId: 'wx2414399d423dfb65', environmentIds: ['cloud1-d2gjahlq39bf141c7'] },
    projectList: { ok: true, targetProjectPath: 'E:\\O2O\\miniprogram', targetProjectAppId: 'wx2414399d423dfb65', activeProjectPathVerified: false },
    initialResourceQueryFailure: {
      tools: ['cloud_fn_list', 'cloud_db_read_struct'],
      errorType: 'INPUT_ERROR',
      reason: 'missing_client',
      cloudRequestIssued: false,
      recovery: 'CLI help confirmed the required client flag; retried with -c Codex',
    },
    functionList: {
      ok: true,
      tool: 'cloud_fn_list',
      clientName: 'Codex',
      queryAppId: 'wx2414399d423dfb65',
      queryEnvironmentId: 'cloud1-d2gjahlq39bf141c7',
      responseAppId: 'wx2414399d423dfb65',
      total: 0,
    },
    databaseCollections: {
      ok: true,
      tool: 'cloud_db_read_struct',
      clientName: 'Codex',
      action: 'listCollections',
      queryAppId: 'wx2414399d423dfb65',
      queryEnvironmentId: 'cloud1-d2gjahlq39bf141c7',
      requestId: '273b6a14-fb31-4dba-91ab-69418f65f135',
      total: 0,
    },
    environmentApiVerified: true,
    runtimeVerified: false,
  });
  const doc = read('docs/sp01-technical-environment-20261027.md');
  a(doc.includes('主窗口标题为“湘邻湘友”'));
  a(doc.includes('开发者工具安装诊断返回`compatible=true`、版本`2.02.2608080`'));
  a(doc.includes('此前Shell命令解析到项目内辅助入口'));
  a(doc.includes('`cloud_env_list`返回环境ID `cloud1-d2gjahlq39bf141c7`'));
  a(doc.includes('云函数响应回显目标AppID且总数为0'));
  a(doc.includes('数据库响应返回空集合列表'));
  a(doc.includes('`-c Codex --appid wx2414399d423dfb65 --env cloud1-d2gjahlq39bf141c7`'));
  a(doc.includes('这两个响应没有回显EnvID，EnvID作用域由命令参数记录'));
  a(doc.includes('本轮云资源查询首次因漏传CLI必需参数`-c Codex`返回输入校验错误'));
  a(doc.includes('活动窗口实际加载路径仍未确认'));
  a(doc.includes('随后通过目标AppID执行的`cloud_env_list`也返回同一EnvID'));
  a(!doc.includes('该项目与环境的创建关系仍未通过开发者工具接口核验'));
  a(!doc.includes('平台API和运行时仍未核验；`envList`仍为空'));
  a(!doc.includes('当前阻塞是历史CLI连接层报错'));
  a(doc.includes('当前查询通路已恢复'));
  a(doc.includes('当前阻塞是云函数尚未创建或运行、数据库事务及私密文件权限仍未实测'));
  const targetEnvironment = record.accountEvidence.miniProgramExperienceAndCloudBasePlanDistinction.currentTargetEnvironment;
  a.equal(targetEnvironment.environmentBindingToTargetAppIdVerified, true);
  a.equal(targetEnvironment.environmentBindingToTargetAppIdApiVerified, true);
  a.match(record.accountEvidence.miniProgramExperienceAndCloudBasePlanDistinction.interpretation, /Screenshot and CLI environment-list results confirm app\/environment association; runtime access, free-environment status, and exact expiry remain unverified\./);
  const latestChecks = record.tasks.find((task) => task.id === 'SP01').executionProgress.completedChecks;
  a(latestChecks.some((check) => check.includes('较早概览、设置和费用截图未证明目标环境归属')));
  a(!latestChecks.some((check) => check.includes('当前截图仍未证明目标环境归属')));
  a(latestChecks.some((check) => check.includes('直接使用微信开发者工具安装目录')));
  a(latestChecks.some((check) => check.includes('cloud_fn_list和cloud_db_read_struct命令显式传入目标AppID')));
  a(record.tasks.find((task) => task.id === 'SP01').executionProgress.blockedChecks.some((check) => check.includes('用户已确认Node.js 20.19，但云函数尚未创建或运行')));
});

test('SP01 records read-only CLI capability limits and detectable equipment without inventing runtime or device verification', () => {
  const record = load();
  const audit = record.accountEvidence.technicalEnvironmentAudit;
  const doc = read('docs/sp01-technical-environment-20261027.md');
  const planDoc = read('docs/v1-executable-development-plan-20261027.md');

  a.equal(audit.cliSkillVersion, '0.3.11');
  a.deepEqual(audit.databaseStructureReadActions, ['listCollections', 'describeCollection', 'checkCollection', 'listIndexes', 'checkIndex']);
  a.equal(audit.cliExposesEnvironmentRuntimeConfigurationQuery, false);
  a.equal(audit.cliExposesDatabaseModeQuery, false);
  a.equal(audit.cliExposesStoragePermissionConfigurationQuery, false);
  a.deepEqual(audit.storageReadActions, ['list', 'info', 'url', 'read']);
  a.equal(audit.storageContentReadThisTurn, false);
  a.deepEqual(audit.storageRootListAttempt, {
    date: '2026-10-28',
    targetAppId: 'wx2414399d423dfb65',
    targetEnvironmentId: 'cloud1-d2gjahlq39bf141c7',
    action: 'list',
    cloudPath: '',
    result: 'local-validation-rejected-minimum-length-1',
    cloudRequestSent: false,
    rootPathSemanticsDocumentedForThisCli: false,
    fileContentsReadOrDownloaded: false,
  });
  a.equal(audit.androidDebugBridgeFound, false);
  a.equal(audit.physicalDeviceInventoryVerified, false);
  a.equal(audit.deviceInventoryReportedByUser, true);
  a.deepEqual(audit.userReportedTestDevices, [
    { brand: 'OPPO', model: 'Find X9', operatingSystem: 'ColorOS 17.0', wechatVersion: '8.0.79' },
    { brand: 'Huawei', model: 'nova 11 SE', operatingSystem: 'HarmonyOS 4.2.0', wechatVersion: '8.0.79' },
    { brand: 'Apple', model: 'iPhone XR', operatingSystem: 'iOS 16', wechatVersion: '8.0.79' },
  ]);
  a.equal(audit.androidModelConfirmed, true);
  a.equal(audit.iphoneModelConfirmed, true);
  a.equal(audit.publicProjectConfigBaseLibraryVersion, '2.20.1');
  a.equal(audit.privateProjectConfigBaseLibraryVersion, '3.17.5');
  a.equal(audit.devtoolsSimulatorBaseLibraryVersion, '3.17.5');
  a.equal(audit.devtoolsSimulatorBaseLibraryVersionConfirmed, true);
  a.equal(audit.physicalDeviceBaseLibraryVersionConfirmed, false);
  a.deepEqual(audit.devtoolsSimulatorRuntimeObservation, {
    projectPath: 'E:\\O2O\\miniprogram',
    platform: 'devtools',
    model: 'iPhone 12/13 (Pro)',
    system: 'iOS 10.0.1',
    version: '8.0.5',
    SDKVersion: '3.17.5',
    currentPageRoute: '/pages/index/index',
    currentPageTitle: '基础能力',
  });
  a.equal(audit.adminBrowserSelected, true);
  a.equal(audit.selectedAdminBrowser, 'Google Chrome');
  a.equal(audit.adminBrowserTested, false);
  a.equal(audit.normalNetworkScenario, '家中 WiFi 5G（用户描述）');
  a.equal(audit.weakNetworkScenario, '公共免费 WiFi（用户指定为较弱场景）');
  a.equal(audit.networkMetricsMeasured, false);
  a.equal(audit.cloudCapabilityTestPlan.targetAppId, 'wx2414399d423dfb65');
  a.equal(audit.cloudCapabilityTestPlan.targetEnvironmentId, 'cloud1-d2gjahlq39bf141c7');
  a.equal(audit.cloudCapabilityTestPlan.currentCloudFunctionCount, 0);
  a.equal(audit.cloudCapabilityTestPlan.currentDatabaseCollectionCount, 0);
  a.equal(audit.cloudCapabilityTestPlan.separateTestEnvironmentVerified, false);
  a.equal(audit.cloudCapabilityTestPlan.testWriteAuthorization, 'read-only-only');
  a.equal(audit.cloudCapabilityTestPlan.realPersonalDataAllowed, false);
  a.equal(audit.cloudCapabilityTestPlan.officialSourceCheckDate, '2026-10-28');
  a.deepEqual(record.tasks.find((task) => task.id === 'SP01').executionProgress.latestReadOnlyCloudRecheck, {
    date: '2026-10-28',
    targetAppId: 'wx2414399d423dfb65',
    targetEnvironmentId: 'cloud1-d2gjahlq39bf141c7',
    environmentList: ['cloud1-d2gjahlq39bf141c7'],
    cloudFunctionCount: 0,
    databaseAction: 'listCollections',
    databaseCollectionCount: 0,
    databaseRequestId: '9999efac-d8b8-4c0c-997a-91674556d58e',
    initialDatabaseInputError: 'missing-required-action; rejected-locally-before-cloud-request',
    recovery: 'read-tool-help; retry-with-listCollections',
    cloudWriteOrDeploymentPerformed: false,
  });
  a.deepEqual(audit.userScreenshotCloudBaseObservation, {
    date: '2026-10-28',
    targetEnvironmentName: 'cloud1',
    targetEnvironmentId: 'cloud1-d2gjahlq39bf141c7',
    cloudFunctionDialog: {
      functionCountDisplayed: 0,
      selectedRuntime: 'Node.js 20.19',
      runtimeOptions: [
        { version: 'Node.js 24.11', label: 'public-beta' },
        { version: 'Node.js 22.21', label: 'public-beta' },
        { version: 'Node.js 20.19', label: 'not-labeled-beta' },
        { version: 'Node.js 18.15', label: 'not-labeled-beta' },
        { version: 'Node.js 16.13', label: 'not-labeled-beta' },
      ],
      screenshotShowsFunctionCreationOrDeployment: false,
    },
    runtimeSourceComparison: {
      cliFunctionConfigDocument: 'https://docs.cloudbase.net/cli-v1/functions/configs',
      cliFunctionConfigCallsNodejs20_19RecommendedAndDefault: true,
      runtimeSupportDocument: 'https://docs.cloudbase.net/cloud-function/runtime-support',
      runtimeSupportCallsNodejs24_11ActiveLtsAndRecommended: true,
      documentationRecommendationConflict: true,
      projectRecommendation: 'Node.js 20.19',
      requiresUserConfirmation: false,
      userConfirmedRuntime: 'Node.js 20.19',
      runtimeConfirmationSource: 'user-reply-2026-10-28',
      runtimeCreatedOrExecuted: false,
    },
    database: {
      page: 'database-restore',
      automaticBackupNoticeDisplayed: true,
      restorePointCountDisplayed: 0,
      modeOrEngineDisplayed: false,
      modeInferenceFromRestorePage: 'consistent-with-traditional-mode-but-not-confirmed',
      inferenceSource: 'https://docs.cloudbase.net/quick-start/classic-overview',
      userReportedMode: '文档型数据库',
      userReportSource: 'user-reply-2026-10-28',
      userReportedModeApiVerified: false,
    },
    storage: {
      rootFileCountDisplayed: 0,
      selectedPermission: '仅创建者可读写',
      miniProgramClientRequestsOnlyAreGovernedByThisSetting: true,
      settingChanged: false,
    },
    developerTools: {
      environmentMenuLabel: '当前环境：(无)',
      environmentSubmenuLabel: '(空)',
      newNodeJsCloudFunctionMenuDisplayed: true,
      menuTargetsCloudfunctionsFolderDeployment: true,
      appJsCloudInitEnvironment: 'cloud1-d2gjahlq39bf141c7',
      projectEnvListPath: 'miniprogram/miniprogram/envList.js',
      projectEnvListLength: 0,
      projectCodeImportsEnvList: false,
      folderAssignmentResolved: false,
      interpretationSource: 'https://github.com/wechat-miniprogram/minigame-demo/blob/master/CLOUD_README.md',
    },
  });
  a.deepEqual(audit.userConfirmedRuntimeAndDatabase, {
    runtimeChoice: 'Node.js 20.19',
    runtimeSource: 'user-reply-2026-10-28',
    runtimeCreatedOrExecuted: false,
    databaseMode: '文档型数据库',
    databaseModeSource: 'user-reply-2026-10-28',
    databaseModeApiVerified: false,
  });
  a.deepEqual(audit.cloudCapabilityTestPlan.cases.map((testCase) => testCase.id), [
    'ENV-RUNTIME-01', 'ENV-DB-TX-01', 'ENV-STORE-01', 'ENV-CLEANUP-01',
  ]);
  a.equal(audit.cloudCapabilityTestPlan.cases.find((testCase) => testCase.id === 'ENV-RUNTIME-01').status, 'user-confirmed-nodejs-20-19-not-created-or-executed');
  a(audit.cloudCapabilityTestPlan.cases.filter((testCase) => testCase.operation !== 'read-only')
    .every((testCase) => testCase.status === 'not-executed-no-write-authorization'));
  a(audit.cloudCapabilityTestPlan.cases.every((testCase) => testCase.input && testCase.expected));
  a.deepEqual(audit.installedDesktopBrowsers, [
    { name: 'Google Chrome', version: '156.0.8078.47' },
    { name: 'Microsoft Edge', version: '156.0.4314.50' },
    { name: 'Mozilla Firefox (x64 zh-CN)', version: '153.0' },
  ]);
  a.equal(audit.adminBrowserSelected, true);
  a(doc.includes('CLI帮助没有提供环境级运行时、数据库模式或存储权限配置的只读查询'));
  a(doc.includes('未调用存储文件列表、临时链接或内容读取'));
  a(doc.includes('未发现ADB，也未在常见Android SDK目录找到adb.exe'));
  a(doc.includes('这不证明用户没有测试手机'));
  a(doc.includes('本机注册表检测到Chrome'));
  a(doc.includes('用户选择Google Chrome执行后台验收'));
  a(doc.includes('用户于2026-10-28提供三台测试设备信息'));
  a(doc.includes('用户选择Google Chrome执行后台验收'));
  a(doc.includes('公开配置`miniprogram/project.config.json`声明基础库`2.20.1`'));
  a(doc.includes('私有配置`miniprogram/project.private.config.json`声明`3.17.5`'));
  a(doc.includes('CLI对目标工程执行只读`automation_runtime_info --action systemInfo`报告DevTools模拟器`SDKVersion=3.17.5`'));
  a(doc.includes('三台真机当前实际基础库仍未实测'));
  a(planDoc.includes('公开项目配置声明基础库`2.20.1`，私有配置声明`3.17.5`'));
  a(doc.includes('目标环境受控验证方案（尚未执行）'));
  a(doc.includes('ENV-DB-TX-01'));
  a(doc.includes('ENV-STORE-01'));
  a(doc.includes('单事务最多100个操作、最长30秒'));
  a(doc.includes('并应避免事务期间DDL及外部调用'));
  a(doc.includes('第一次输入错误未发出云请求'));
  a(doc.includes('没有用猜测路径重试'));
  a(doc.includes('目标环境文件清单和实际权限仍未核实'));
  a(planDoc.includes('补充只读云资源复核'));
  a(planDoc.includes('用户截图已记录运行时选项，且用户已确认选择Node.js 20.19'));
  a(doc.includes('清理也是云端变更'));
  a(doc.includes('运行时下拉当前选择Node.js 20.19'));
  a(doc.includes('Node.js 24.11和22.21标注“公测中”'));
  a(doc.includes('数据库截图显示“数据库回档”及暂无数据'));
  a(doc.includes('没有显示数据库模式或引擎'));
  a(doc.includes('CloudBase[云函数配置文档](https://docs.cloudbase.net/cli-v1/functions/configs)'));
  a(doc.includes('CloudBase[运行环境支持表](https://docs.cloudbase.net/cloud-function/runtime-support)'));
  a(doc.includes('运行时选择参考'));
  a(doc.includes('用户已明确确认首版采用Node.js 20.19'));
  a(doc.includes('云函数尚未创建或运行'));
  a(doc.includes('PG模式不提供文档型数据库级别的备份与回档'));
  a(doc.includes('此前从回档页作出的模式推断因此不再作为现状判断'));
  a(doc.includes('用户随后查看“数据库→数据库设置”并报告当前为“文档型数据库”'));
  a(doc.includes('该模式来自用户查看反馈，尚未由只读API复核'));
  a(doc.includes('存储管理根目录显示暂无文件'));
  a(doc.includes('当前选中“仅创建者可读写”'));
  a(doc.includes('开发者工具截图中打开的是项目根目录`cloudfunctions`文件夹的右键菜单'));
  a(doc.includes('本地`envList.js`导出空数组'));
  a(doc.includes('`cloudfunctions`根目录的“当前环境”菜单决定云函数上传部署目标'));
  a(doc.includes('`app.js`中的`wx.cloud.init({ env })`指定小程序运行时调用的环境'));
  a(doc.includes('当前模板业务代码没有引用该文件'));
  a(doc.includes('https://github.com/wechat-miniprogram/minigame-demo/blob/master/CLOUD_README.md'));
  a(doc.includes('https://docs.cloudbase.net/recipes/add-cloud-function-wechat-miniprogram'));
  a(planDoc.includes('CLI技能版本为'));
  a(planDoc.includes('PowerShell清点未发现ADB'));
  a(planDoc.includes('用户已提供OPPO Find X9'));
  const sp01 = record.tasks.find((task) => task.id === 'SP01');
  a.equal(sp01.status, 'in-progress');
  a.equal(sp01.productAcceptancePassed, false);
  a(sp01.executionProgress.blockedChecks.some((check) => check.includes('用户已提供三台手机、微信版本、Chrome及家中/公共WiFi场景') && check.includes('网络性能仍未实测')));
  a(sp01.executionProgress.blockedChecks.some((check) => check.includes('用户已确认Node.js 20.19') && check.includes('云函数尚未创建或运行') && check.includes('用户查看后报告数据库为文档型数据库')));
  a(sp01.executionProgress.nextAction.includes('用户已确认Node.js 20.19，报告数据库模式为文档型'));
  a(sp01.executionProgress.nextAction.includes('用户复查cloudfunctions根目录环境菜单仍为空'));
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
  a(task.executionProgress.completedChecks.some((check) => check.includes('CloudBase截图') && check.includes('当前环境为无') && check.includes('未改云端设置')));
  a(task.executionProgress.blockedChecks.some((check) => check.includes('资质审核状态和十个地点的实际覆盖尚未确认')));
  a(task.executionProgress.blockedChecks.some((check) => check.includes('cloudfunctions文件夹部署环境菜单仍为空') && check.includes('数据库模式尚未API复核')));
  a(doc.includes('目前没有已确认愿意接单的家电维修或代买代取服务者'));
  a(doc.includes('`cloudfunctions`文件夹部署菜单显示当前环境“(无)”且子菜单为空'));
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
test('SP01 separates the historical creation wizard from current environment-list confirmation and unverified runtime access', () => {
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
    currentPricingSource: 'https://cloud.tencent.com/document/product/876/75213',
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
  a.equal(record.accountEvidence.formalNewEnvironmentId, 'cloud1-d2gjahlq39bf141c7');
  a.equal(record.accountEvidence.formalNewEnvironmentStatus, 'screenshot-and-cli-cloud-env-list-confirmed-associated-runtime-not-verified');
  a.equal(record.accountEvidence.liveCloudRevalidatedThisDelivery, true);
  const sp01 = record.tasks.find((task) => task.id === 'SP01');
  a.equal(sp01.status, 'in-progress');
  a.equal(sp01.productAcceptancePassed, false);
  a(sp01.executionProgress.blockedChecks.some((check) => check.includes('用户已确认Node.js 20.19，但云函数尚未创建或运行')));
  a(!sp01.executionProgress.blockedChecks.some((check) => check.includes('CloudBase API关联尚未核验')));
  a(sp01.executionProgress.nextAction.includes('后续云端写入/部署测试须先取得具体授权'));
  a(sp01.executionProgress.nextAction.includes('费用核查按用户要求略过'));
  const doc = read('docs/sp01-technical-environment-20261027.md');
  a(doc.includes('用户最初提供的截图显示微信开发者工具“创建小程序”向导'));
  a(doc.includes('条款框未勾选'));
  a(doc.includes('当天较晚的只读观察显示条款框已勾选，操作人无法从画面确认'));
  a(doc.includes('向导当时仍打开且未点击创建'));
  a(doc.includes('旧向导预览`cloud1`本身不能证明环境归属'));
  a(doc.includes('免费体验版3,000点/月'));
  a(doc.includes('微信开发者工具创建的免费期环境可能仍属历史套餐'));
  a(doc.includes('发布后第15天'));
  a(doc.includes('最新用户截图同屏显示小程序名“湘邻湘友”、目标AppID、`cloud1`、环境ID'));
  a(doc.includes('现有截图和只读CLI结果共同确认AppID/环境关联；不证明小程序运行时'));
  a(doc.includes('初次使用可免费体验1个月个人版环境'));
  a(doc.includes('本轮跳过套餐、账单和到期核对'));
  a(doc.includes('本轮按用户要求不核对套餐、账单或到期信息'));
  a(doc.includes('首次创建云开发环境前需完成云开发服务开通，包括同意服务条款和完成服务角色权限授权'));
  a(doc.includes('3,000点/月'));
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
  a.equal(record.accountEvidence.formalNewEnvironmentId, 'cloud1-d2gjahlq39bf141c7');
  a.equal(record.accountEvidence.devtoolsProjectCreationWizardObservation.screenshotCloudTermsAgreementChecked, false);
  a.equal(record.accountEvidence.devtoolsProjectCreationWizardObservation.latestObservation.cloudTermsAgreementChecked, true);
  const task = record.tasks.find((entry) => entry.id === 'SP01');
  a.equal(task.status, 'in-progress');
  a.equal(task.productAcceptancePassed, false);
  a(task.executionProgress.nextAction.includes('费用核查按用户要求略过'));
  a(task.executionProgress.nextAction.includes('旧号个人主体的cloud1不作新号共享候选'));
  a(task.executionProgress.nextAction.includes('若上线后有平台实际付费提示，用户自行办理'));
  a(task.executionProgress.nextAction.includes('费用核查按用户要求略过'));
  const sp01 = read('docs/sp01-technical-environment-20261027.md');
  const plan = read('docs/v1-executable-development-plan-20261027.md');
  for (const text of [
    '一个腾讯云账号只能绑定一个小程序',
    '同主体的其他小程序/公众号',
    '云开发环境不支持跨账号迁移',
    '用户于2026-10-27明确确认，旧号为个人主体，新号属于个体工商户/公司',
    '不符合官方同主体共享前提',
    '未授权修改环境共享设置',
    '本轮跳过套餐',
    '明确确认截图中的`cloud1`由该项目创建',
  ]) a(sp01.includes(text), text);
  a(plan.includes('旧号为个人主体、新号为个体工商户/公司主体'));
});
test('SP04 records the user-confirmed CloudBase project association separately from screenshot and API evidence', () => {
  const record = JSON.parse(read('docs/sp04-operations-configuration-20261027.json'));
  const evidence = record.cloudConsoleScreenshot;
  const doc = read('docs/sp04-operations-configuration-20261027.md');
  a.equal(evidence.visibleEnvironmentName, 'cloud1');
  a.equal(evidence.appIdVisible, false);
  a.equal(evidence.provesNewAppIdConnection, false);
  a.equal(evidence.userConfirmedCreatedFromTargetProject, true);
  a.equal(evidence.confirmedTargetAppId, 'wx2414399d423dfb65');
  a.equal(evidence.environmentIdFromSettingsScreenshot, 'cloud1-d2gjahlq39bf141c7');
  a.equal(evidence.confirmationDate, '2026-10-28');
  a.equal(evidence.confirmationEvidenceLevel, 'explicit-user-confirmation-not-platform-api-verified');
  a(doc.includes('2026-10-28，用户明确确认截图中的 `cloud1` 是从目标 AppID'));
  a(doc.includes('按目标AppID执行的CLI只读环境列表也返回该EnvID'));
  a(doc.includes('不证明当前开发者工具活动窗口加载了该项目'));
});
test('SP01 distinguishes cloudfunctions deployment target from the mini-program runtime environment', () => {
  const doc = read('docs/sp01-technical-environment-20261027.md');
  const app = read('miniprogram/miniprogram/app.js');
  const environmentList = read('miniprogram/miniprogram/envList.js');
  a(doc.includes('`cloudfunctions`根目录的“当前环境”菜单决定云函数上传部署目标'));
  a(doc.includes('`app.js`中的`wx.cloud.init({ env })`指定小程序运行时调用的环境'));
  a(doc.includes('当前模板业务代码没有引用该文件'));
  a(doc.includes('https://github.com/wechat-miniprogram/minigame-demo/blob/master/CLOUD_README.md'));
  a(doc.includes('https://docs.cloudbase.net/recipes/add-cloud-function-wechat-miniprogram'));
  a(app.includes('env: "cloud1-d2gjahlq39bf141c7"'));
  a(environmentList.includes('const envList = [];'));
  a.equal(/require\(['"].*envList/.test(app), false);
});
test('SP01 records the user-reported empty environment menu and keeps account import unperformed', () => {
  const plan = load();
  const sp01 = plan.tasks.find((task) => task.id === 'SP01');
  const sp04 = JSON.parse(read('docs/sp04-operations-configuration-20261027.json'));
  const sp01Doc = read('docs/sp01-technical-environment-20261027.md');
  const sp04Doc = read('docs/sp04-operations-configuration-20261027.md');
  const expected = {
    date: '2026-10-28',
    source: 'user-reply-to-read-only-check',
    projectPath: 'E:\\O2O\\miniprogram',
    folder: 'cloudfunctions',
    result: 'environment-menu-empty',
    cloud1Selectable: false,
    screenshotProvided: false,
    accountAssociationChecked: false,
    existingTencentEnvironmentImported: false,
    deploymentPerformed: false
  };
  a.deepEqual(sp01.executionProgress.latestUserReportedEnvironmentMenuRecheck, expected);
  a.deepEqual(sp04.latestUserReportedEnvironmentMenuRecheck, expected);
  const association={date:'2026-10-28',source:'user-reply-to-read-only-check',targetAppId:'wx2414399d423dfb65',result:'associated',screenshotProvided:false,environmentImportPerformed:false,deploymentPerformed:false};
  a.deepEqual(sp01.executionProgress.latestUserReportedAccountAssociationCheck,association);
  a.deepEqual(sp04.latestUserReportedAccountAssociationCheck,{...association,accountCenterPath:'account-information/login-method/wechat-official-account'});
  a.equal(sp01.status, 'in-progress');
  a.equal(sp01.productAcceptancePassed, false);
  a(sp01.executionProgress.nextAction.includes('腾讯云账号中心已关联目标小程序'));
  a(sp01.executionProgress.nextAction.includes('导入现有cloud1'));
  a(sp01.executionProgress.nextAction.includes('当前尚未获得明确授权'));
  a(sp01Doc.includes('回复“菜单仍为空”'));
  a(sp01Doc.includes('https://docs.cloudbase.net/faq/account'));
  a(sp01Doc.includes('用户随后在账号中心只读查看并报告目标小程序已关联（未附截图）'));
  a(sp01Doc.includes('当前授权不含导入'));
  a(sp04Doc.includes('菜单仍为空'));
  a.equal(sp04.cloudWritesOrDeploymentPerformed, false);
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
test('SP01 separates confirmed runtime and user-reported database mode from runtime execution and API verification',()=>{
 const techDoc=read('docs/sp01-technical-environment-20261027.md');
 const planDoc=read('docs/v1-executable-development-plan-20261027.md');
 const sp04Doc=read('docs/sp04-operations-configuration-20261027.md');
 for(const doc of [techDoc,planDoc,sp04Doc]){
  a(doc.includes('Node.js 20.19'));
  a(doc.includes('用户报告')||doc.includes('用户查看'));
  a(doc.includes('文档型数据库'));
 }
 a(techDoc.includes('不等于云函数已创建、部署或运行'));
 a(techDoc.includes('尚未API复核'));
 a(!techDoc.includes('没有为本项目选定Node云运行时'));
 a(!planDoc.includes('运行时选择、数据库模式、小程序端运行时'));
 a(!sp04Doc.includes('运行时选择和数据库模式仍未验证'));
});
test('SP01 records the user-reported account association and keeps importing cloud1 as an unperformed state change',()=>{
 const p=load(),sp01=p.tasks.find(t=>t.id==='SP01'),sp04=p.tasks.find(t=>t.id==='SP04');
 const techDoc=read('docs/sp01-technical-environment-20261027.md');
 const planDoc=read('docs/v1-executable-development-plan-20261027.md');
 const sp04Doc=read('docs/sp04-operations-configuration-20261027.md');
 const association=sp01.executionProgress.latestUserReportedAccountAssociationCheck;
 a.equal(association.result,'associated');
 a.equal(association.targetAppId,'wx2414399d423dfb65');
 a.equal(association.screenshotProvided,false);
 a.equal(association.environmentImportPerformed,false);
 a(!sp01.executionProgress.nextAction.includes('账号关联尚未核实'));
 a(!sp01.executionProgress.nextAction.includes('先只读核对腾讯云账号中心'));
 a(!sp04.executionProgress.blockedChecks.some(check=>check.includes('需先核对与app.js绑定的模板关系')));
 a(sp04.executionProgress.blockedChecks.some(check=>check.includes('账号中心关联已由用户报告为已关联')));
 for(const doc of [techDoc,planDoc,sp04Doc]){
  a(doc.includes('账号中心')||doc.includes('腾讯云账号中心'));
  a(doc.includes('未附截图'));
  a(doc.includes('尚未执行')||doc.includes('未执行'));
 }
});
test('SP04 E06 distinguishes reported account association from the pending cloud1 import',()=>{
 const sp04=JSON.parse(read('docs/sp04-operations-configuration-20261027.json'));
 const e06=sp04.evidenceGates.find(gate=>gate.id==='E06');
 const association=sp04.latestUserReportedAccountAssociationCheck;
 a.equal(association.result,'associated');
 a.equal(association.environmentImportPerformed,false);
 a.equal(association.deploymentPerformed,false);
 a.equal(e06.passed,false);
 a(e06.reason.includes('用户随后报告腾讯云账号中心已关联'));
 a(e06.reason.includes('环境导入仍未执行'));
 a(!e06.reason.includes('关联核对和环境导入均未执行'));
});
test('SP01 runtime-form evidence and SP04 next actions reflect the latest confirmed state',()=>{
 const techDoc=read('docs/sp01-technical-environment-20261027.md');
 const sp04=JSON.parse(read('docs/sp04-operations-configuration-20261027.json'));
 const runtimeCase=techDoc.split('\n').find(line=>line.includes('ENV-RUNTIME-01'));
 const sp04AccountCheck=sp04.remainingChecks.find(line=>line.includes('用户已复查cloudfunctions根目录环境菜单'));
 a(runtimeCase.includes('用户截图已记录候选并确认选择Node.js 20.19'));
 a(runtimeCase.includes('函数尚未创建'));
 a(!runtimeCase.includes('等待只读观察'));
 a(techDoc.includes('运行时候选截图及用户选择；云函数实际配置、创建与运行仍未验证'));
 a(!techDoc.includes('运行时菜单、数据库模式、事务和文件权限继续标为未知'));
 a(sp04AccountCheck.includes('用户随后报告腾讯云账号中心已关联目标小程序'));
 a(sp04AccountCheck.includes('须先取得具体授权'));
 a(!sp04AccountCheck.includes('先只读核对腾讯云账号中心'));
});

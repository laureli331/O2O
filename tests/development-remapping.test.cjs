'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {validateRemapping,rows}=require('./helpers/development-remapping-validator.cjs');
const root=path.resolve(__dirname,'..'),read=p=>new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(path.join(root,p)));
function bundle(){return {prd:read('docs/prd.md'),plan:read('docs/development-plan.md'),design:read('docs/structured-design.md'),meta:JSON.parse(read('docs/development-remapping-20261015.json')),tech:JSON.parse(read('docs/development-decisions.json'))};}
test('current 60-task plan and 23-page design trace all current fields, modules, notifications and 82 exact acceptance cases',()=>assert.equal(validateRemapping(bundle()),true));
test('original plan/design stay complete and byte-normalized identical to their source Git version',()=>{
 const b=bundle();assert.match(b.meta.sourceCommit,/^[a-f0-9]{40}$/);
 for(const a of b.meta.archives){const current=read(a.path).replace(/\r\n/g,'\n');assert.equal(crypto.createHash('sha256').update(current).digest('hex').toUpperCase(),a.sha256LfNormalized);const original=a.path.includes('development-plan')?'docs/development-plan.md':'docs/structured-design.md';assert.equal(current,cp.execFileSync('git',['show',b.meta.sourceCommit+':'+original],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n'));}
});
test('old task progress and approvals are retained separately and current status does not certify product completion',()=>{
 const b=bundle(),prior=JSON.parse(cp.execFileSync('git',['show',b.meta.sourceCommit+':docs/development-decisions.json'],{cwd:root,encoding:'utf8'}));
 for(const key of Object.keys(prior))assert.deepEqual(b.tech[key],prior[key],'Original record '+key);
 const record=JSON.parse(read('docs/module-specs/decisions.json')),handoff=JSON.parse(read('assets/ui/development-handoff-20261009/decisions.json'));
 assert.equal(record.prdConsolidation.oldTaskPlanRequiresRemapping,false);assert.equal(record.currentPlanningFocus.planningComplete,false);assert.equal(record.currentPlanningFocus.implementationEnabled,false);
 for(const key of ['developmentRemapping','currentPlanningFocus','planningFocusHistory','prdConsolidation'])assert.deepEqual(handoff[key],record[key],key);
 assert.equal(record.developmentRemapping.taskCount,60);assert.equal(record.developmentRemapping.productImplemented,false);
 assert.equal(record.remainingPlanningAudit.totalQuestionCount,53);assert.equal(record.remainingPlanningAudit.remainingQuestionCount,0);
});
const mutations=[
 ['duplicate task ID',b=>{const r=b.plan.match(/^\| DP60 \|[^\r\n]+/m)[0];b.plan+='\n'+r+'\n';},/Duplicate identifier DP/],
 ['unknown acceptance page',b=>b.plan=b.plan.replace(/(^\| BX14 \|[^\r\n]+)V07/m,'$1V99'),/Unknown acceptance page BX14/],
 ['a notification is omitted',b=>b.design=b.design.replace(/^\| N05 \|[^\r\n]+\r?\n/m,''),/Exact current notices/],
 ['inverse field-page coverage is omitted',b=>b.design=b.design.replace(/(^\| F01 \| )V05、V08、V10/m,'$1V05、V10'),/Consistent field\/page directions F01/],
 ['missing transaction task',b=>b.plan=b.plan.replace(/^\| DP49 \|[^\r\n]+\r?\n/m,''),/Task count/],
 ['missing field mapping',b=>b.plan=b.plan.replace(/^\| F21 [^\r\n]+\r?\n/m,''),/Coverage F/],
 ['missing new business',b=>b.plan=b.plan.replace(/^\| M13 [^\r\n]+\r?\n/m,''),/Coverage M/],
 ['missing discovery page',b=>b.design=b.design.replace(/^\| V23 [^\r\n]+\r?\n/m,''),/Design page coverage/],
 ['missing outage acceptance',b=>b.plan=b.plan.replace(/^\| BX14 \|[^\r\n]+\r?\n/m,''),/Acceptance coverage BX/],
 ['changing approved expected result',b=>b.plan=b.plan.replace('仅受影响平台故障暂停自动结束与主计佣','全部交易永久暂停自动结束与主计佣'),/Exact acceptance BX14/],
 ['manual completion returns',b=>b.plan=b.plan.replace('四类服务到期、有效交付异议/解除与双方取消：只在严格过有效到期/保护且无阻断时自动结束','接单员上报完成后客户确认完成'),/Automatic close/],
 ['six rating roles return',b=>b.plan=b.plan.replace('四业务八组被评角色汇总','六组被评角色汇总'),/Rating roles/],
 ['repair commission cap changes',b=>b.plan=b.plan.replace('维修15%整次30','维修15%整次50'),/Commission snapshot/],
 ['deferred advertising is a production prerequisite',b=>{b.plan=b.plan.replace('| DP36 | G |', '| DP36 | G |');const r=rows(b.plan,'DP').get('DP36');b.plan=b.plan.replace(r[3],'DP02、DP03、DP29、DP48、DP56、DP30');b.meta.tasks.DP36.dependencies.push('DP30');},/Active dependency on deferred Banner/],
 ['task graph cycle',b=>{const r=rows(b.plan,'DP').get('DP51');b.plan=b.plan.replace(r[3]+' | '+r[4],r[3]+'、DP23 | '+r[4]);b.meta.tasks.DP51.dependencies.push('DP23');},/Dependency cycle/],
 ['billing prerequisite omitted',b=>{const r=rows(b.plan,'DP').get('DP36');b.plan=b.plan.replace(r[3]+' | '+r[4],r[3].replace('、DP56','')+' | '+r[4]);b.meta.tasks.DP36.dependencies=b.meta.tasks.DP36.dependencies.filter(t=>t!=='DP56');},/Required prerequisite DP36 DP56/],
 ['field permissions weakened',b=>b.design=b.design.replace('联系获准不解码，买家确认后生效','联系获准立即解码'),/Exact field contract F03/],
 ['all-bill suspension',b=>b.design=b.design.replace('仅争议部分暂停','全部账单暂停'),/Current design/],
 ['unknown refund becomes success',b=>b.design=b.design.replace('只有可核对成功标已退','申请后立即标已退'),/Current design/],
 ['protection uses shorter deadline',b=>b.plan=b.plan.replace('验收＋24小时较晚者','验收＋24小时较早者'),/Outage/],
 ['documentation claims product accepted',b=>b.meta.tasks.DP49.productAcceptancePassed=true,/No product acceptance/],
 ['real service enabled by remapping',b=>b.meta.realServicesEnabled=true,/Expected values/],
];
for(const [name,mutate,error]of mutations)test('remapping rejects '+name,()=>{const b=bundle();mutate(b);assert.throws(()=>validateRemapping(b),error);});
test('current and archived planning documents have valid UTF-8, local links, tables and paired fences',()=>{
 for(const file of ['CONTEXT.md','docs/development-plan.md','docs/structured-design.md','docs/development-plan-archive-20261015.md','docs/structured-design-archive-20261015.md']){
  const text=read(file);assert.equal((text.match(/^```/gm)||[]).length%2,0,file);let width=0;
  for(const line of text.split(/\r?\n/)){if(!line.startsWith('|')){width=0;continue;}const n=(line.match(/\|/g)||[]).length;if(width)assert.equal(n,width,file+': '+line);width=n;}
  for(const m of text.matchAll(/\]\(([^)]+)\)/g)){if(/^(https?:\/\/|#)/.test(m[1]))continue;assert(fs.existsSync(path.resolve(root,path.dirname(file),m[1].split('#')[0])),file+': '+m[1]);}
 }
});

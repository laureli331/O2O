'use strict';
const assert=require('node:assert/strict');
const rows=(text,prefix)=>{const found=[...text.matchAll(new RegExp('^\\| ('+prefix+'\\d{2})(?: [^|]+)? \\|[^\\r\\n]+','gm'))];assert.equal(found.length,new Set(found.map(m=>m[1])).size,'Duplicate identifier '+prefix);return new Map(found.map(m=>[m[1],m[0].split('|').slice(1,-1).map(c=>c.trim())]));};
const slice=(text,a,b)=>{const start=text.indexOf(a),end=b?text.indexOf(b,start):text.length;assert(start>=0&&end>start,'Section '+a);return text.slice(start,end);};
const ids=(text,prefix)=>[...text.matchAll(new RegExp('(?<![A-Z])'+prefix+'\\d{2}\\b','g'))].map(m=>m[0]);
const ensureTerms=(text,terms,label)=>{for(const term of terms)assert(text.includes(term),label+': '+term);};
function validateRemapping(b){
 const meta=b.meta,tasks=rows(b.plan,'DP'),deferred=new Set(meta.deferredTaskIds);
 assert.equal(meta.prdVersion,'2.1');assert.equal(meta.documentationRemappingComplete,true);
 assert.deepEqual(meta.coverage,{modules:14,extensions:8,fields:21,pageGroups:22,notifications:9,acceptanceCases:74});
 assert.equal(meta.productImplemented,false);assert.equal(meta.realServicesEnabled,false);
 assert.equal(tasks.size,57,'Task count');assert.equal(meta.taskCount,57);assert.equal(meta.activeTaskCount,51);
 assert.deepEqual([...deferred],['DP30','DP31','DP32','DP33','DP34','DP35']);
 assert.deepEqual(Object.keys(meta.tasks),[...tasks.keys()]);
 const deps=new Map();
 for(let i=1;i<=57;i++){
  const id='DP'+String(i).padStart(2,'0'),r=tasks.get(id);assert(r,'Missing task '+id);
  assert.equal(r.length,7,'Task columns '+id);assert(r.every(c=>c.length),'Empty task cell '+id);
  assert(/^[A-G]$/.test(r[1]),'Task phase '+id);
  const required=ids(r[3],'DP');assert.equal(required.length,new Set(required).size,'Duplicate dependency '+id);
  assert(r[3]==='无'||required.length,'Dependency expression '+id);deps.set(id,required);
  assert.deepEqual(meta.tasks[id].dependencies,required,'Recorded dependencies '+id);assert.equal(meta.tasks[id].phase,r[1]);
  assert.equal(meta.tasks[id].productAcceptancePassed,false,'No product acceptance '+id);
  assert.equal(meta.tasks[id].status,deferred.has(id)?'延后':id==='DP01'?'执行中':['DP02','DP04'].includes(id)?'资料准备中':'未开始','Actual progress '+id);
  if(deferred.has(id)){ensureTerms(r.join(' '),['延后','不得领取实施'],'Deferred '+id);assert.equal(required.length,0);}
 }
 const visiting=new Set(),done=new Set();function visit(id){assert(tasks.has(id),'Unknown task '+id);assert(!visiting.has(id),'Dependency cycle '+id);if(done.has(id))return;visiting.add(id);for(const d of deps.get(id)){assert(!deferred.has(d),'Active dependency on deferred Banner '+id);visit(d);}visiting.delete(id);done.add(id);}
 for(const id of tasks.keys())if(!deferred.has(id))visit(id);
 for(const [id,required] of [['DP03','DP41'],['DP36','DP48'],['DP36','DP56'],['DP23','DP57'],['DP45','DP54']])assert(deps.get(id).includes(required),'Required prerequisite '+id+' '+required);
 const mapping=slice(b.plan,'## 6. 当前范围逐项映射','## 7.');
 for(const [prefix,count]of [['M',14],['R',8],['F',21],['V',22],['N',9]]){
  const current=rows(mapping,prefix),source=rows(b.prd,prefix);assert.equal(source.size,count);assert.equal(current.size,count,'Coverage '+prefix);
  for(const [id,r]of current){assert(source.has(id),'Unknown coverage '+id);assert(ids(r[1],'DP').length,'Unmapped '+id);for(const t of ids(r[1],'DP'))assert(tasks.has(t),'Unknown mapping task '+id);}
 }
 const sourceCases=new Map(),cases=new Map();
 for(const [prefix,count]of [['T',18],['RT',16],['AT',12],['DT',10],['BX',18]]){
  const source=rows(b.prd,prefix),current=rows(slice(b.plan,'## 7. 74项当前验收逐项落点','## 8.'),prefix);
  assert.equal(source.size,count);assert.equal(current.size,count,'Acceptance coverage '+prefix);
  for(const [id,r]of current){sourceCases.set(id,source.get(id));cases.set(id,r);assert.equal(r.length,5,'Acceptance columns '+id);assert.deepEqual(r.slice(0,3),source.get(id),'Exact acceptance '+id);const implemented=ids(r[3],'DP');assert(implemented.some(t=>!deferred.has(t)),'No active owner '+id);for(const t of implemented)assert(tasks.has(t),'Unknown acceptance task '+id);assert(ids(r[4],'V').length,'No page '+id);for(const v of ids(r[4],'V'))assert(rows(b.prd,'V').has(v),'Unknown acceptance page '+id);if(prefix==='AT')assert(ids(r[4],'V').includes('V04'),'AI page '+id);}
 }
 assert.equal(cases.size,74);assert.equal(meta.coverage.acceptanceCases,74);
 const pages=rows(slice(b.design,'## 4. 22组页面交互合同','## 5.'),'V');assert.equal(pages.size,22,'Design page coverage');
 for(const [id,r]of pages){assert.equal(r.length,9,'Page contract columns '+id);assert(r.every(c=>c.length),'Empty page contract '+id);for(const f of ids(r[6],'F'))assert(rows(b.prd,'F').has(f),'Unknown page field '+id);for(const t of ids(r[7],'DP'))assert(tasks.has(t),'Unknown page task '+id);const checks=[...r[8].matchAll(/(?:T|RT|AT|DT|BX)\d{2}/g)].map(m=>m[0]);assert(checks.length,'No page acceptance '+id);for(const c of checks)assert(sourceCases.has(c),'Unknown page acceptance '+id);}
 const fields=rows(slice(b.design,'## 5. 21组字段完整合同','### 5.1'),'F'),sourceFields=rows(b.prd,'F');assert.equal(fields.size,21,'Design field coverage');for(const [id,r]of sourceFields)assert.deepEqual(fields.get(id),r,'Exact field contract '+id);
 const fieldMap=rows(slice(b.design,'### 5.1 字段到页面/任务','## 6.'),'F');assert.equal(fieldMap.size,21,'Field mapping coverage');for(const [id,r]of fieldMap){for(const v of ids(r[1],'V'))assert(pages.has(v),'Unknown field page '+id);assert(ids(r[1],'V').length,'No field page '+id);assert(ids(r[2],'DP').length,'No field task '+id);for(const t of ids(r[2],'DP'))assert(tasks.has(t),'Unknown field task '+id);const used=[...pages].filter(([,p])=>ids(p[6],'F').includes(id)).map(([v])=>v);assert.deepEqual(ids(r[1],'V').sort(),used.sort(),'Consistent field/page directions '+id);}
 const notices=rows(slice(b.design,'## 7. 通知与验收追踪','## 8.'),'N');assert.deepEqual([...notices],[...rows(b.prd,'N')],'Exact current notices');
 ensureTerms(b.design,['四业务八角色','无完成上报或收到确认按钮','不额外72小时','720连续小时','最多168小时','恢复验收成功时点＋24小时','先四舍五入到分','仅争议部分暂停','无需缴纳','轻微按压/回弹','只有可核对成功标已退','未知/无数据/未采集/0不同'],'Current design');
 ensureTerms(tasks.get('DP23')[2],['四类服务到期','无阻断','自动结束'],'Automatic close');
 ensureTerms(tasks.get('DP29')[2],['八组被评角色'],'Rating roles');
 ensureTerms(tasks.get('DP53')[2],['跑腿15%无封顶','维修15%整次30','闲置5%每笔20','其它10%整次20'],'Commission snapshot');
 ensureTerms(tasks.get('DP57')[2],['恢复验收','较晚者'],'Outage');
 assert.equal(b.tech.productionEnabled,false);assert(b.tech.externalGates.every(g=>g.status!=='已完成'),'External conditions remain unverified');assert.deepEqual(b.tech.currentDevelopmentPlan,meta,'Technology current plan');
 return true;
}
module.exports={validateRemapping,rows};

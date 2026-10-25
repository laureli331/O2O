'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../previews/v04.html'),'utf8');
const context=vm.createContext({});vm.runInContext(html.match(/<script id="v04-model">([\s\S]*?)<\/script>/)[1],context);const m=context.V04Model;
const now=Date.parse('2026-10-16T10:00:00+08:00');
const base={title:'合成标题',note:'合成说明',region:'演示社区',landmark:'',category:'家电维修（演示）',start:'2026-10-17T10:00',end:'2026-10-17T18:00',fee:'12',task:'取送物品',pickup:'合成取件点',delivery:'合成送达点',phone:'',priceMode:'fixed',price:'80',images:[]};
test('V04 covers all nine approved screens and remains a single offline HTML',()=>{
 const ascii=fs.readFileSync(path.join(__dirname,'../docs/ascii-design-prd-2.1.md'),'utf8');
 for(const code of 'ABCDEFGHI'){assert(ascii.includes('### V04-'+code));assert(html.includes('data-screen="'+code+'"'));}
 for(const match of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
 assert(!/fetch\(|XMLHttpRequest|localStorage|src="https?:|href="https?:/.test(html));
 assert.deepEqual([...html.matchAll(/sessionStorage\.(\w+)\('([^']+)'/g)].map(m=>[m[1],m[2]]),[['getItem','o2o-v09-form-transfer'],['removeItem','o2o-v09-form-transfer']]);
 assert(html.includes('不会上传图片、调用模型、保存云端草稿或发布真实内容'));assert(html.includes('合成演示'));
});
test('all four business contracts, conditional purchase fields and optional unused-item times',()=>{
 assert.equal(m.validate('repair',base,now).length,0);assert.equal(m.validate('other',{...base,category:''},now).length,0);
 assert.equal(m.validate('errands',base,now).length,0);
 const buy={...base,task:m.tasks[1],pickup:'',purchase:'',goods:''};assert.equal(m.validate('errands',buy,now).length,2);assert.equal(m.validate('errands',{...buy,purchase:'一袋大米',goods:'40'},now).length,0);
 const idle={...base,start:'',end:'',category:m.configs.idle[0]};assert.equal(m.validate('idle',idle,now).length,0);
 assert(m.validate('idle',{...idle,priceMode:'',price:''},now).length);assert.equal(m.validate('idle',{...idle,priceMode:'negotiable',price:''},now).length,0);
 assert(m.validate('repair',{...base,category:'未知分类'},now).length);assert(m.validate('other',{...base,region:'未知区域'},now).length);
});
test('publish entry separates resident publishing from approved merchant main posts',()=>{
 assert.deepEqual(JSON.parse(JSON.stringify(m.merchantEligibility('normal'))),{status:'resident',canSubmit:false});
 assert.deepEqual(JSON.parse(JSON.stringify(m.merchantEligibility('merchant-pending'))),{status:'pending',canSubmit:false});
 assert.deepEqual(JSON.parse(JSON.stringify(m.merchantEligibility('merchant-approved'))),{status:'approved',canSubmit:true});
 for(const copy of ['商家主帖','仅审核通过商家可提交','商家资料审核中','基础主帖免费，不需要会员或内容加热'])assert(html.includes(copy),copy);
 const nav=html.match(/<nav class="tabbar"[\s\S]*?<\/nav>/)[0];
 for(const label of ['首页','发现','发布','服务','我的'])assert(nav.includes('>'+label+'<')||nav.includes('>'+label+'</span>'),label);
 assert(nav.indexOf('首页')<nav.indexOf('发现')&&nav.indexOf('发现')<nav.indexOf('发布')&&nav.indexOf('发布')<nav.indexOf('服务')&&nav.indexOf('服务')<nav.indexOf('我的'));
 assert(!nav.includes('消息'));
 assert(nav.includes('href="v23.html"'));
});
test('amounts, Unicode text and future Shanghai time enforce their boundaries',()=>{
 for(const amount of ['0','-1','1e2','100000','12.345',''])assert(!m.amount(amount),amount);
 for(const amount of ['0.01','12','99999.99'])assert(m.amount(amount),amount);
 assert.equal(m.count(' 🙂 '),1);assert.equal(m.validate('other',{...base,title:'🙂'.repeat(30)},now).length,0);assert(m.validate('other',{...base,title:'字'.repeat(31)},now).length);
 assert(m.validate('other',{...base,note:'字'.repeat(1001)},now).length);assert(m.validate('other',{...base,start:'2026-10-16T10:00'},now).length);assert(m.validate('other',{...base,end:base.start},now).length);
 assert.equal(m.validate('other',{...base,end:'2026-11-15T10:00'},now).length,0);assert(m.validate('other',{...base,end:'2026-11-15T10:01'},now).length);
});
test('field validation identifies correction targets while preserving the original validation interface',()=>{
 const data={...base,title:'',fee:'0',pickup:'',phone:'abc',images:Array(10).fill({})};
 const issues=Array.from(m.validateFields('errands',data,now),x=>({field:x.field,message:x.message}));
 for(const field of ['title','fee','pickup','phone','images'])assert(issues.some(x=>x.field===field),field);
 assert.deepEqual(issues.map(x=>x.message),Array.from(m.validate('errands',data,now)));
 const corrected={...data,title:base.title,fee:base.fee,pickup:base.pickup,phone:'',images:[]};
 assert.equal(m.validateFields('errands',corrected,now).length,0);
 const buy=m.validateFields('errands',{...base,task:m.tasks[1],purchase:'',goods:'',pickup:''},now);
 assert(buy.some(x=>x.field==='purchase'));assert(buy.some(x=>x.field==='goods'));assert(!buy.some(x=>x.field==='pickup'));
});

test('reposting excludes private credentials, old time and fixed fee; demo AI never invents missing facts',()=>{
 const copied=m.copyPublic('errands',{...base,code:'PRIVATE',address:'PRIVATE',contact:'PRIVATE'});
 for(const key of ['phone','pickup','delivery','code','contact','start','end','fee','address'])assert(!(key in copied),key);
 assert(m.privacy('取件码：合成凭据'));assert(m.privacy('电话13800000000'));assert.equal(m.candidate('repair',m.sample.errands),null);assert.equal(m.candidate('idle','卖一个东西'),null);
 const generated=m.candidate('errands',m.sample.errands);assert.equal(generated.fee,'12');assert(!('pickup' in generated));assert(!('start' in generated));assert(!('region' in generated));
});

test('all four businesses offer grounded AI samples and concise validation messages',()=>{
 for(const kind of Object.keys(m.kinds)){
  const result=m.candidate(kind,m.sample[kind]);assert(result,kind);assert(result.title&&result.note,kind);
  if(['repair','other'].includes(kind)){assert(!('fee' in result));assert(!('start' in result));}
 }
 for(const message of m.validate('errands',{...base,title:'',note:'',region:'',fee:'',start:'',end:'',pickup:'',delivery:''},now))assert(Array.from(message).length<=24,message);
 assert(html.includes('class="issue-list"'));assert(!html.includes('待补充 / 核对：'));
 const prior=fs.readFileSync(path.join(__dirname,'../previews/v01-v02.html'),'utf8');
 for(const icon of ['home','discover','bag','plus','message','user']){
  const symbol=prior.match(new RegExp('<symbol id="i-'+icon+'".*?</symbol>'))[0];assert(html.includes(symbol),icon);
 }
 for(const file of ['docs/prd.md','docs/structured-design.md','docs/development-plan.md']){
  const text=fs.readFileSync(path.join(__dirname,'..',file),'utf8');assert(text.includes('四类'),file);assert(!text.includes('维修/其它无AI'),file);
 }
});

test('V04 user-facing states give a truthful next step and retain important limits',()=>{
 for(const copy of ['当前可手动发布，AI整理暂未开放','还想让AI帮你整理？20次只需¥1.90','已保留你的内容，可重试或继续填写','需求已更新，重新整理可获取新建议','内容已保留，查询结果后可继续修改。'])assert(html.includes(copy),copy);
 for(const old of ['整理失败，内容已保留。可重试或手填','结果已过时，请重新整理','请先查询结果，勿重复发布'])assert(!html.includes(old),old);
 const design=fs.readFileSync(path.join(__dirname,'../docs/ascii-design-prd-2.1.md'),'utf8');assert(design.includes('不承诺恢复时间或把未知结果说成成功'));
 assert(html.includes("if(published||unknown)return"));
});

test('resident AI package and optional balance match confirmed commercial choices',()=>{
 assert.deepEqual(JSON.parse(JSON.stringify(m.residentPolicy)),{freePerMonth:3,packCount:20,packPriceCents:190,packDays:180});
 assert.equal(m.shortfall(190,0),190);assert.equal(m.shortfall(190,80),110);assert.equal(m.shortfall(190,300),0);
 for(const copy of ['购买AI次数','选择支付方式','直接支付','余额支付','本次无充值赠金','充值本金长期有效','未消费部分可申请退回','没有发生真实支付或权益发放'])assert(html.includes(copy),copy);
 const prd=fs.readFileSync(path.join(__dirname,'../docs/prd.md'),'utf8');assert(prd.includes('居民每自然月免费3次'));assert(!prd.includes('不能以充值、看广告等未批准方案解锁'));
});

test('AI entry focuses on utility while purchase terms remain at the purchase decision',()=>{
 assert(!html.includes('每月3次免费体验'));assert(html.includes('把一段话整理成标题和说明，核对后即可填入'));
 const design=fs.readFileSync(path.join(__dirname,'../docs/ascii-design-prd-2.1.md'),'utf8');const entry=design.slice(design.indexOf('### V04-G'),design.indexOf('用户提示语：'));
 assert(!entry.includes('用完可购买'));assert(!entry.includes('每月免费3次'));assert(html.includes('购买到账后${p.packDays}天有效'));
});

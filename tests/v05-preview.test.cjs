'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../previews/v05.html'),'utf8'),ctx=vm.createContext({});vm.runInContext(html.match(/<script id="v05-model">([\s\S]*?)<\/script>/)[1],ctx);const m=ctx.V05Model,plain=v=>JSON.parse(JSON.stringify(v));
test('V05 covers every approved screen with separate settings and offline synthetic identity',()=>{
 const ascii=fs.readFileSync(path.join(__dirname,'../docs/ascii-design-prd-2.1.md'),'utf8');for(const key of 'ABCDE'){assert(ascii.includes('### V05-'+key));assert(html.includes('data-screen="'+key+'"'));}assert(html.includes('data-screen="settings"'));
 for(const match of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
 assert(!/fetch\(|XMLHttpRequest|localStorage|sessionStorage|src="https?:|href="https?:|console\.log/.test(html));assert(!html.includes('SHARED_STYLE'));assert(!html.includes('<!-- ICONS -->'));
 assert(html.includes('id="verify-document" class="readonly-input" readonly'));assert(html.includes('全部人物、资格、服务费记录和操作结果为合成演示'));assert(!html.includes('type="date"'));
 const v01=fs.readFileSync(path.join(__dirname,'../previews/v01-v02.html'),'utf8');for(const icon of ['home','bag','plus','message','user'])assert(html.includes(v01.match(new RegExp('<symbol id="i-'+icon+'".*?</symbol>'))[0]),icon);
});
test('login, phone, identity, age conditions and identity changes each independently gate new operations',()=>{
 assert(m.allowed(m.initial('ready')));assert(m.allowed(m.initial('admin')));
 for(const key of ['pending','guest','phone','under16','teen','unknown','changing'])assert(!m.allowed(m.initial(key)),key);
 const valid=m.initial('ready');for(const [key,value] of [['logged',false],['phone',false],['identity','pending'],['identity','unknown'],['age','under16'],['age','conditions-pending'],['changing',true]])assert(!m.allowed({...valid,[key]:value}),key);
 assert(!m.initial('guest').admin);assert(m.initial('admin').admin);
});
test('profile text uses Unicode limits and optional WeChat is never claimed as verified',()=>{
 assert.deepEqual(plain(m.profileErrors({nickname:'🙂'.repeat(20),wechat:''})),[]);assert(m.profileErrors({nickname:' ',wechat:''}).length);assert(m.profileErrors({nickname:'字'.repeat(21),wechat:''}).length);assert(m.profileErrors({nickname:'邻居',wechat:'x'.repeat(51)}).length);
 assert(html.includes('不代表平台已验证其归属'));assert(html.includes('目录旧联系授权会撤销'));
});
test('earnings counts only latest valid ended errand provider fees, without advances or disputed money',()=>{
 const summary=m.earnings(m.records);assert.equal(summary.total,4200);assert.equal(summary.active.length,2);assert.equal(summary.disputed.length,1);assert.equal(summary.history.length,1);
 assert.equal(summary.active.find(x=>x.id==='DEMO-01').fee,2400);assert.equal(m.earnings([...m.records].reverse()).total,4200);
 const unknown=m.records.map(x=>x.id==='DEMO-02'?{...x,fee:null}:x);assert.equal(m.earnings(unknown).total,null);assert.equal(m.money(null),'待核对');assert.equal(m.money(0),'0.00');
 const disputed=m.records.map(x=>x.id==='DEMO-03'?{...x,dispute:false}:x);assert.equal(m.earnings(disputed).total,5400);assert.equal(m.earnings([]).total,0);
 const otherHistory=[...m.records,{id:'EXCLUDED',kind:'repair',role:'provider',ended:true,confirmed:true,fee:900,version:1},{id:'EXCLUDED',kind:'repair',role:'provider',ended:true,confirmed:true,fee:1000,version:2}];assert.equal(m.earnings(otherHistory).history.length,1);
 assert(html.includes('按到期订单统计 · 非到账金额'));assert(html.includes('与跑腿服务费统计、佣金账单分别记录'));assert(!html.includes('data-open="withdraw"'));
});

test('personal transaction heading and earnings share a row; disclosure stays in details',()=>{
 assert(html.includes('<div class="transactions-heading"><h3>我的交易</h3><button class="earnings-entry"'));
 assert(!html.includes('<small>按到期订单统计 · 非到账金额</small>'));
 assert(html.includes('<p class="hint">按到期订单统计 · 非到账金额<br>'));
});

test('entry handoff layout centers its content independently from forms and fixed actions',()=>{
 assert(html.includes("classList.toggle('handoff-layout',centered)"));assert(html.includes('.handoff-layout>.content{margin:auto 0;'));
 assert(html.includes("footer='',centered=false"));
});

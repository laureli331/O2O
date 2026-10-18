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
 assert(html.includes('按到期订单统计 · 非到账金额'));assert(html.includes('与跑腿服务费统计、佣金账单分别记录'));assert(!html.slice(html.indexOf('function income()'),html.indexOf('function documents(')).includes('data-open="withdraw"'));
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

test('documented layout distinguishes populated content from empty states',()=>{
 for(const file of ['docs/prd.md','docs/structured-design.md']){
  const text=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
  assert(text.includes('有内容时，标题、说明和列表从顶部排列'),file);assert(text.includes('仅空状态采用居中'),file);
 }
});

test('cardbag consolidates AI and balance with explicit labels and login protection',()=>{
 assert(html.includes("['cardbag','card','卡包']"));assert(!html.includes('data-private="ai"'));assert(!html.includes('data-private="balance"'));
 assert(html.includes('id="ai-pack"'));assert(html.includes('id="balance-pack"'));assert(html.includes('<h3>AI整理卡</h3>'));assert(html.includes('<h3>余额</h3>'));assert(!html.includes('平台消费余额'));assert(!html.includes('可用消费余额'));
 assert(html.includes("'balance','cardbag','reminders'"));assert(html.includes('data-open="cardbag">返回卡包'));
});

test('wallet forms use exact cents and withdrawal is bounded by available principal',()=>{
 for(const value of ['', '0','-1','1e2','1.001','100000'])assert.equal(m.cents(value),null,value);
 assert.equal(m.cents('1.90'),190);assert.equal(m.cents('0.01'),1);assert.equal(m.cents('99999.99'),9999999);
 assert(m.canWithdraw(190,190));assert(!m.canWithdraw(191,190));assert(!m.canWithdraw(0,190));assert(!m.canWithdraw(null,190));
 assert.deepEqual(plain(m.aiPack),{count:20,price:190,days:180});
 assert(html.includes("['addresses','user','私人地址簿'],['cardbag','card','卡包']"));assert(html.includes('repeat(4,minmax(0,1fr))'));
 assert(!html.includes('cardbag-entry" data-private="cardbag"'));assert(html.includes('data-open="ai">查看详情'));assert(html.includes('data-open="topup">充值'));assert(html.includes('data-open="withdraw">提现'));
 assert(html.includes('尚未到账'));assert(html.includes('提现不包括跑腿服务费统计中的金额'));
});

test('mobile AI action has a full-width touch target and payment methods follow approved order',()=>{
 assert(html.includes('class="primary replenish-button" data-open="buy-ai">补充次数</button>'));
 assert(html.includes('.replenish-button{display:block;width:100%;min-height:48px;'));
 assert(html.includes('padding:12px 18px;font-size:15px}'));
 assert(!html.includes('发布或接单时核验资格。'));
 const purchase=html.slice(html.indexOf('function aiPurchase()'),html.indexOf('function paymentSummary()'));
 assert(purchase.indexOf('value="balance"')>=0);
 assert(purchase.indexOf('value="balance"')<purchase.indexOf('value="direct"'));
});

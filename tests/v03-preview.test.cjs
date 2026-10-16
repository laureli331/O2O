'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../previews/v03.html'),'utf8');
const context=vm.createContext({});vm.runInContext(html.match(/<script id="v03-model">([\s\S]*?)<\/script>/)[1],context);const model=context.V03Model;
const base={amount:'12',advance:'no',limit:'',note:'',time:true,rules:true};
const plain=value=>JSON.parse(JSON.stringify(value));
test('errand applicants accept the publisher fee and cannot replace it through form values',()=>{
  assert.deepEqual(plain(model.validate('errands',base).errors),{});
  for(const amount of ['', '0', '-1','12.345','100000','1e2','99'])assert.equal(model.validate('errands',{...base,amount}).amount,1200,'publisher fee must override untrusted applicant amount');
  assert(model.validate('errands',{...base,advance:''}).errors.advance);
  assert(model.validate('errands',{...base,advance:'yes',limit:'0'}).errors.advance);
  assert.equal(model.validate('errands',{...base,advance:'yes',limit:'50'}).limit,5000);
  assert.equal(model.validate('errands',{...base,advance:'no',limit:'50'}).limit,null);
});
test('repair and other estimates remain optional and never become a formal commission base',()=>{
  for(const kind of ['repair','other']){
    const result=model.validate(kind,{...base,amount:'',advance:''});assert.deepEqual(plain(result.errors),{});assert.equal(result.amount,null);
    assert.equal(model.commission(kind,8000),null);
  }
  assert.equal(model.money(null),'待协商');assert.equal(model.commission('errands',1200),180);assert.equal(model.commission('errands',null),null);
  assert.equal(model.business.repair.cap,30);assert.equal(model.business.other.rate,10);assert.equal(model.business.other.cap,20);
});
test('current time and rule consent are explicit and the description follows 300 Unicode characters',()=>{
  assert(model.validate('errands',{...base,time:false}).errors.consent);
  assert(model.validate('errands',{...base,rules:false}).errors.consent);
  assert.deepEqual(plain(model.validate('repair',{...base,note:'字'.repeat(300)}).errors),{});
  assert(model.validate('repair',{...base,note:'字'.repeat(301)}).errors.note);
  assert.deepEqual(plain(model.validate('repair',{...base,note:'🙂'.repeat(300)}).errors),{});
  const valid={active:true,timeAccepted:true,rulesAccepted:true};assert(model.canSelect(valid));
  for(const key of Object.keys(valid))assert(!model.canSelect({...valid,[key]:false}),key);
});
test('single-file V03 remains offline, clearly synthetic and syntactically valid',()=>{
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
  const markup=html.replace(/<script(?: [^>]*)?>[\s\S]*?<\/script>/g,'');
  for(const match of markup.matchAll(/<use[^>]+href="#([^"]+)"/g))assert(ids.includes(match[1]),match[1]);
  for(const match of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
  assert(!/src="https?:|href="https?:|fetch\(|XMLHttpRequest|localStorage|sessionStorage|tel:/.test(html));
  for(const phrase of ['本地演示 · 全部为合成数据','V03-A','V03-B','V03-C / D','点选只作草选','查询当前结果','不会发送真实申请','未新增第二份申请']){
    assert(html.includes(phrase),phrase);
  }
  assert(!html.includes('SHARED_PREVIEW_STYLE'));assert(!html.includes('SHARED_PREVIEW_ICONS'));
});

test('review comments are reflected without changing the errand commission cap rule',()=>{
  assert.equal(model.business.errands.cap,null);
  assert(!html.includes('不封顶'));
  assert(html.includes('还未确认新时间，暂不能选'));
  assert(html.includes('candidate-avatar'));
  assert(html.indexOf('id="application-status"')>html.indexOf('</form>'));
  assert(html.includes('<h2>${item.title}</h2><span class="badge">${item.name}</span>'));
  const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
  assert(read('docs/prd.md').includes('不允许自行报价或修改服务费'));
  assert(read('docs/structured-design.md').includes('申请者不得自行报价/改价'));
  assert(read('docs/development-plan.md').includes('发布者定价，申请者只读接受'));
  const ascii=read('docs/ascii-design-prd-2.1.md');
  const section=ascii.slice(ascii.indexOf('### V03-B '),ascii.indexOf('### V03-C '));
  assert(section.includes('发布者金额，只读'));assert(!section.includes('[撤回报价]'));
});

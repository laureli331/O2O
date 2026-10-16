'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../previews/v01-v02.html'),'utf8');
const script=html.match(/<script id="preview-model">([\s\S]*?)<\/script>/)[1];
const context=vm.createContext({});vm.runInContext(script,context);const model=context.PreviewModel;
const ids=options=>Array.from(model.filterItems(options),x=>x.id);

test('V01 category choices form a union and combine with keyword and region filters',()=>{
  assert.equal(ids().length,8);
  assert.equal(ids({selected:['repair','errands']}).length,4);
  assert.deepEqual(ids({selected:['repair','errands'],region:'A'}),['washer','parcel']);
  assert.deepEqual(ids({selected:['repair','errands'],region:'A',query:'洗衣机'}),['washer']);
  assert.equal(ids({query:'不存在的关键词'}).length,0);
  assert.deepEqual(ids({query:'  台灯  '}),['lamp']);
  assert.equal(ids({query:'138'}).length,0,'masked contact must not be searched');
});
test('V01 toggles and all reset allow zero or several selected categories',()=>{
  let selected=model.toggleCategory([],'repair');
  selected=model.toggleCategory(selected,'idle');assert.deepEqual(Array.from(selected),['repair','idle']);
  selected=model.toggleCategory(selected,'repair');assert.deepEqual(Array.from(selected),['idle']);
  assert.deepEqual(Array.from(model.toggleCategory(selected,'all')),[]);
  assert.deepEqual(Array.from(model.toggleCategory(selected,'idle')),[]);
  assert.deepEqual(Array.from(model.toggleCategory(selected,'unknown')),['idle']);
});
test('unknown fees stay distinct from a quoted price and idle negotiation',()=>{
  assert.equal(model.priceText(model.items.find(i=>i.id==='washer')),'费用待协商');
  assert.equal(model.priceText(model.items.find(i=>i.id==='lamp')),'面议');
  assert.equal(model.priceText(model.items.find(i=>i.id==='parcel')),'¥ 12');
  assert(!model.items.some(i=>i.price===0));
});
test('V02 original publication and requested service times are separate and idle has no scheduling fields',()=>{
  for(const item of model.items){assert(item.published);if(item.kind==='idle'){assert.equal(item.expected,undefined);assert.equal(item.expiry,undefined);}else{assert(item.expected>item.published);assert(item.expiry>item.expected);}}
  for(const term of ['发布时间：','期望服务时间','服务到期时间','schedule-panel','联系申请获准后仍打码','未提交申请','未提交报价','本地演示 · 全部为合成数据'])assert(html.includes(term),term);
  assert(!html.includes('最新需求'));
  assert(!/href="https?:|src="https?:|fetch\(|XMLHttpRequest|localStorage|sessionStorage|tel:|mailto:/.test(html),'standalone offline preview, without network or real contact actions');
});
test('standalone HTML has unique element IDs, resolves SVG icons and compiles scripts',()=>{
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
  const markup=html.replace(/<script(?: [^>]*)?>[\s\S]*?<\/script>/g,'');
  for(const m of markup.matchAll(/<use[^>]+href="#([^"]+)"/g))assert(ids.includes(m[1]),m[1]);
  for(const item of model.items)assert(ids.includes('i-'+item.art),item.art);
  for(const m of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
  assert(html.includes('prefers-reduced-motion'));assert(html.includes('focus-visible'));assert(html.includes('aria-modal="true"'));
});

test('reviewed cards prioritize imagery and title while sort and detail labels stay honest',()=>{
  const sort=html.match(/<span class="sort-label">([\s\S]*?)<\/span>/)[1];
  assert.equal(sort,'最新发布');
  assert(!html.includes('id="price-label"'));
  assert(!html.includes("$('price-label')"));
  assert(!html.includes('发布者填写 · 接单前可见'));
  assert(html.includes('<h3 class="panel-title">时间要求</h3>'));
  assert(html.includes('.listing .art{height:auto;aspect-ratio:4/5}'));
  assert(html.includes('price-text'));assert(html.includes('price-number'));
  assert(html.includes('<span class="kind">'));
});

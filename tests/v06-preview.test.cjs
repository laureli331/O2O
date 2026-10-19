'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const file=path.join(__dirname,'../previews/v06.html');

test('V06 exists as a standalone offline prototype with the approved navigation',()=>{
  assert(fs.existsSync(file),'previews/v06.html must exist');
  const html=fs.readFileSync(file,'utf8');
  for(const match of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
  assert(!/fetch\(|XMLHttpRequest|localStorage|sessionStorage|src="https?:|href="https?:|console\.log/.test(html));
  const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(match=>match[1]);assert.equal(new Set(ids).size,ids.length);
  const nav=html.match(/<nav class="tabbar"[\s\S]*?<\/nav>/)[0];
  assert.deepEqual([...nav.matchAll(/data-tab="([^"]+)"/g)].map(match=>match[1]),['首页','发现','发布','服务','我的']);
  assert(nav.includes('<use href="#i-discover"/>'));assert(!nav.includes('data-tab="消息"'));
  assert(html.includes('prefers-reduced-motion'));assert(html.includes('focus-visible'));
});

test('feed, validation, permissions and version states follow the approved contract',()=>{
  const html=fs.readFileSync(file,'utf8'),ctx=vm.createContext({});
  vm.runInContext(html.match(/<script id="v06-model">([\s\S]*?)<\/script>/)[1],ctx);const m=ctx.V06Model,plain=value=>JSON.parse(JSON.stringify(value));
  const feed=m.feed(m.posts);assert.deepEqual(plain(feed.map(post=>post.id)),['P-103','P-101','P-104']);
  assert(feed.every(post=>post.approved&&post.displayable));assert(!feed.some(post=>post.kind==='resident'));
  assert.deepEqual(plain(m.layout([9,4,7,2])),[[0,3],[1,2]]);
  for(const count of [1,9])assert.equal(m.postErrors({title:'新'.repeat(20),body:'好'.repeat(1000),images:Array(count).fill('x')}).length,0);
  for(const count of [0,10])assert(m.postErrors({title:'新'.repeat(20),body:'好',images:Array(count).fill('x')}).length,count);
  assert.equal(m.visibleLength('🙂'.repeat(20)),20);assert(m.postErrors({title:'🙂'.repeat(21),body:'好',images:['x']}).length);
  assert(m.postErrors({title:'标题',body:'🙂'.repeat(1001),images:['x']}).length);
  assert.deepEqual(plain(m.eligibility('resident')),{status:'resident',canSubmit:false});
  assert.deepEqual(plain(m.eligibility('merchant-pending')),{status:'pending',canSubmit:false});
  assert.deepEqual(plain(m.eligibility('merchant-approved')),{status:'approved',canSubmit:true});
  assert.deepEqual(plain(m.version('pending')), {publicVersion:1,reviewVersion:2,publicVisible:true,replaced:false});
  assert.deepEqual(plain(m.version('rejected')),{publicVersion:1,reviewVersion:2,publicVisible:true,replaced:false});
  assert.deepEqual(plain(m.version('approved')), {publicVersion:2,reviewVersion:null,publicVisible:true,replaced:true});
  assert.deepEqual(plain(m.version('risk-removed')),{publicVersion:null,reviewVersion:null,publicVisible:false,replaced:false});
});

test('share, favorite rollback, stale-load retention and notification copy are privacy safe',()=>{
  const html=fs.readFileSync(file,'utf8'),ctx=vm.createContext({});vm.runInContext(html.match(/<script id="v06-model">([\s\S]*?)<\/script>/)[1],ctx);const m=ctx.V06Model;
  const share=m.share(m.posts[0]);assert.deepEqual(Object.keys(share).sort(),['cover','merchant','postId','title']);
  assert(!JSON.stringify(share).match(/phone|wechat|address|license|private/i));
  assert.equal(m.favorite(false,true),false);assert.equal(m.favorite(false,false),true);
  const prior=[{id:'OLD'}];assert.equal(m.loadResult(prior,null),prior);assert.deepEqual(JSON.parse(JSON.stringify(m.loadResult(prior,[]))),[]);
  for(const copy of ['微信分享示意','旧公开版继续展示','风险内容已下架','服务页右上角二级入口','2条未读'])assert(html.includes(copy),copy);
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const file=path.join(__dirname,'../previews/v06.html');
const guide=path.join(__dirname,'../docs/v06-html-preview.md');

test('V06 exists as a standalone offline prototype with the approved navigation',()=>{
  assert(fs.existsSync(file),'previews/v06.html must exist');
  const html=fs.readFileSync(file,'utf8');
  for(const match of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
  assert(!/fetch\(|XMLHttpRequest|localStorage|sessionStorage|src="https?:|href="https?:|console\.log/.test(html));
  const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(match=>match[1]);assert.equal(new Set(ids).size,ids.length);
  const nav=html.match(/<nav class="tabbar"[\s\S]*?<\/nav>/)[0];
  assert.deepEqual([...nav.matchAll(/data-tab="([^"]+)"/g)].map(match=>match[1]),['首页','发现','发布','服务','我的']);
  assert(nav.includes('<use href="#i-discover"/>'));assert(!nav.includes('data-tab="消息"'));
  assert(html.includes('class="topic-tabs"'));assert(!html.includes('附近 · 商家新鲜事'));assert(!html.includes('最新发布'));
  for(const fragment of ['id="main-actions"','id="detail-actions"','class="topic-options"','name="post-topic"','class="detail-merchant-bar"','class="detail-back"','V06PreviewTest'])assert(html.includes(fragment),fragment);
  for(const fragment of ['editorDraft','class="field-error"','feed-transition'])assert(html.includes(fragment),fragment);
  assert(html.includes('prefers-reduced-motion'));assert(html.includes('focus-visible'));
});

test('feed, validation, permissions and version states follow the approved contract',()=>{
  const html=fs.readFileSync(file,'utf8'),ctx=vm.createContext({});
  vm.runInContext(html.match(/<script id="v06-model">([\s\S]*?)<\/script>/)[1],ctx);const m=ctx.V06Model,plain=value=>JSON.parse(JSON.stringify(value));
  assert.deepEqual(plain(m.topics),['最新','优惠','上新','活动']);
  const feed=m.feed(m.posts,'最新');assert.deepEqual(plain(feed.map(post=>post.id)),['P-103','P-101','P-104']);
  assert.deepEqual(plain(m.feed(m.posts,'优惠').map(post=>post.id)),['P-101']);
  assert.deepEqual(plain(m.feed(m.posts,'上新').map(post=>post.id)),['P-103']);
  assert.deepEqual(plain(m.feed(m.posts,'活动').map(post=>post.id)),['P-104']);
  const untagged={...m.posts[0],id:'P-U',topic:null};assert.equal(m.feed([untagged],'最新').length,1);assert.equal(m.feed([untagged],'优惠').length,0);
  assert.deepEqual(plain(m.merchantPosts(m.posts,'青禾面包房').map(post=>post.id)),['P-101']);
  assert.equal(m.merchantPosts(m.posts,'待审商家').length,0);
  assert(feed.every(post=>post.approved&&post.displayable));assert(!feed.some(post=>post.kind==='resident'));
  assert.deepEqual(plain(m.layout([9,4,7,2])),[[0,3],[1,2]]);
  for(const count of [1,9])assert.equal(m.postErrors({title:'新'.repeat(20),body:'好'.repeat(1000),images:Array(count).fill('x')}).length,0);
  for(const count of [0,10])assert(m.postErrors({title:'新'.repeat(20),body:'好',images:Array(count).fill('x')}).length,count);
  assert.equal(m.visibleLength('🙂'.repeat(20)),20);assert(m.postErrors({title:'🙂'.repeat(21),body:'好',images:['x']}).length);
  assert.equal(m.visibleLength('👨‍👩‍👧‍👦'),1);assert.equal(m.visibleLength('e\u0301'),1);
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
  assert.equal(m.badge(2),2);assert.equal(m.badge(0),null);
  const prior=[{id:'OLD'}];assert.equal(m.loadResult(prior,null),prior);assert.deepEqual(JSON.parse(JSON.stringify(m.loadResult(prior,[]))),[]);
  assert(html.includes('unreadCount=2'));
  for(const copy of ['分享</button>','旧公开版继续展示','风险内容已下架','服务页右上角二级入口','这里还没有可展示的商家主帖','加载失败，已保留上次内容','未登录也可以浏览','发布时间','查看商家公开资料'])assert(html.includes(copy),copy);
  for(const removed of ['不会用假帖子填充空状态。','这里只展示商家公开资料中的名称和服务区域','id="favorite-failure"','微信分享示意'])assert(!html.includes(removed),removed);
});

test('preview guide documents the content-first V06 refinement',()=>{
  const markdown=fs.readFileSync(guide,'utf8');
  for(const phrase of ['最新 / 优惠 / 上新 / 活动','主题帖同时进入“最新”和对应主题','公开页面不显示“已审核”或“资料已审核”','图片选择与排序置顶','A 版顶部商家栏','SVG `<`','固定“收藏 / 分享”操作区','同一商家的合规公开主帖'])assert(markdown.includes(phrase),phrase);
});

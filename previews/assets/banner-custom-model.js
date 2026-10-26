'use strict';
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BannerCustom=factory();})(globalThis,()=>{
 const PRICE=290,KEY='o2o-banner-custom-preview-v1',TTL=1800000;
 const clone=v=>JSON.parse(JSON.stringify(v));
 const xml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 function create(){return {status:'idle',sequence:0,request:null,versions:[],selected:null,chargedCents:0};}
 function start(s,input){
  if(['pending','unknown'].includes(s.status))throw Error('先查询这次生成结果，请勿重复生成。');
  if(!String(input.title||'').trim())throw Error('请填写广告标题。');
  s.request={id:'DEMO-CUSTOM-'+(++s.sequence),input:clone(input),charged:false};s.status='pending';return s.request.id;
 }
 function finish(s,result){
  if(!['pending','unknown'].includes(s.status))throw Error('当前没有待核实的生成。');
  if(!['success','failed','unknown'].includes(result))throw Error('未知生成结果');
  if(result==='unknown'){s.status='unknown';return;}
  if(result==='failed'){s.status='failed';return;}
  const r=s.request;
  if(!r.charged){
   const artwork={title:String(r.input.title).slice(0,30),subtitle:String(r.input.subtitle||'').slice(0,48),name:String(r.input.name||'').slice(0,30),style:['natural','warm','clean'].includes(r.input.style)?r.input.style:'natural',layout:'left',variant:s.sequence%3};
   s.versions.push({id:r.id,artwork});s.selected=r.id;r.charged=true;s.chargedCents+=PRICE;
  }
  s.status='success';
 }
 function current(s){return s.versions.find(v=>v.id===s.selected)||null;}
 function select(s,id){if(!s.versions.some(v=>v.id===id))throw Error('找不到这张成图');s.selected=id;}
 function edit(s,values){const v=current(s);if(!v)throw Error('请先生成图片');for(const k of ['title','subtitle'])if(k in values)v.artwork[k]=String(values[k]).slice(0,k==='title'?30:48);if(['left','center'].includes(values.layout))v.artwork.layout=values.layout;}
 function save(s,storage,now=Date.now()){storage.setItem(KEY,JSON.stringify({expires:now+TTL,state:s}));}
 function load(storage,now=Date.now()){
  try{const v=JSON.parse(storage.getItem(KEY));if(!v||v.expires<=now||v.expires>now+TTL||!Array.isArray(v.state?.versions)||!['idle','pending','unknown','success','failed'].includes(v.state.status))return null;const s=v.state;if(s.status==='pending')s.status='unknown';return s;}catch{return null;}
 }
 function svg(a){
  const palettes={natural:['#e9efde','#375d46','#8ba77b','#c2ceae'],warm:['#f4e9d7','#6d4b37','#c59a65','#e5caa6'],clean:['#e6eef0','#2e5362','#80a4af','#c1d5db']},p=palettes[a.style]||palettes.natural,center=a.layout==='center',x=center?600:72,anchor=center?'middle':'start';
  const wrap=(text,n)=>{const chars=Array.from(String(text||''));return [chars.slice(0,n).join(''),chars.slice(n,n*2).join('')].filter(Boolean);};
  return '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="660" viewBox="0 0 1200 660"><rect width="1200" height="660" fill="'+p[0]+'"/><circle cx="'+(a.variant===1?1050:970)+'" cy="310" r="290" fill="'+p[3]+'" opacity=".65"/><path d="M900 630Q710 270 1020 70Q1230 400 1060 660Z" fill="'+p[2]+'" opacity=".7"/><circle cx="1080" cy="590" r="210" fill="'+p[1]+'" opacity=".14"/><g fill="'+p[1]+'" font-family="Microsoft YaHei,PingFang SC,sans-serif" text-anchor="'+anchor+'"><text x="'+x+'" y="100" font-size="26" letter-spacing="3">'+xml(a.name)+'</text>'+wrap(a.title,center?15:11).map((t,i)=>'<text x="'+x+'" y="'+(260+i*76)+'" font-size="58" font-weight="600">'+xml(t)+'</text>').join('')+wrap(a.subtitle,center?24:20).map((t,i)=>'<text x="'+x+'" y="'+(460+i*38)+'" font-size="28">'+xml(t)+'</text>').join('')+'</g><path d="M72 565h'+(center?1056:240)+'" stroke="'+p[2]+'" stroke-width="3"/></svg>';
 }
 function source(a){return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg(a));}
 return {PRICE,KEY,TTL,create,start,finish,current,select,edit,save,load,svg,source};
});

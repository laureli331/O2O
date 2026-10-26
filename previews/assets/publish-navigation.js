'use strict';
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PublishNavigation=factory();})(globalThis,()=>{
 const pages=['v01-v02.html','v23.html','services.html','v05.html','v07.html','v09.html'],KEY='o2o-publish-navigation-v1',TTL=1800000;
 function safeSource(value,origin){try{const url=new URL(value,origin+'/');return url.origin===origin&&!url.username&&!url.password&&pages.some(name=>url.pathname==='/'+name)?url.pathname.slice(1)+url.search+url.hash:null;}catch{return null;}}
 if(typeof document==='undefined')return {safeSource};
 const source=()=>safeSource(location.href,location.origin),target=()=>{const role=document.getElementById('role-select')?.value,merchant=location.pathname==='/v23.html'&&['merchant-approved','merchant-pending'].includes(role);return (merchant?'v23.html?mode=publish&entry=merchant&role='+encodeURIComponent(role):'v04.html?mode=publish')+'&return='+encodeURIComponent(source()||'v01-v02.html');};
 function read(){try{const r=JSON.parse(sessionStorage.getItem(KEY));return r?.expires>Date.now()&&r.expires<=Date.now()+TTL&&safeSource(r.source,location.origin)?r:null;}catch{return null;}}
 function enter(trigger){const record={source:source()||'v01-v02.html',expires:Date.now()+TTL,phase:'out',outerTop:scrollY,scrolls:[...document.querySelectorAll('.phone .scroll,.phone [id$="-scroll"]')].filter(e=>e.id).map(e=>({id:e.id,top:e.scrollTop}))};sessionStorage.setItem(KEY,JSON.stringify(record));location.href=target();}
 function exit(){const ref=safeSource(document.referrer,location.origin),destination=safeSource(new URLSearchParams(location.search).get('return')||'',location.origin)||ref||'v01-v02.html',record=read();if(record?.source===destination){record.phase='return';sessionStorage.setItem(KEY,JSON.stringify(record));}if(ref===destination&&history.length>1)history.back();else location.href=destination;}
 function restore(){const record=read();if(record?.phase!=='return'||record.source!==source())return;requestAnimationFrame(()=>requestAnimationFrame(()=>{for(const s of record.scrolls){const el=document.getElementById(s.id);if(el)el.scrollTop=s.top;}scrollTo({top:record.outerTop,behavior:'instant'});document.querySelector('.tabbar .publish,.tabbar [data-tab="发布"]')?.focus({preventScroll:true});sessionStorage.removeItem(KEY);}));}
 function links(){document.querySelectorAll('a.tab.publish,.tabbar a.publish').forEach(a=>a.setAttribute('href',target()));}
 document.addEventListener('click',e=>{const trigger=e.target.closest('.tabbar .publish,.tabbar [data-tab="发布"]');if(!trigger||!source())return;e.preventDefault();e.stopImmediatePropagation();enter(trigger);},true);
 let scheduled=false;new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;links();});}).observe(document.body,{childList:true,subtree:true});links();window.addEventListener('pageshow',restore);restore();
 return {safeSource,exit};
});

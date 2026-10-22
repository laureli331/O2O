'use strict';
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.V10Flow=factory();})(globalThis,()=>{
 const GRANT='o2o-preview-qualification',RETURN='o2o-preview-application-return',TTL=1800000;
 const allowed=s=>!!(s?.logged&&s.phone&&s.identity==='valid'&&s.age==='eligible'&&!s.changing);
 const store=provided=>provided||sessionStorage;
 function grant(s,provided,now=Date.now()){if(!allowed(s))throw Error('请先完成必要资格核验');store(provided).setItem(GRANT,JSON.stringify({owner:'me',logged:true,phone:true,identity:'valid',age:'eligible',changing:false,expires:now+TTL}));}
 function read(provided,now=Date.now()){try{const s=JSON.parse(store(provided).getItem(GRANT));return s?.owner==='me'&&s.expires>now&&s.expires<=now+TTL&&allowed(s)?s:null;}catch(e){return null;}}
 function capture(kind,form,provided,now=Date.now()){if(!['repair','errands','other'].includes(kind))throw Error('无法恢复原申请');const safe={amount:String(form.amount||''),advance:form.advance==='yes'?'yes':'no',limit:String(form.limit||''),note:String(form.note||'').slice(0,300),time:!!form.time,rules:!!form.rules,context:{title:String(form.context?.title||'').slice(0,30),fee:String(form.context?.fee||''),start:String(form.context?.start||'').slice(0,16),end:String(form.context?.end||'').slice(0,16)}};store(provided).setItem(RETURN,JSON.stringify({owner:'me',kind,form:safe,expires:now+TTL}));}
 function consume(provided,now=Date.now()){try{const st=store(provided),value=JSON.parse(st.getItem(RETURN));st.removeItem(RETURN);return value?.owner==='me'&&['repair','errands','other'].includes(value.kind)&&value.expires>now&&value.expires<=now+TTL&&value.form?value:null;}catch(e){return null;}}
 function invalidate(provided){store(provided).removeItem(GRANT);}
 function qualificationStep(s){if(!s?.logged)return 'login';if(s.changing||s.identity==='unknown'||['under16','conditions-pending'].includes(s.age))return 'identity';return s.phone?'identity':'phone';}
 function destination(from){return from==='apply'?'v03.html?resume=1':from==='provider'?'v10.html':null;}
 return {allowed,grant,read,capture,consume,invalidate,destination,qualificationStep,TTL};
});

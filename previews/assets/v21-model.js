'use strict';
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.V21Model=factory();})(globalThis,()=>{
 const NOW='2026-10-24T10:00:00+08:00',MAX='2026-10-23',types=['维修','跑腿','闲置','其它'];
 function create(){const rows=[];for(let day=17;day<=23;day++)for(let j=0;j<4;j++){const n=day-16+j;rows.push({date:`2026-10-${day}`,type:types[j],published:n+2,accepted:n,ended:Math.max(0,n-2),cancelled:j===1?1:0,objections:day===21&&j===0?1:0,due:n*120,received:n*100,applied:n*90,excess:n*10,refunded:day===22?50:0,credit:day===20?30:0,cohort:{P:n+2,A:n+1,H:n,C:Math.max(0,n-2)},stock:{waiting:2,active:n,ended:Math.max(0,n-2)},ai:{R:n+3,S:n+2,U:n,B:n-1,E:Math.max(0,n-3),blocked:1,processing:0,failed:1,times:[200+n*30,700+n*50,1400+n*60],input:(n+3)*100,output:(n+3)*50,cached:0,thinking:null,cost:null}});}return rows;}
 function range(start,end){if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||new Date(start).toISOString().slice(0,10)!==start||new Date(end).toISOString().slice(0,10)!==end||start>end||end>MAX)throw Error('请选择有效日期，结束日期最晚为2026年10月23日。');}
 function selected(rows,start,end,type){range(start,end);if(type!=='全部'&&!types.includes(type))throw Error('请选择已有业务类型');return rows.filter(r=>r.date>=start&&r.date<=end&&(type==='全部'||r.type===type));}
 function sum(rows,key){if(!rows.length)return null;const values=rows.map(r=>r[key]);return values.some(v=>!Number.isFinite(v))?null:values.reduce((a,b)=>a+b,0);}
 function aggregate(rows){return Object.fromEntries(['published','accepted','ended','cancelled','objections','due','received','applied','excess','refunded','credit'].map(k=>[k,sum(rows,k)]));}
 function ratio(n,d){return d===0||d===null||n===null?null:n/d;}
 function cohort(rows){const data=rows.filter(r=>r.type==='跑腿'),s=key=>data.length?data.reduce((n,r)=>n+r.cohort[key],0):0;const P=s('P'),A=s('A'),H=s('H'),C=s('C');return {P,A,H,C,apply:ratio(A,P),accept:ratio(H,P),complete:ratio(C,H)};}
 function percentile(values,p){if(!values.length)return null;const a=[...values].sort((a,b)=>a-b);return a[Math.ceil(p*a.length)-1];}
 function ai(rows){const s=k=>rows.length?rows.reduce((n,r)=>n+r.ai[k],0):0;const values=rows.flatMap(r=>r.ai.times),R=s('R'),S=s('S'),U=s('U'),B=s('B'),E=s('E');return {R,S,U,B,E,generated:ratio(S,R),adopted:ratio(U,S),published:ratio(B,U),edited:ratio(E,B),blocked:s('blocked'),processing:s('processing'),failed:s('failed'),samples:values.length,p50:percentile(values,.5),p95:percentile(values,.95),input:s('input'),output:s('output'),cached:s('cached'),thinking:null,cost:null};}
 return {NOW,MAX,types,create,range,selected,sum,aggregate,cohort,ratio,percentile,ai};
});

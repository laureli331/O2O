'use strict';
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./v20-model.js'));else root.V20Presentation=factory(root.V20Model);})(globalThis,M=>{
 const typeNames={content:'评价待审核',response:'回复待审核',qualification:'服务经历待核实',appeal:'用户申请复核'},statusNames={todo:'待你处理',processing:'正在处理',waiting:'等用户补充',done:'已处理'};
 const choices={approve:'允许公开',reject:'不予公开',grant:'确认服务已实际完成',deny:'现有材料无法确认',maintain:'原处理不变',correct:'更正原处理'};
 const actionNames={review:'核对处理结果',conclude:'核对处理结果',respond:'记录首次回复',request:'请用户补充材料'};
 function rows(s,filter={}){const status=filter.status||'active',all=M.queue(s,{type:filter.type||'all',status:status==='active'?'all':status,search:''});const q=(filter.search||'').trim().toLowerCase();return all.filter(c=>(status!=='active'||!['waiting','done'].includes(c.status))&&(!q||[c.id,c.reviewId,c.title,M.subject(s,c).title].filter(Boolean).some(x=>x.toLowerCase().includes(q))));}
 function task(c){if(c.status==='done')return {hint:'这项处理已经完成，可以查看结果与说明。',action:'查看结果'};if(c.status==='waiting')return {hint:'已请用户补充材料，等待用户回复。',action:'查看进展'};return ({content:{hint:'审核这条评价能否公开。',action:'去审核'},response:{hint:'审核这条回复能否公开。',action:'去审核'},qualification:{hint:'核实这次服务是否已经实际完成。',action:'去核实'},appeal:{hint:'结合补充材料，重新核对原处理是否合适。',action:'去复核'}})[c.type];}
 function excerpt(s,c){const r=M.rating(s,c);if(c.type==='qualification')return c.evidence[0]?.text||'目前缺少核实材料。';if(c.type==='appeal')return c.original?.reason||'查看原处理说明与补充材料。';return (c.type==='response'?r.response?.text:r.content?.text)||'未填写文字。';}
 function impact(s,c,d){if(d.action==='respond')return '记录已经回复用户；服务是否完成、评价能否公开仍需另行判断。';if(d.action==='request')return '记录需要补充什么，并转为等待用户补充；原回复时间不重置。';if(c.type==='qualification')return d.choice==='grant'?'确认后，仅开放这次经历的评价资格，不会生成订单或评分。':'不开放这次经历的评价资格，其它记录不受影响。';if(c.type==='appeal')return M.impact(s,d);if(c.type==='response')return d.choice==='approve'?'允许公开这条回复。':'这条回复不公开，原评价和评分不受影响。';return d.choice==='approve'?'允许公开这次提交的文字和图片，评分保持不变。':M.facts(s,c).publicContent?'这次修改不会公开，原评价继续展示，评分保持不变。':'这条评价的文字和图片暂不公开，评分保持不变。';}
 function error(message){if(message.startsWith('版本已更新'))return '内容有更新，填写已保留。请查看最新内容后重新选择处理结果。';if(message.includes('先查询原请求'))return '有一项处理结果还没确认，请先查询这次结果。';return message;}
 return {typeNames,statusNames,choices,actionNames,rows,task,excerpt,impact,error};
});

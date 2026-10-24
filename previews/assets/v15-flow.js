'use strict';
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.V15Flow=factory();})(globalThis,()=>{
 const direct=['respond','request','conclude','reopen'];
 const snippets={
  respond:[['received','已收到，正在核对原内容与相关材料。'],['checking','本次先核对原内容与举报说明。']],
  request:[['image','请补充被举报内容的原图。'],['detail','请说明具体有问题的句子或图片。'],['proof','请补充与本事项对应的凭据。']],
  conclude:[['not-found','所举报的问题未出现在当前原文中。'],['unsupported','现有材料未能支持本次举报，暂不作内容处置。']],
  rectify:[['description','请修改被指出的描述，使其与实际服务范围一致。'],['image','请补充与当前内容相符的图片。']],
  remove:[['promotion','原文包含与本条需求无关的服务推广内容。'],['claim','所作服务承诺缺少对应支持材料。']],
  reopen:[['new-proof','收到新的相关材料，需要重新核对原处理。']],
  restrict:[['source','所依据的材料是：'],['behavior','本次需限制的行为是：']],
  ban:[['source','所依据的材料是：'],['cause','本次封禁的具体原因是：']],
  accountRelease:[['source','本次解除限制的依据是：']],release:[['source','本次解除内容处置的依据是：']],
  accept:[['new-proof','本次补充了新的费用约定，申请核验。']],
  review:[['source','本次核准金额的依据是：']],closureReview:[['source','原已缴、更正及已使用抵扣的核对依据是：']],
  notify:[['notice','本次通知针对已核定的争议应补余额，无争议部分原期限保持。']],
  allocate:[['receipt','本次按已核实的支付引用核对实收，并排除争议暂缓项。']],
  refundCheck:[['excess','本次只核对多收本金，历史抵扣另行记录。']],
  refund:[['refund','本次仅申请退回已核对的多收款，是否成功以查询结果为准。']],
  faultRecord:[['source','本次故障的核实日志与影响范围是：']],recover:[['source','本次恢复验收的依据是：']]
 };
 const shortLabels={received:'已收到',checking:'开始核对',image:'补充图片',detail:'说明具体问题',proof:'补充凭据','not-found':'原文未见此问题',unsupported:'现有材料不足',description:'修改服务描述',promotion:'无关服务推广',claim:'服务承诺缺少依据','new-proof':'新增相关材料',source:'填写材料依据',behavior:'填写受限行为',cause:'填写具体原因',notice:'仅通知争议余额',receipt:'核对实收分配',excess:'只核对多收本金',refund:'申请退回多收款'};
 function needsConfirm(action){return !direct.includes(action);}
 const extra={respond:[['continue','需进一步核对材料后再作结论。']],conclude:[['keep','当前材料无法确认所举报的问题，保留现有内容状态。']],rectify:[['promotion','请移除与本条内容无关的推广信息。']],remove:[['mismatch','原文与用于展示的图片不相符。']],reopen:[['supplement','收到针对原结论的补充说明，需要重新核对。'],['correction','原结论涉及的信息有更正，需另开处理段记录。']],accept:[['related','本次新增材料与原费用争议相关，请一并核对。'],['scope','本次核验仅涉及争议佣金，无争议部分原期限保持。']],notify:[['deadline','通知生成后，争议应补余额按72小时期限处理。'],['scope','无争议部分继续按原截止时间处理。']],allocate:[['order','按最早到期的可缴项分配，争议暂缓项不参与本次分配。'],['separate','多收本金另列，不能自动转为历史抵扣。']],refundCheck:[['allocations','保留原有效抵付，不改变已核对的分配。'],['separate','核准抵扣与多收本金分别核对。']],refund:[['pending','发起退回不等于已退回，需查询可核对的成功结果。'],['preserve','原有效抵付与核准抵扣保持不变。']]};
 const extraLabels={continue:'继续核对材料',keep:'保留当前状态',mismatch:'图文不符',supplement:'收到补充说明',correction:'原信息需更正',related:'核对新增材料',scope:'保留原处理范围',deadline:'补缴期限',order:'按到期顺序分配',separate:'抵扣与多收分开',allocations:'保留有效抵付',pending:'查询退回结果',preserve:'保留原抵付记录'};
 function choices(action){if(!snippets[action])return [];const rows=[...snippets[action],...(extra[action]||[])];for(const row of [['scope-prefix','本次需要核对的范围是：'],['detail-prefix','本次具体处理依据是：']])if(rows.length<3)rows.push(row);return rows.map(([key,text])=>({key,label:shortLabels[key]||extraLabels[key]||({'scope-prefix':'填写具体范围','detail-prefix':'填写具体依据'})[key]||text,text}));}
 function insert(value,start,end,text){if(value.includes(text))return {value,duplicate:true};const at=Math.max(0,Math.min(value.length,Number.isInteger(end)?end:value.length)),piece=(at&&value[at-1]!=='\n'?'\n':'')+text+(at<value.length&&value[at]!=='\n'?'\n':'');if(value.length+piece.length>1000)throw Error('插入后将超过1000字，请先精简文字；原内容已保留。');return {value:value.slice(0,at)+piece+value.slice(at),at,piece,cursor:at+piece.length};}
 function undo(value,last){if(!last||value.slice(last.at,last.at+last.piece.length)!==last.piece)return null;return value.slice(0,last.at)+value.slice(last.at+last.piece.length);}
 function incomplete(value){return /^(?:(?:所依据的材料|本次需限制的行为|本次封禁的具体原因|本次解除限制的依据|本次解除内容处置的依据|本次核准金额的依据|原已缴、更正及已使用抵扣的核对依据|本次故障的核实日志与影响范围|本次恢复验收的依据|本次需要核对的范围|本次具体处理依据)是：[\s\n]*)+$/.test(value.trim());}
 return {direct,needsConfirm,choices,insert,undo,incomplete};
});

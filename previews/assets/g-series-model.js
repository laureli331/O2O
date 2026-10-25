(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GSharedModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const scenes={g01:['首次加载','没有收藏','筛选无匹配','首次读取失败','更新失败','需要登录','没有权限','失效与下架'],g02:['正在提交','结果未知','查询仍未知','提交成功','明确未成功','内容有更新'],g03:['图片预览','大图加载失败','格式不支持','单张超过5MB','超出张数','公开分享'],g04:['放弃修改','删除地址','重要操作核对','完成反馈']};
 const contexts={public:{label:'公开需求',min:0,max:9},merchant:{label:'商家主帖',min:1,max:9},review:{label:'评价',min:0,max:3},receipt:{label:'单项费用凭据',min:0,max:3}};
 function validatePhoto(file,count,context='review'){const rules=contexts[context];if(!rules)return '无法确认图片规则，请返回原任务。';if(!['image/jpeg','image/png'].includes(file.type))return '请选择JPG或PNG图片。';if(file.size>5*1024*1024)return '这张图片超过5MB，请换一张不超过5MB的。';if(count>=rules.max)return '这里最多添加'+rules.max+'张图片，已选图片已保留。';return '';}
 function createRequest(){return {id:'demo-request-1',status:'idle',submits:0,queries:0,accepted:false};}
 function submit(request){if(['pending','unknown','success'].includes(request.status))return false;request.status='pending';request.submits++;return true;}
 function settle(request,result){if(!['pending','unknown'].includes(request.status))return false;if(!['success','failed','unknown'].includes(result))return false;request.status=result;request.accepted=result==='success';return true;}
 function query(request,result){if(!['pending','unknown'].includes(request.status))return false;request.queries++;return settle(request,result);}
 function currentCode(page,index){return page.toUpperCase()+'-'+String(index+1).padStart(2,'0');}
 function canPreview(photo,allowed){return photo.public===true||allowed===true;}
 function publicShare(snapshot){if(snapshot.public!==true||snapshot.available!==true)return null;return {title:snapshot.title,cover:snapshot.publicCover||'assets/service-storage.svg'};}
 return Object.freeze({scenes,contexts,validatePhoto,createRequest,submit,settle,query,currentCode,canPreview,publicShare});
});

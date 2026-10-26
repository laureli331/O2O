'use strict';
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BannerImageUpload=factory();})(globalThis,()=>{
 function kind(bytes){if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))return 'image/png';if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';return null;}
 async function inspect(file){
  if(file.type&&!['image/png','image/jpeg'].includes(file.type))throw Error('暂不支持这个格式，请选择JPG/JPEG或PNG图片。');
  const detected=kind(new Uint8Array(await file.slice(0,12).arrayBuffer()));if(!detected||file.type&&file.type!==detected)throw Error('图片内容与格式不符，请重新导出为JPG或PNG后上传。');
  const url=URL.createObjectURL(file);try{return await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>image.naturalWidth&&image.naturalHeight?resolve({width:image.naturalWidth,height:image.naturalHeight}):reject(Error('图片无法打开，请重新选择或导出后上传。'));image.onerror=()=>reject(Error('图片无法打开，请重新选择或导出后上传。'));image.src=url;});}finally{URL.revokeObjectURL(url);}
 }
 function message(info){return '当前图片 '+info.width+' × '+info.height+' 像素。'+(info.width<=info.height?'这张图片偏方或偏竖，建议使用横向图片，并核对首页预览效果。':'首页以横幅展示，请核对首页预览效果。');}
 return {kind,inspect,message};
});

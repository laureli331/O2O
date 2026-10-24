'use strict';
const assert=require('node:assert/strict');
module.exports=function helpers(p,url){
 const a=k=>p.locator('[data-action="'+k+'"]'),choose=k=>p.locator('#field-action').selectOption(k),has=k=>p.locator('#field-action option[value="'+k+'"]').count(),nav=k=>p.locator('[data-page="'+k+'"]').click(),text=()=>p.locator('#content').textContent();
 async function reset(){await p.goto(url);await p.evaluate(()=>sessionStorage.clear());await p.reload();}
 async function submit(reason='本次合成材料已逐项核对，记录具体依据。'){await p.locator('#field-reason').fill(reason);await a('review').click();if(await p.locator('#operation-confirm').evaluate(e=>e.open))await a('execute').click();}
 async function scenario(value){if(await a('save-draft').isVisible())await a('save-draft').click();await p.locator('#scenario').selectOption(value);assert.equal(await p.locator('#scenario').inputValue(),value);}
 return {a,choose,has,nav,text,reset,submit,scenario};
};

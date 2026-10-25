"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('current journey audit links resolve and primary handoffs point to the latest status',()=>{
 for(const name of ['docs/ui-ux-current-status-20261025.md','docs/service-journey-optimization-20261025.md']){
  const file=path.join(root,name),text=fs.readFileSync(file,'utf8');
  for(const match of text.matchAll(/\[[^\]\n]+\]\(([^)]+)\)/g)){const target=match[1];if(/^(?:https?:|#)/.test(target))continue;assert(fs.existsSync(path.resolve(path.dirname(file),target.split('#')[0])),name+': '+target);}
 }
 for(const name of ['CONTEXT.md','docs/prd.md','docs/structured-design.md','docs/development-plan.md','docs/ascii-design-prd-2.1.md','docs/ui-ux-audit-and-v15-flow-proposal-20261024.md'])assert(fs.readFileSync(path.join(root,name),'utf8').includes('ui-ux-current-status-20261025.md'),name);
});

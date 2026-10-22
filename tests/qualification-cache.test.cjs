'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
test('all qualification flow consumers request the current content version instead of a stale cached contract',()=>{
 const root=path.join(__dirname,'../previews'),asset=fs.readFileSync(path.join(root,'assets/v10-flow.js'));
 const version=crypto.createHash('sha256').update(asset.toString('utf8').replace(/\r\n/g,'\n')).digest('hex').slice(0,12),consumers=[];
 for(const file of fs.readdirSync(root).filter(name=>name.endsWith('.html'))){
  const html=fs.readFileSync(path.join(root,file),'utf8');
  for(const match of html.matchAll(/<script\s+src="assets\/v10-flow\.js([^\"]*)"/g)){consumers.push(file);assert.equal(match[1],'?v='+version,file+' must refresh its flow script when the module changes');}
 }
 assert.deepEqual(consumers.sort(),['v03.html','v05.html','v10.html']);
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');

test('historical V06 discovery URL redirects once to V23 while preserving query and hash',()=>{
 const html=fs.readFileSync(path.join(root,'previews/v06.html'),'utf8');
 const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 for(const [search,hash] of [['',''],['?topic=%E6%B4%BB%E5%8A%A8&from=old','#merchant'],['?next=https://example.com','#safe']]){
  const destinations=[];vm.runInNewContext(script,{location:{search,hash,replace:value=>destinations.push(value)}});
  assert.deepEqual(destinations,['v23.html'+search+hash]);
 }
 assert(!html.includes('v23-model'));assert(html.includes('services.html?tab=published'));
});

test('current discovery links use V23 and the implementation has a single canonical file',()=>{
 for(const name of ['v01-v02','v04','v05','v07','services']){
  const html=fs.readFileSync(path.join(root,'previews/'+name+'.html'),'utf8');
  assert(html.includes('href="v23.html"'),name);assert(!html.includes('href="v06.html"'),name);
 }
 const html=fs.readFileSync(path.join(root,'previews/v23.html'),'utf8');
 assert(html.includes('id="v23-model"'));assert(html.includes('V23Model'));
 assert(!html.includes('V06Model'));assert(!html.includes('location.replace('));
});

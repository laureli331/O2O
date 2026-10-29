const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
(async () => {
 const sourcePath = process.argv[2];
 assert.ok(sourcePath, 'Usage: node check-download-sdk.cjs <official-3.17.5.wxvpkg>');
 const bytes = fs.readFileSync(sourcePath), source = bytes.toString();
 assert.ok(source.includes('SDK_STORAGE_INTERNAL_SERVER_ERROR_EMPTY_DOWNLOAD_URL:-403003'));
 const match = source.match(/n=await (async function\(t\)\{var r=JSON\.stringify\(\{fileid:t\.fileID\}\)[\s\S]*?return o\.download_url\})\(t\)/);
 assert.ok(match, 'Exact SDK download URL resolver must exist; refuse a substitute implementation');
 class SDKError extends Error { constructor(options) { super(options.errMsg); this.errCode = options.errCode; } }
 const codes = { SDK_STORAGE_INTERNAL_SERVER_ERROR_EMPTY_DOWNLOAD_URL: -403003, '-403003': 'internal server error: empty download url' };
 const scenarios = [
  { name:'empty upstream data', data:{}, expectedCode:-403003 },
  { name:'permission error response without URL', data:{code:'STORAGE_EXCEED_AUTHORITY'}, expectedCode:-403003 },
  { name:'valid URL', data:{download_url:'https://synthetic.invalid/file'}, expectedURL:'https://synthetic.invalid/file?skip_domain_check=true' },
  { name:'upstream network rejection', rejects:true, expectedCode:'SYNTHETIC_NETWORK_FAILURE' },
 ];
 const outcomes = [];
 for (const scenario of scenarios) {
  let calls = 0;
  const runtime = { e:{name:'synthetic',env:'synthetic',request:async request => {
   calls++; assert.equal(request.apiName,'tcbapi_downloadfile');
   assert.deepEqual(JSON.parse(request.serializedReqData),{fileid:'synthetic-file-id'});
   if(scenario.rejects) throw Object.assign(new Error('synthetic'),{errCode:'SYNTHETIC_NETWORK_FAILURE'});
   return {data:scenario.data};
  }}, T:SDKError, I:codes };
  const resolver = vm.runInNewContext('('+match[1]+')', runtime, {timeout:1000});
  if(scenario.expectedURL) assert.equal(await resolver({fileID:'synthetic-file-id'}),scenario.expectedURL);
  else await assert.rejects(resolver({fileID:'synthetic-file-id'}),error=>error.errCode===scenario.expectedCode);
  assert.equal(calls,1);
  outcomes.push({name:scenario.name,passed:true,result:scenario.expectedCode||'URL returned'});
 }
 const result = {sourcePath,sourceSHA256:crypto.createHash('sha256').update(bytes).digest('hex'),sdkVersion:'3.17.5',extractedResolverSHA256:crypto.createHash('sha256').update(match[1]).digest('hex'),networkRequestsSent:0,outcomes,limitation:'Synthetic upstream responses exercise actual installed SDK resolver; this does not capture historical phone upstream response or prove phone SDK version.'};

 console.log(JSON.stringify(result,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});


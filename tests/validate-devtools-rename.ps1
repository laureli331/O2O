$ErrorActionPreference = 'Stop'
$probeRoot = 'C:\Users\laureli\AppData\Local\微信开发者工具\User Data\4a6f9becc952747a48336026ce043eee\WeappVendor\codex-rename-probe-bFDWpY'
$toolRuntime = 'E:\微信web开发者工具\微信开发者工具.exe'
if (-not (Test-Path -LiteralPath $probeRoot -PathType Container)) { throw 'Authorized diagnostic directory is missing' }
if (-not (Test-Path -LiteralPath $toolRuntime -PathType Leaf)) { throw 'Observed tool runtime is missing' }
$code = @"
const fs=require('fs'), path=require('path'), crypto=require('crypto');
const root='C:/Users/laureli/AppData/Local/微信开发者工具/User Data/4a6f9becc952747a48336026ce043eee/WeappVendor/codex-rename-probe-bFDWpY';
const content='codex-disposable-rename-probe';
const id=crypto.randomUUID();
const dir=path.join(root,'revalidation-'+id);
fs.mkdirSync(dir);
const source=path.join(dir,'probe.txt');
const target=path.join(root,'revalidation-'+id+'.txt');
fs.writeFileSync(source,content,{flag:'wx'});
fs.renameSync(source,target);
if(fs.existsSync(source)||fs.readFileSync(target,'utf8')!==content) throw Error('Rename verification failed');
console.log(JSON.stringify({runtime:process.versions.electron?'wechat-tool':'local-node',result:'passed',contentPreserved:true}));
"@
& node -e $code
if ($LASTEXITCODE -ne 0) { throw 'Local Node rename regression failed' }
$previousElectronMode = $env:ELECTRON_RUN_AS_NODE
try {
  $env:ELECTRON_RUN_AS_NODE = '1'
  & $toolRuntime -e $code
  if ($LASTEXITCODE -ne 0) { throw 'WeChat runtime rename regression failed' }
} finally {
  $env:ELECTRON_RUN_AS_NODE = $previousElectronMode
}
Write-Output 'Runtime rename validation passed: 2 real runtime checks. Synthetic diagnostic files retained.'
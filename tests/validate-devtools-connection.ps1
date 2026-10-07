$ErrorActionPreference='Stop'
$cli='E:\微信web开发者工具\cli.bat'
$record=Get-Content -LiteralPath (Join-Path $PSScriptRoot '..\docs\development-decisions.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not (Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq 'E:\微信web开发者工具\微信开发者工具.exe' })) { throw 'Observed WeChat instance is not running; refusing automatic startup' }
function Invoke-VerifiedRead([string[]]$Arguments) {
  $previousPreference=$ErrorActionPreference
  try {
    $ErrorActionPreference='Continue'
    $output=& $cli @Arguments 2>&1 | Out-String
    $exitCode=$LASTEXITCODE
  } finally { $ErrorActionPreference=$previousPreference }
  if ($exitCode -ne 0 -or $output -match '\[error\]|system error|IDE_SERVICE_PORT_DISABLED|"error"\s*:|timeout|×|✖') { throw ('Official read failed: '+$output) }
  return $output
}
$login=Invoke-VerifiedRead -Arguments @('islogin','--lang','zh')
if ($login -notmatch '"login"\s*:\s*true') { throw 'Explicit successful login response is absent' }
if ($login -notmatch 'http://127\.0\.0\.1:(\d+)') { throw 'Actual service address is absent' }
$port=[int]$Matches[1]
if (-not (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)) { throw 'Returned service port is not listening' }
$envOutput=Invoke-VerifiedRead -Arguments @('cloud','env','list','--appid',$record.resources.appIdValue,'--lang','zh')
$environmentIds=@([regex]::Matches($envOutput,'(?m)^\*\s+([^\s]+)\s*$') | ForEach-Object {$_.Groups[1].Value})
if ($environmentIds -notcontains 'cloud1-d1g1mv89t76512a25') { throw 'Observed cloud environment is absent from official successful query' }
[pscustomobject]@{Login=$true;ServiceAddress=('http://127.0.0.1:'+$port);EnvironmentIds=$environmentIds} | ConvertTo-Json -Depth 3
Write-Output 'Official connection validation passed: 3 live checks. New skill authorization, writes, and expiry are not verified.'
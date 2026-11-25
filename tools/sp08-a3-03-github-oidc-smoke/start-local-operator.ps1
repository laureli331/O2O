param(
  [Parameter(Mandatory = $true)][string]$ConfigPath,
  [Parameter(Mandatory = $true)][string]$NodePath,
  [switch]$RunOnce
)
$ErrorActionPreference = 'Stop'
$secrets = [System.Collections.Generic.List[System.Security.SecureString]]::new()
$buffers = [System.Collections.Generic.List[IntPtr]]::new()
$plain = [System.Collections.Generic.List[string]]::new()
$process = $null
try {
  if (-not [System.IO.Path]::IsPathFullyQualified($ConfigPath)) { throw '公开配置路径无效。' }
  if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) { throw '公开配置路径无效。' }
  if (-not [System.IO.Path]::IsPathFullyQualified($NodePath)) { throw 'Node路径无效。' }
  if (-not (Test-Path -LiteralPath $NodePath -PathType Leaf)) { throw 'Node路径无效。' }
  $nodeVersion = & $NodePath --version 2>$null
  if ($LASTEXITCODE -ne 0 -or $nodeVersion -ne 'v20.19.3') { throw 'Node版本不符合本地验证基线。' }
  $config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
  & $NodePath (Join-Path $PSScriptRoot 'local-operator-launcher.cjs') --check-only ([IO.Path]::GetFullPath($ConfigPath)) | Out-Null
  if ($LASTEXITCODE -ne 0) { throw '公开配置预检失败。' }
  if (-not $RunOnce) { Write-Output '{"state":"check-only","readyToDispatch":false}'; return }
  Add-Type -Path (Join-Path $PSScriptRoot 'bounded-process-output.cs')
  $names = @('STS 临时 SecretId', 'STS 临时 SecretKey', 'STS Token', 'GitHub token')
  foreach ($name in $names) { $secrets.Add((Read-Host -Prompt $name -AsSecureString)) }
  $expirationText = Read-Host -Prompt 'STS 凭据有效期（ISO 8601）'
  foreach ($secure in $secrets) {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); $buffers.Add($ptr)
    $plain.Add([Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr))
  }
  $expiration = [DateTimeOffset]::MinValue
  if (-not [DateTimeOffset]::TryParse($expirationText, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind, [ref]$expiration) -or $expiration -le [DateTimeOffset]::UtcNow) { throw 'STS 有效期无效或已过期。' }
  $envelope = @{ credential = @{ secretId = $plain[0]; secretKey = $plain[1]; token = $plain[2] }; token = $plain[3]; expiration = $expiration.ToString('o') } | ConvertTo-Json -Compress
  if ([Text.Encoding]::UTF8.GetByteCount($envelope) -gt 32768) { throw '凭据输入超出限制。' }
  $entry = Join-Path $PSScriptRoot 'local-operator-launcher.cjs'
  $start = [Diagnostics.ProcessStartInfo]::new()
  $start.FileName = $nodePath
  $start.ArgumentList.Add($entry); $start.ArgumentList.Add('--run-once'); $start.ArgumentList.Add([IO.Path]::GetFullPath($ConfigPath))
  $start.UseShellExecute = $false; $start.RedirectStandardInput = $true; $start.RedirectStandardOutput = $true; $start.RedirectStandardError = $true; $start.CreateNoWindow = $true
  $process = [Diagnostics.Process]::new(); $process.StartInfo = $start
  if (-not $process.Start()) { throw '启动子进程失败。' }
  $stdoutTask = [BoundedProcessOutput]::DrainAsync($process.StandardOutput.BaseStream, 4096, $process)
  $stderrTask = [BoundedProcessOutput]::DrainAsync($process.StandardError.BaseStream, 4096, $process)
  $process.StandardInput.Write($envelope); $process.StandardInput.Close(); $envelope = $null
  if (-not $process.WaitForExit(900000)) { $process.Kill(); throw '本地启动超过15分钟；结果未知，不自动重试。' }
  try { $out = $stdoutTask.GetAwaiter().GetResult(); $err = $stderrTask.GetAwaiter().GetResult() } catch { throw '子进程输出无效或超限；未自动重试。' }
  if ($process.ExitCode -ne 0 -or $err.Length -ne 0 -or $out -notmatch '^\{"state":"tls-complete","sourceRunId":"[1-9][0-9]{0,19}"\}\r?\n?$') { throw '执行失败、输出超限或结果格式无效；未自动重试。' }
  Write-Output $out.Trim()
} catch {
  [Console]::Error.WriteLine('本地启动未完成；请按状态检查流程处理，不要自动重试。')
  exit 1
} finally {
  if ($process) { try { if (-not $process.HasExited) { $process.Kill(); $process.WaitForExit(5000) | Out-Null } } catch {}; try { $process.Dispose() } catch {} }
  foreach ($ptr in $buffers) { if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) } }
  foreach ($secure in $secrets) { $secure.Dispose() }
  $plain.Clear()
}

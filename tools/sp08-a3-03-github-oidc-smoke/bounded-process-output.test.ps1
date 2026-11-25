$ErrorActionPreference = 'Stop'
Add-Type -Path (Join-Path $PSScriptRoot 'bounded-process-output.cs')
$exe = (Get-Command pwsh).Source
$start = [Diagnostics.ProcessStartInfo]::new()
$start.FileName = $exe
$start.ArgumentList.Add('-NoProfile')
$start.ArgumentList.Add('-Command')
$start.UseShellExecute = $false
$start.RedirectStandardOutput = $true
$start.RedirectStandardError = $true
$child = [Diagnostics.Process]::new(); $child.StartInfo = $start
if (-not $child.Start()) { throw 'fake-child-start-failed' }
foreach ($streamName in @('Out', 'Error')) {
  $start.ArgumentList.Clear()
  $start.ArgumentList.Add('-NoProfile')
  $start.ArgumentList.Add('-Command')
  $start.ArgumentList.Add("[Console]::$streamName.Write('SENTINEL-' + ('x' * 2000000))")
  $child = [Diagnostics.Process]::new(); $child.StartInfo = $start
  if (-not $child.Start()) { throw 'fake-child-start-failed' }
  $out = [BoundedProcessOutput]::DrainAsync($child.StandardOutput.BaseStream, 4096, $child)
  $err = [BoundedProcessOutput]::DrainAsync($child.StandardError.BaseStream, 4096, $child)
  $limited = $false
  try { $null = $out.GetAwaiter().GetResult(); $null = $err.GetAwaiter().GetResult() } catch { if ($_.Exception.Message -match 'child-output-limit') { $limited = $true } else { throw } }
  $child.WaitForExit(5000) | Out-Null
  if (-not $limited -or -not $child.HasExited) { throw 'fake-child-was-not-stopped' }
  $child.Dispose()
}
Write-Output 'bounded stdout and stderr children stopped'

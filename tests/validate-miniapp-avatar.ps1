param([ValidateSet('v1','v2','v3','v4')][string]$Version = 'v1')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$avatarRoot = Split-Path -Parent $PSScriptRoot
$avatarDirectory = Join-Path $avatarRoot "assets\branding\miniapp-avatar-$Version"
$avatarRecord = Get-Content -LiteralPath (Join-Path $avatarDirectory 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$avatarFile = Join-Path $avatarDirectory $avatarRecord.uploadFile
$avatarPassed = 0
function Assert-Avatar([bool]$Condition,[string]$Message) {
    if (-not $Condition) { throw $Message }
    $script:avatarPassed++
    Write-Output "PASS: $Message"
}
$avatarBytes = [IO.File]::ReadAllBytes($avatarFile)
Assert-Avatar ([BitConverter]::ToString($avatarBytes[0..7]) -eq '89-50-4E-47-0D-0A-1A-0A') 'Actual file has PNG signature'
Assert-Avatar ($avatarBytes.Length -gt 0 -and $avatarBytes.Length -lt 2000000 -and $avatarBytes.Length -eq $avatarRecord.bytes) 'Actual file size is below 2MB and matches record'
Add-Type -AssemblyName System.Drawing
$avatarImage = [System.Drawing.Image]::FromFile($avatarFile)
try {
    Assert-Avatar ($avatarImage.Width -eq 144 -and $avatarImage.Height -eq 144 -and $avatarRecord.width -eq 144 -and $avatarRecord.height -eq 144) 'Exact upload dimensions are 144 by 144'
    Assert-Avatar ($avatarImage.RawFormat.Guid -eq [System.Drawing.Imaging.ImageFormat]::Png.Guid -and $avatarRecord.format -eq 'png') 'Decoder confirms PNG format'
} finally { $avatarImage.Dispose() }
Assert-Avatar ((Get-FileHash -LiteralPath $avatarFile -Algorithm SHA256).Hash -eq $avatarRecord.sha256) 'Content matches the validated avatar'
Assert-Avatar ((Test-Path -LiteralPath (Join-Path $avatarDirectory $avatarRecord.sourceFile)) -and (Get-Item -LiteralPath (Join-Path $avatarDirectory $avatarRecord.sourceFile)).Length -gt 0 -and $avatarRecord.sourceFile -ne $avatarRecord.uploadFile) 'Generation original is retained separately'
Assert-Avatar ((Get-Item -LiteralPath (Join-Path $avatarDirectory $avatarRecord.prompt)).Length -gt 0 -and (Test-Path -LiteralPath (Join-Path $avatarDirectory $avatarRecord.visualBaseline))) 'Prompt and approved visual baseline are available'
$avatarDocPath = Join-Path $avatarRoot "docs\miniapp-avatar-$Version.md"
$avatarDoc = Get-Content -LiteralPath $avatarDocPath -Raw -Encoding UTF8
$avatarBrokenLinks = @([regex]::Matches($avatarDoc, '\]\(([^)]+)\)') | Where-Object { -not (Test-Path -LiteralPath (Join-Path (Split-Path -Parent $avatarDocPath) $_.Groups[1].Value)) })
Assert-Avatar ($avatarBrokenLinks.Count -eq 0 -and $avatarDoc.Contains($avatarRecord.sha256)) 'Document references resolve and identify exact deliverable'
Write-Output "Avatar $Version validation passed: $avatarPassed checks."

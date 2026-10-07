param()
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$logoRepoRoot = Split-Path -Parent $PSScriptRoot
$logoRoot = Join-Path $logoRepoRoot 'assets\branding\miniapp-logo-directions-v1'
$logoRecord = Get-Content -LiteralPath (Join-Path $logoRoot 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$logoChecks = 0
function Assert-Logo([bool]$Condition,[string]$Message) {
    if (-not $Condition) { throw $Message }
    $script:logoChecks++
    Write-Output "PASS: $Message"
}
Assert-Logo ($logoRecord.directions.Count -eq 3 -and @($logoRecord.directions.key | Select-Object -Unique).Count -eq 3) 'Exactly three distinct named directions delivered'
Assert-Logo ($null -eq $logoRecord.selected -and $logoRecord.status -eq 'design-options') 'Alternatives are not recorded as user-approved selection'
Assert-Logo (@($logoRecord.directions.sha256 | Select-Object -Unique).Count -eq 3) 'Three directions have different image content'
Assert-Logo (Test-Path -LiteralPath (Join-Path $logoRoot $logoRecord.visualBaseline)) 'Approved UI palette reference resolves'
Add-Type -AssemblyName System.Drawing
foreach ($logoDirection in $logoRecord.directions) {
    $logoPath = Join-Path $logoRoot $logoDirection.file
    $logoBytes = [IO.File]::ReadAllBytes($logoPath)
    Assert-Logo ([BitConverter]::ToString($logoBytes[0..7]) -eq '89-50-4E-47-0D-0A-1A-0A') "$($logoDirection.key): actual PNG signature"
    Assert-Logo ($logoBytes.Length -gt 0 -and $logoBytes.Length -lt 2000000 -and $logoBytes.Length -eq $logoDirection.bytes) "$($logoDirection.key): below 2MB and size matches record"
    $logoImage = [System.Drawing.Image]::FromFile($logoPath)
    try {
        Assert-Logo ($logoImage.Width -eq 144 -and $logoImage.Height -eq 144 -and $logoDirection.width -eq 144 -and $logoDirection.height -eq 144) "$($logoDirection.key): exact 144 by 144 pixels"
        Assert-Logo ($logoImage.RawFormat.Guid -eq [System.Drawing.Imaging.ImageFormat]::Png.Guid -and $logoDirection.format -eq 'png') "$($logoDirection.key): decoder confirms PNG"
    } finally { $logoImage.Dispose() }
    Assert-Logo ((Get-FileHash -LiteralPath $logoPath -Algorithm SHA256).Hash -eq $logoDirection.sha256) "$($logoDirection.key): image matches content fingerprint"
    Assert-Logo ((Get-Item -LiteralPath (Join-Path $logoRoot $logoDirection.source)).Length -gt 0 -and $logoDirection.source -ne $logoDirection.file) "$($logoDirection.key): generation source preserved"
    Assert-Logo ((Get-Item -LiteralPath (Join-Path $logoRoot $logoDirection.prompt)).Length -gt 0) "$($logoDirection.key): exact prompt retained"
}
$logoDocPath = Join-Path $logoRepoRoot 'docs\miniapp-logo-directions-v1.md'
$logoDoc = Get-Content -LiteralPath $logoDocPath -Raw -Encoding UTF8
$logoBadLinks = @([regex]::Matches($logoDoc, '\]\(([^)]+)\)') | Where-Object { -not (Test-Path -LiteralPath (Join-Path (Split-Path -Parent $logoDocPath) $_.Groups[1].Value)) })
Assert-Logo ($logoBadLinks.Count -eq 0) 'All document resource links resolve'
Assert-Logo (@($logoRecord.directions | Where-Object { -not $logoDoc.Contains($_.sha256) }).Count -eq 0) 'Document identifies all three delivered images'
Assert-Logo ((Test-Path -LiteralPath (Join-Path $logoRepoRoot 'assets\branding\miniapp-avatar-v1\avatar-144.png')) -and (Test-Path -LiteralPath (Join-Path $logoRepoRoot 'assets\branding\miniapp-avatar-v2\avatar-144.png'))) 'Both previous avatars retained'
Write-Output "Logo directions validation passed: $logoChecks checks."

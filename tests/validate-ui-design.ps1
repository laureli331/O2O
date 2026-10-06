param()
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$uiRepoRoot = Split-Path -Parent $PSScriptRoot
$uiAssetRoot = Join-Path $uiRepoRoot 'assets\ui\v1'
$uiDocPath = Join-Path $uiRepoRoot 'docs\ui-design-v1.md'
$uiPassed = 0
function Assert-UI([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
    $script:uiPassed++
    Write-Output "PASS: $Message"
}
$uiFiles = @('overview.png', 'overview-initial.png', 'icons.svg', 'design-tokens.json', 'generation-prompt.txt', 'text-refinement-prompt.txt')
foreach ($uiFile in $uiFiles) {
    $uiPath = Join-Path $uiAssetRoot $uiFile
    Assert-UI ((Test-Path -LiteralPath $uiPath) -and ((Get-Item -LiteralPath $uiPath).Length -gt 0)) "Resource exists and is nonempty: $uiFile"
}
foreach ($uiFile in @('overview.png', 'overview-initial.png')) {
    $uiBytes = [IO.File]::ReadAllBytes((Join-Path $uiAssetRoot $uiFile))
    $uiSignature = [BitConverter]::ToString($uiBytes[0..7])
    Assert-UI ($uiSignature -eq '89-50-4E-47-0D-0A-1A-0A') "Valid PNG signature: $uiFile"
    Add-Type -AssemblyName System.Drawing
    $uiBitmap = [System.Drawing.Image]::FromFile((Join-Path $uiAssetRoot $uiFile))
    try {
        Assert-UI ($uiBitmap.Width -ge 1000 -and $uiBitmap.Height -ge 1400) "Readable portrait overview dimensions: $uiFile"
    } finally { $uiBitmap.Dispose() }
}
$uiFinalHash = (Get-FileHash -LiteralPath (Join-Path $uiAssetRoot 'overview.png') -Algorithm SHA256).Hash
Assert-UI ($uiFinalHash -eq '2D4375E63EC0B27502F0F875AB07F2BEE346F8786E4CF22D4A2C4A03E766FAA5') 'Final image matches reviewed revision'
$uiTokens = Get-Content -LiteralPath (Join-Path $uiAssetRoot 'design-tokens.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$uiApprovedColors = @('#527A63', '#F5F3EC', '#25382E')
$uiTokenColors = @($uiTokens.palette.PSObject.Properties | ForEach-Object { $_.Value })
Assert-UI ($uiTokens.maxBaseColors -eq 3 -and $uiTokenColors.Count -eq 3 -and @($uiTokenColors | Select-Object -Unique).Count -eq 3) 'Exactly three source colors'
Assert-UI (@($uiTokenColors | Where-Object { $_ -notin $uiApprovedColors }).Count -eq 0) 'Source colors match approved soft green palette'
Assert-UI ($uiTokens.typography.pageTitle -gt $uiTokens.typography.sectionTitle -and $uiTokens.typography.sectionTitle -gt $uiTokens.typography.body -and $uiTokens.typography.body -gt $uiTokens.typography.metadata) 'Typography has descending readable hierarchy'
Assert-UI ($uiTokens.typography.metadata -ge 13 -and $uiTokens.layout.touchTargetMin -ge 44) 'Minimum type and touch sizes recorded'
Assert-UI ($uiTokens.layout.cardRadius -eq 8 -and $uiTokens.layout.controlRadius -eq 6) 'Small radii recorded'
$uiSvgRaw = Get-Content -LiteralPath (Join-Path $uiAssetRoot 'icons.svg') -Raw -Encoding UTF8
[xml]$uiSvg = $uiSvgRaw
$uiSymbols = @($uiSvg.SelectNodes("//*[local-name()='symbol']"))
Assert-UI ($uiSymbols.Count -eq $uiTokens.icons.count -and $uiSymbols.Count -eq 20) 'All twenty SVG icons available'
$uiSymbolIds = @($uiSymbols | ForEach-Object { $_.GetAttribute('id') })
Assert-UI (@($uiSymbolIds | Select-Object -Unique).Count -eq $uiSymbols.Count) 'SVG symbol IDs are unique'
Assert-UI (@($uiSymbols | Where-Object { $_.GetAttribute('viewBox') -ne '0 0 24 24' }).Count -eq 0) 'Every icon uses the shared 24px grid'
Assert-UI ($uiSvg.DocumentElement.GetAttribute('stroke-width') -eq '1.75' -and $uiSvg.DocumentElement.GetAttribute('stroke') -eq 'currentColor') 'SVG stroke system matches specification'
$uiSvgColors = @([regex]::Matches($uiSvgRaw, '#[0-9a-fA-F]{6}\b') | ForEach-Object { $_.Value })
Assert-UI (@($uiSvgColors | Where-Object { $_ -notin $uiApprovedColors }).Count -eq 0) 'SVG uses no unapproved colors'
Assert-UI ($uiSvg.SelectNodes("//*[local-name()='script' or local-name()='image' or local-name()='foreignObject']").Count -eq 0) 'SVG contains only vector content without scripts or embedded raster'
foreach ($uiUse in $uiSvg.SelectNodes("//*[local-name()='use']")) {
    $uiReference = $uiUse.GetAttribute('href')
    Assert-UI ($uiReference.StartsWith('#') -and $uiReference.Substring(1) -in $uiSymbolIds) "SVG preview reference resolves: $uiReference"
}
$uiPrd = Get-Content -LiteralPath (Join-Path $uiRepoRoot 'docs\prd.md') -Raw -Encoding UTF8
Assert-UI ($uiTokens.screens.Count -eq 6) 'Six approved core screens recorded'
foreach ($uiScreen in $uiTokens.screens) {
    foreach ($uiPage in $uiScreen.prd) {
        Assert-UI ($uiPrd.Contains("| $uiPage |")) "Screen $($uiScreen.id) references an actual PRD page: $uiPage"
    }
}
Assert-UI ($uiTokens.screens[2].viewer -eq 'publisher') 'Candidate selection screen is explicitly publisher view'
$uiDoc = Get-Content -LiteralPath $uiDocPath -Raw -Encoding UTF8
Assert-UI ($uiDoc.Contains($uiFinalHash)) 'Design document identifies the exact reviewed PNG'
foreach ($uiLink in [regex]::Matches($uiDoc, '\]\(([^)]+)\)')) {
    $uiTarget = $uiLink.Groups[1].Value
    $uiLinkedPath = Join-Path (Split-Path -Parent $uiDocPath) $uiTarget
    Assert-UI (Test-Path -LiteralPath $uiLinkedPath) "Design document link resolves: $uiTarget"
}
$uiRequiredCopy = @('微信已登录', '资格待核验', '138****0000', '双方直接结算', '态度', '效率', '沟通', '图文审核通过后公开', '评分与图文审核状态分开', '基础展示免费', '自愿购买推广')
foreach ($uiCopy in $uiRequiredCopy) {
    Assert-UI ($uiDoc.Contains($uiCopy)) "Exact implementation copy preserved: $uiCopy"
}
Write-Output "UI resource validation passed: $uiPassed checks."

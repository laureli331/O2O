param()
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$uiV2Root = Split-Path -Parent $PSScriptRoot
$uiV2Assets = Join-Path $uiV2Root 'assets\ui\v2'
$uiV2DocPath = Join-Path $uiV2Root 'docs\ui-design-v2.md'
$uiV2Passed = 0
function Assert-UIV2([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
    $script:uiV2Passed++
    Write-Output "PASS: $Message"
}
$uiV2Names = @('overview.png', 'overview-before-spacing.png', 'design-tokens.json', 'icons.svg', 'generation-prompt.txt', 'spacing-refinement-prompt.txt')
$uiV2Missing = @($uiV2Names | Where-Object {
    $uiV2File = Join-Path $uiV2Assets $_
    -not (Test-Path -LiteralPath $uiV2File) -or ((Get-Item -LiteralPath $uiV2File).Length -eq 0)
})
Assert-UIV2 ($uiV2Missing.Count -eq 0) 'Every revision asset exists and is nonempty'
Add-Type -AssemblyName System.Drawing
foreach ($uiV2Name in @('overview.png', 'overview-before-spacing.png')) {
    $uiV2Path = Join-Path $uiV2Assets $uiV2Name
    $uiV2Bytes = [IO.File]::ReadAllBytes($uiV2Path)
    Assert-UIV2 ([BitConverter]::ToString($uiV2Bytes[0..7]) -eq '89-50-4E-47-0D-0A-1A-0A') "PNG signature: $uiV2Name"
    $uiV2Bitmap = [System.Drawing.Image]::FromFile($uiV2Path)
    try { Assert-UIV2 ($uiV2Bitmap.Width -ge 1000 -and $uiV2Bitmap.Height -ge 1400) "PNG decodes at overview size: $uiV2Name" }
    finally { $uiV2Bitmap.Dispose() }
}
$uiV2Hash = (Get-FileHash -LiteralPath (Join-Path $uiV2Assets 'overview.png') -Algorithm SHA256).Hash
Assert-UIV2 ($uiV2Hash -eq '252EECDA040DA95AAD582DEB83944DA9AC051E8FD68F5A62E27476E93B6C21E4') 'Nonselected spacing candidate remains unchanged'
$uiV2Tokens = Get-Content -LiteralPath (Join-Path $uiV2Assets 'design-tokens.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$uiV2Colors = @($uiV2Tokens.palette.PSObject.Properties | ForEach-Object { $_.Value })
$uiV2Approved = @('#618872', '#FCFBF7', '#263A31')
Assert-UIV2 ($uiV2Colors.Count -eq 3 -and @($uiV2Colors | Select-Object -Unique).Count -eq 3 -and @($uiV2Colors | Where-Object { $_ -notin $uiV2Approved }).Count -eq 0) 'Three approved UI source colors, including lighter ivory'
Assert-UIV2 ($uiV2Tokens.paletteScope -eq 'UI-components-only' -and $uiV2Tokens.photography.naturalColor -and -not $uiV2Tokens.photography.restrictedToUIPalette) 'Natural-color photographs are explicitly exempt'
$uiV2IvoryLuma = 0.2126 * 252 + 0.7152 * 251 + 0.0722 * 247
$uiV1IvoryLuma = 0.2126 * 245 + 0.7152 * 243 + 0.0722 * 236
Assert-UIV2 ($uiV2IvoryLuma -gt $uiV1IvoryLuma) 'New ivory is lighter than the previous source color'
Assert-UIV2 ($uiV2Tokens.layout.outerMargin -ge 28 -and $uiV2Tokens.layout.sectionGap -ge 32 -and $uiV2Tokens.layout.cardPadding -ge 24) 'Expanded margins, section gaps and padding are recorded'
Assert-UIV2 ($uiV2Tokens.layout.overflow -eq 'vertical-scroll' -and $uiV2Tokens.layout.avoidFitAllContent -and $uiV2Tokens.effects.screenshots.reduceVisibleRecords) 'Scrolling is used instead of compressing all content'
Assert-UIV2 ($uiV2Tokens.layout.cardRadius -eq 8 -and $uiV2Tokens.layout.controlRadius -eq 6) 'Small corners retained'
Assert-UIV2 ($uiV2Tokens.typography.body -ge 16 -and $uiV2Tokens.typography.metadata -ge 13 -and $uiV2Tokens.typography.pageTitle -gt $uiV2Tokens.typography.sectionTitle) 'Text hierarchy and readable minimums retained'
Assert-UIV2 ($uiV2Tokens.effects.glass.surfaceOpacity -gt 0 -and $uiV2Tokens.effects.glass.surfaceOpacity -lt 1 -and $uiV2Tokens.effects.glass.backdropBlur -gt 0 -and $uiV2Tokens.effects.glass.visibleBackdropRequired -and $uiV2Tokens.effects.glass.sharpText) 'Glass specification requires transparency, backdrop blur and sharp text'
$uiV2Stops = @($uiV2Tokens.effects.gradient.stops)
Assert-UIV2 ($uiV2Stops.Count -ge 2 -and $uiV2Stops[0].opacity -ne $uiV2Stops[1].opacity -and @($uiV2Stops | Where-Object { $_.color -ne 'green' }).Count -eq 0) 'Gradient has different stops within the approved green source'
$uiV2SvgRaw = Get-Content -LiteralPath (Join-Path $uiV2Assets 'icons.svg') -Raw -Encoding UTF8
[xml]$uiV2Svg = $uiV2SvgRaw
$uiV2Symbols = @($uiV2Svg.SelectNodes("//*[local-name()='symbol']"))
$uiV2Ids = @($uiV2Symbols | ForEach-Object { $_.GetAttribute('id') })
Assert-UIV2 ($uiV2Symbols.Count -eq 20 -and @($uiV2Ids | Select-Object -Unique).Count -eq 20) 'All twenty vector icon IDs are present and unique'
$uiV2BadReferences = @($uiV2Svg.SelectNodes("//*[local-name()='use']") | Where-Object { $_.GetAttribute('href').TrimStart('#') -notin $uiV2Ids })
Assert-UIV2 ($uiV2BadReferences.Count -eq 0 -and $uiV2Svg.SelectNodes("//*[local-name()='use']").Count -eq 20) 'Every icon preview reference resolves'
$uiV2SvgColors = @([regex]::Matches($uiV2SvgRaw, '#[0-9a-fA-F]{6}\b') | ForEach-Object { $_.Value })
Assert-UIV2 (@($uiV2SvgColors | Where-Object { $_ -notin $uiV2Approved }).Count -eq 0) 'SVG icon sources use only approved UI colors'
Assert-UIV2 ($uiV2Svg.SelectNodes("//*[local-name()='script' or local-name()='image' or local-name()='foreignObject']").Count -eq 0) 'SVG remains vector content without script or embedded raster'
$uiV2Prd = Get-Content -LiteralPath (Join-Path $uiV2Root 'docs\prd.md') -Raw -Encoding UTF8
$uiV2BadMappings = @($uiV2Tokens.screens | ForEach-Object { $_.prd } | Where-Object { -not $uiV2Prd.Contains("| $_ |") })
Assert-UIV2 ($uiV2Tokens.screens.Count -eq 6 -and $uiV2BadMappings.Count -eq 0 -and $uiV2Tokens.screens[2].viewer -eq 'publisher') 'Six page mappings and publisher selection view remain valid'
$uiV2Doc = Get-Content -LiteralPath $uiV2DocPath -Raw -Encoding UTF8
$uiV2BrokenLinks = @([regex]::Matches($uiV2Doc, '\]\(([^)]+)\)') | Where-Object {
    -not (Test-Path -LiteralPath (Join-Path (Split-Path -Parent $uiV2DocPath) $_.Groups[1].Value))
})
Assert-UIV2 ($uiV2BrokenLinks.Count -eq 0 -and $uiV2Doc.Contains($uiV2Hash)) 'Document links resolve and preserve candidate history'
Assert-UIV2 ($uiV2Tokens.status -eq 'approved-visual-direction') 'Design variables record user approval'
$uiSelectionRoot = Join-Path $uiV2Root 'assets\ui'
$uiSelection = Get-Content -LiteralPath (Join-Path $uiSelectionRoot 'approved-selection.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$uiSelectedPath = Join-Path $uiSelectionRoot $uiSelection.image
$uiSelectionReferences = @($uiSelection.image, $uiSelection.designTokens, $uiSelection.svgIcons, $uiSelection.designDocument, $uiSelection.nonselectedCandidate)
$uiSelectionBroken = @($uiSelectionReferences | Where-Object { -not (Test-Path -LiteralPath (Join-Path $uiSelectionRoot $_)) })
Assert-UIV2 ($uiSelection.status -eq 'approved' -and $uiSelectionBroken.Count -eq 0 -and $uiSelection.image -eq ('v2/' + $uiV2Tokens.approvedOverview) -and $uiSelection.image -ne $uiSelection.nonselectedCandidate) 'Approved image and related assets resolve without choosing the other candidate'
$uiSelectedFileHash = (Get-FileHash -LiteralPath $uiSelectedPath -Algorithm SHA256).Hash
Assert-UIV2 ($uiSelectedFileHash -eq $uiSelection.imageSha256) 'Approved image file matches the recorded selection'
$uiSelectedBitmap = [System.Drawing.Bitmap]::new($uiSelectedPath)
try {
    $uiSelectedRect = [System.Drawing.Rectangle]::new(0, 0, $uiSelectedBitmap.Width, $uiSelectedBitmap.Height)
    $uiSelectedData = $uiSelectedBitmap.LockBits($uiSelectedRect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
        $uiSelectedPixels = [byte[]]::new([Math]::Abs($uiSelectedData.Stride) * $uiSelectedData.Height)
        [Runtime.InteropServices.Marshal]::Copy($uiSelectedData.Scan0, $uiSelectedPixels, 0, $uiSelectedPixels.Length)
        $uiSelectedHasher = [Security.Cryptography.SHA256]::Create()
        try { $uiSelectedPixelHash = [BitConverter]::ToString($uiSelectedHasher.ComputeHash($uiSelectedPixels)).Replace('-', '') }
        finally { $uiSelectedHasher.Dispose() }
        Assert-UIV2 ($uiSelectedPixelHash -eq $uiSelection.decodedArgbSha256 -and $uiSelectedBitmap.Width -eq $uiSelection.width -and $uiSelectedBitmap.Height -eq $uiSelection.height) 'Selected image matches the approved attachment pixel fingerprint and dimensions'
    } finally { $uiSelectedBitmap.UnlockBits($uiSelectedData) }
} finally { $uiSelectedBitmap.Dispose() }
Assert-UIV2 ($uiV2Doc.Contains($uiSelection.userDecision) -and $uiV2Doc.Contains($uiSelection.imageSha256) -and $uiV2Doc.Contains($uiSelection.decodedArgbSha256)) 'Design document agrees with the actual user selection'
Assert-UIV2 ((Test-Path -LiteralPath (Join-Path $uiV2Root 'assets\ui\v1\overview.png')) -and (Test-Path -LiteralPath (Join-Path $uiV2Root 'docs\ui-design-v1.md'))) 'Previous version is retained'
Write-Output "UI v2 resource validation passed: $uiV2Passed checks."

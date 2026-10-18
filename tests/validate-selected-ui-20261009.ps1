$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root 'assets\ui\selected-20261009'
$record = Get-Content -LiteralPath (Join-Path $dir 'selection.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$file = Join-Path $dir $record.image
if ((Get-FileHash -LiteralPath $file).Hash -ne 'A73C4D802FBE91900CF9D1E751AB1C45391B7FD10C1868476BDF392605EEE011' -or $record.imageSha256 -ne $record.attachmentSha256) { throw 'Selected attachment differs' }
$bytes = [IO.File]::ReadAllBytes($file)
if ([BitConverter]::ToString($bytes[0..7]) -ne '89-50-4E-47-0D-0A-1A-0A') { throw 'Invalid PNG signature' }
Add-Type -AssemblyName System.Drawing
$img = [Drawing.Image]::FromFile($file)
try { if ($img.Width -ne $record.width -or $img.Height -ne $record.height) { throw 'Dimensions mismatch' } } finally { $img.Dispose() }
if ($record.status -ne 'user-selected' -or $record.transformed -ne $false -or -not (Test-Path -LiteralPath (Join-Path $dir 'README.md'))) { throw 'Invalid selection record' }
Write-Output 'PASS: Exact attachment hash, PNG signature, dimensions, unmodified user selection and document.'

$handoff = Join-Path $root 'assets\ui\development-handoff-20261009'
$manifest = Get-Content -LiteralPath (Join-Path $handoff 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$content = Get-Content -LiteralPath (Join-Path $handoff 'content.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$expectedNav = @('首页', '发现', '发布', '服务', '我的')
if (($content.labels.navigation -join '/') -ne ($expectedNav -join '/')) { throw 'Navigation copy differs from approved order' }
if (($manifest.navigation.label -join '/') -ne ($expectedNav -join '/')) { throw 'Generated navigation differs from approved order' }
if ($manifest.iconCount -ne 23 -or $manifest.standaloneIconCount -ne 46) { throw 'Discovery icon resources are incomplete' }
$discover = Get-Content -LiteralPath (Join-Path $handoff 'icons\icon-discover.svg') -Raw -Encoding UTF8
if ($discover -notmatch '<circle cx="12" cy="12" r="8\.5"/>' -or $discover -notmatch 'M14\.75 9\.25') { throw 'Approved option A compass geometry is missing' }
Write-Output 'PASS: Approved navigation order, option A compass and generated icon counts.'

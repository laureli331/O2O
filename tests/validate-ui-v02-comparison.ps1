$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root 'assets\ui\v02-comparison-20261009'
$record = Get-Content -LiteralPath (Join-Path $dir 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
Add-Type -AssemblyName System.Drawing
foreach ($variant in @('a','b')) {
 $item = $record.variants.$variant
 $file = Join-Path $dir "$variant\overview.png"
 $bytes = [IO.File]::ReadAllBytes($file)
 if ([BitConverter]::ToString($bytes[0..7]) -ne '89-50-4E-47-0D-0A-1A-0A') { throw "$variant PNG signature" }
 if ((Get-FileHash -LiteralPath $file).Hash -ne $item.sha256) { throw "$variant hash" }
 $img = [Drawing.Image]::FromFile($file)
 try { if ($img.Width -ne $item.width -or $img.Height -ne $item.height -or $img.Height -le $img.Width) { throw "$variant dimensions" } } finally { $img.Dispose() }
 foreach ($prompt in $item.prompts) { if ((Get-Item -LiteralPath (Join-Path $dir "$variant\$prompt")).Length -eq 0) { throw "$variant empty prompt" } }
 Write-Output "PASS: $variant format, hash, dimensions and prompts"
}
foreach ($name in @('original.png','layout-reference.jpg','README.md')) { if ((Get-Item -LiteralPath (Join-Path $dir $name)).Length -eq 0) { throw "Missing $name" } }
if ((Get-FileHash -LiteralPath (Join-Path $dir 'original.png')).Hash -ne $record.originalSha256) { throw 'Original reference mismatch' }
if ($record.method -ne 'built-in-imagegen' -or $record.pageCount -ne 5) { throw 'Metadata mismatch' }
Write-Output 'PASS: input retention and metadata. Layout/text visually reviewed; no automated OCR claim.'

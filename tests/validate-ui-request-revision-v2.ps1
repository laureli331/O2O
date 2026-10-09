$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root 'assets\ui\request-revision-20261009-v2'
$record = Get-Content -LiteralPath (Join-Path $dir 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$file = Join-Path $dir 'overview.png'
$bytes = [IO.File]::ReadAllBytes($file)
if ([BitConverter]::ToString($bytes[0..7]) -ne '89-50-4E-47-0D-0A-1A-0A') { throw 'PNG signature invalid' }
if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $record.sha256) { throw 'Final image hash mismatch' }
Add-Type -AssemblyName System.Drawing
$img = [Drawing.Image]::FromFile($file)
try { if ($img.Width -ne $record.width -or $img.Height -ne $record.height -or $img.Height -le $img.Width) { throw 'Portrait image dimensions mismatch' } } finally { $img.Dispose() }
foreach ($name in @('original.png','generation-prompt.txt','README.md')) {
 if (-not (Test-Path -LiteralPath (Join-Path $dir $name)) -or (Get-Item -LiteralPath (Join-Path $dir $name)).Length -eq 0) { throw "Missing artifact: $name" }
}
if ((Get-FileHash -LiteralPath (Join-Path $dir 'original.png') -Algorithm SHA256).Hash -ne $record.originalSha256) { throw 'Original reference hash mismatch' }
if ($record.userRequirements -ne 12 -or $record.method -ne 'built-in-imagegen') { throw 'Revision metadata mismatch' }
Write-Output 'PASS: PNG signature, final hash, portrait dimensions, preserved references/prompts, original hash and revision metadata.'
Write-Output 'Text and layout: manual visual review recorded; no automated OCR claim.'

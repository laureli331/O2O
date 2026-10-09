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

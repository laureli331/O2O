param([Parameter(Mandatory = $true)][string]$ZipPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
try {
  $allowed = @('egress-ip-manifest.json', 'source-manifest.json', 'source.csr.pem')
  if ($archive.Entries.Count -ne 3) { throw 'artifact-entry-count-invalid' }
  $result = [ordered]@{}
  foreach ($entry in $archive.Entries) {
    if ($entry.FullName -notin $allowed -or $entry.FullName.Contains('/') -or $entry.FullName.Contains('\') -or $entry.Length -gt 65536) { throw 'artifact-entry-invalid' }
    $stream = $entry.Open()
    try {
      $memory = [System.IO.MemoryStream]::new()
      try {
        $stream.CopyTo($memory)
        if ($memory.Length -ne $entry.Length -or $memory.Length -gt 65536) { throw 'artifact-entry-size-invalid' }
        $result[$entry.FullName] = [Convert]::ToBase64String($memory.ToArray())
      } finally { $memory.Dispose() }
    } finally { $stream.Dispose() }
  }
  if ($result.Count -ne 3) { throw 'artifact-files-incomplete' }
  [Console]::Out.Write(($result | ConvertTo-Json -Compress))
} catch {
  [Console]::Error.WriteLine('source-artifact-rejected')
  exit 1
} finally { $archive.Dispose() }

param(
    [string]$InstallPath = 'E:\O2O\.local\tools\wechat-devtools',
    [string]$ExpectedVersion = '2.02.2608080'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$toolChecks = 0

function Assert-Tool([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
    $script:toolChecks++
    Write-Output "PASS: $Message"
}

Assert-Tool (Test-Path -LiteralPath $InstallPath -PathType Container) 'Developer tools installation directory exists'
$toolExecutable = Join-Path $InstallPath '微信开发者工具.exe'
$toolCli = Join-Path $InstallPath 'cli.bat'
$toolPackage = Join-Path $InstallPath 'resources\app.asar.unpacked\package.json'
foreach ($required in @($toolExecutable, $toolCli, $toolPackage, (Join-Path $InstallPath '卸载微信开发者工具.exe'))) {
    Assert-Tool (Test-Path -LiteralPath $required -PathType Leaf) "Installed component exists: $([IO.Path]::GetFileName($required))"
}
$package = Get-Content -Raw -LiteralPath $toolPackage -Encoding UTF8 | ConvertFrom-Json
Assert-Tool ($package.name -eq '微信开发者工具') 'Installed application identifies itself as WeChat developer tools'
Assert-Tool ($package.version -eq $ExpectedVersion) 'Installed application package matches the verified stable version'
$signature = Get-AuthenticodeSignature -LiteralPath $toolExecutable
Assert-Tool ($signature.Status -eq 'Valid') 'Installed executable Authenticode signature is valid'
Assert-Tool ($signature.SignerCertificate.Subject -match 'CN=Tencent Technology \(Shenzhen\) Company Limited(?:,|$)') 'Installed executable is signed by Tencent'
$toolHelp = @(& $toolCli --help 2>&1)
$toolExitCode = $LASTEXITCODE
Assert-Tool ($toolExitCode -eq 0) 'Installed CLI help exits successfully'
$toolHelpText = $toolHelp -join "`n"
foreach ($command in @('cli cloud', 'cli open', 'cli login', 'cli auto')) {
    Assert-Tool ($toolHelpText.Contains($command)) "Installed CLI advertises command: $command"
}
Write-Output "Developer tools installation validation passed: $toolChecks checks. Login, project permissions and cloud deployment are not verified by this check."

param([Parameter(Mandatory=$true)][string]$CsrPath, [Parameter(Mandatory=$true)][string]$KeyPath)
$ErrorActionPreference = 'Stop'
$rsa = [System.Security.Cryptography.RSA]::Create(2048)
try {
    $request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=o2o-a303-offline-csr', $rsa, [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
    $csr = $request.CreateSigningRequestPem()
    $key = $rsa.ExportPkcs8PrivateKeyPem()
    [System.IO.File]::WriteAllText($CsrPath, $csr, [System.Text.Encoding]::ASCII)
    [System.IO.File]::WriteAllText($KeyPath, $key, [System.Text.Encoding]::ASCII)
} finally {
    $rsa.Dispose()
}

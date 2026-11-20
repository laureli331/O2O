$ErrorActionPreference = 'Stop'
$inputStream = [Console]::OpenStandardInput()
$buffer = [byte[]]::new(65537)
$read = $inputStream.Read($buffer, 0, $buffer.Length)
if ($read -lt 1 -or $read -gt 65536) { throw 'CSR size limit exceeded.' }
$pem = [System.Text.Encoding]::ASCII.GetString($buffer, 0, $read)
$request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::LoadSigningRequestPem(
    $pem,
    [System.Security.Cryptography.HashAlgorithmName]::SHA256,
    [System.Security.Cryptography.X509Certificates.CertificateRequestLoadOptions]::Default,
    [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
)
$spki = $request.PublicKey.ExportSubjectPublicKeyInfo()
if ($spki.Length -lt 1 -or $spki.Length -gt 4096) { throw 'CSR public key size limit exceeded.' }
[Console]::Out.Write([Convert]::ToBase64String($spki))

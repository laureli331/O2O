#!/usr/bin/env bash
set -euo pipefail
umask 077
ROOT=/opt/o2o-sp08-a303
CSR_B64='{{csr_b64}}'
SOURCE_RUN_ID='{{source_run_id}}'
[[ "$SOURCE_RUN_ID" =~ ^[1-9][0-9]{0,19}$ ]] || exit 20
[[ "$CSR_B64" =~ ^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$ ]] || exit 21
(( ${#CSR_B64} >= 4 && ${#CSR_B64} <= 90000 )) || exit 22
test -s "$ROOT/pki/ca.key.pem" && test -s "$ROOT/pki/ca.pem"
test -d "$ROOT/tmp" && test ! -e "$ROOT/tmp/client.csr.pem" && test ! -e "$ROOT/tmp/client.ext"
test ! -e "$ROOT/pki/client.pem"
OWNER="$ROOT/tmp/server-lifecycle-owner.json"
if test -e "$OWNER"; then
  grep -Fxq "{\"run_id\":\"$SOURCE_RUN_ID\"}" "$OWNER" || exit 23
else
  printf '{"run_id":"%s"}' "$SOURCE_RUN_ID" > "$OWNER"
fi
printf '%s' "$CSR_B64" | base64 -d > "$ROOT/tmp/client.csr.pem"
test "$(base64 -w0 "$ROOT/tmp/client.csr.pem")" = "$CSR_B64"
openssl req -in "$ROOT/tmp/client.csr.pem" -verify -noout >/dev/null 2>&1
printf 'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=clientAuth\n' > "$ROOT/tmp/client.ext"
openssl x509 -req -sha256 -days 1 -in "$ROOT/tmp/client.csr.pem" -CA "$ROOT/pki/ca.pem" -CAkey "$ROOT/pki/ca.key.pem" -CAcreateserial -extfile "$ROOT/tmp/client.ext" -out "$ROOT/pki/client.pem" >/dev/null 2>&1
printf 'csr_sha256='; sha256sum "$ROOT/tmp/client.csr.pem" | cut -d' ' -f1
printf 'leaf_cert_b64='; base64 -w0 "$ROOT/pki/client.pem"; printf '\nca_cert_b64='; base64 -w0 "$ROOT/pki/ca.pem"; printf '\n'

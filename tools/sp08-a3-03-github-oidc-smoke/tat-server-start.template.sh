#!/usr/bin/env bash
set -euo pipefail
umask 077
INPUT_B64='{{server_input_b64}}'
[[ "$INPUT_B64" =~ ^[A-Za-z0-9+/]+=*$ ]] || exit 20
ROOT=/opt/o2o-sp08-a303
TEMPLATE="$ROOT/tmp/server-template.json"
CONFIG="$ROOT/server-config.json"
test -s "$ROOT/tmp/github-jwks-public.json" && test -s "$ROOT/pki/client.pem"
test ! -e "$TEMPLATE" && test ! -e "$CONFIG"
printf '%s' "$INPUT_B64" | base64 -d > "$ROOT/server-public-input.json"
chmod 0600 "$ROOT/server-public-input.json"
"$ROOT/node-v24.22.3/bin/node" - "$ROOT/server-public-input.json" "$ROOT/pki" "$TEMPLATE" <<'NODE'
const fs = require('node:fs');
const crypto = require('node:crypto');
const [inputPath, pkiPath, outputPath] = process.argv.slice(2);
const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const policy = { ...input.policy,
  tlsKey: fs.readFileSync(`${pkiPath}/server.key.pem`, 'utf8'),
  tlsCert: fs.readFileSync(`${pkiPath}/server.pem`, 'utf8'),
  ca: fs.readFileSync(`${pkiPath}/ca.pem`, 'utf8'),
  allowedPeerFingerprints: [new crypto.X509Certificate(fs.readFileSync(`${pkiPath}/client.pem`)).fingerprint256.replaceAll(':', '').toLowerCase()] };
fs.writeFileSync(outputPath, JSON.stringify({ ...input, policy }), { flag: 'wx', mode: 0o600 });
NODE
"$ROOT/node-v24.22.3/bin/node" "$ROOT/server-code/jwks-handoff.cjs" assemble-local "$TEMPLATE" "$ROOT/tmp/github-jwks-public.json" "$CONFIG"
"$ROOT/node-v24.22.3/bin/node" "$ROOT/server-code/server-entry.cjs" --check-only "$ROOT/server-config.json"
nohup "$ROOT/node-v24.22.3/bin/node" "$ROOT/server-code/server-entry.cjs" --start-approved "$ROOT/server-config.json" >> "$ROOT/server.log" 2>&1 </dev/null &
echo $! > "$ROOT/server.pid"
PRIVATE_IPV4=$("$ROOT/node-v24.22.3/bin/node" -e "process.stdout.write(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8')).bindIPv4)" "$ROOT/server-public-input.json")
for attempt in 1 2 3 4 5; do
  if ss -lnt | grep -Fq "$PRIVATE_IPV4:8443"; then
    printf '%s\n' 'listener_ready=private_ipv4:8443'
    exit 0
  fi
  sleep 1
done
printf '%s\n' 'listener-not-ready' >&2
exit 21

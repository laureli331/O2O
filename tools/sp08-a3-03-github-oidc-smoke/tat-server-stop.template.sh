#!/usr/bin/env bash
set -euo pipefail
ROOT=/opt/o2o-sp08-a303
test -s "$ROOT/server.pid"
PID=$(cat "$ROOT/server.pid")
[[ "$PID" =~ ^[0-9]+$ ]]
ps -p "$PID" -o args= | grep -Fq "$ROOT/server-code/server-entry.cjs --start-approved $ROOT/server-config.json"
kill -TERM "$PID"
for attempt in 1 2 3 4 5; do
  if ! kill -0 "$PID" 2>/dev/null; then break; fi
  sleep 1
done
! kill -0 "$PID" 2>/dev/null
rm -f "$ROOT/pki/ca.key.pem" "$ROOT/pki/server.key.pem" "$ROOT/pki/server.csr.pem" "$ROOT/pki/ca.srl" "$ROOT/tmp/client.csr.pem" "$ROOT/tmp/client.ext" "$ROOT/tmp/client.pem" "$ROOT/server.pid"
test ! -e "$ROOT/pki/ca.key.pem" && test ! -e "$ROOT/pki/server.key.pem" && test ! -e "$ROOT/pki/server.csr.pem" && test ! -e "$ROOT/pki/ca.srl"
test ! -e "$ROOT/tmp/client.csr.pem" && test ! -e "$ROOT/tmp/client.ext" && test ! -e "$ROOT/tmp/client.pem" && test ! -e "$ROOT/server.pid"
printf '%s\n' 'server_stopped_and_keys_removed=true'

#!/usr/bin/env bash
set -u
ROOT=/opt/o2o-sp08-a303
SOURCE_RUN_ID='{{source_run_id}}'
STOP_STATE=unknown
PID=''
if [[ ! "$SOURCE_RUN_ID" =~ ^[1-9][0-9]{0,19}$ ]] || ! test -s "$ROOT/tmp/server-lifecycle-owner.json" \
  || ! grep -Fxq "{\"run_id\":\"$SOURCE_RUN_ID\"}" "$ROOT/tmp/server-lifecycle-owner.json"; then
  printf '%s\n' 'server_stop_state=unknown_owner_marker' >&2
  exit 33
fi
if test -s "$ROOT/server.pid"; then
  PID=$(cat "$ROOT/server.pid" 2>/dev/null || true)
  if [[ "$PID" =~ ^[0-9]+$ ]] && kill -0 "$PID" 2>/dev/null \
    && ps -p "$PID" -o args= | grep -Fq "$ROOT/server-code/server-entry.cjs --start-approved $ROOT/server-config.json"; then
    kill -TERM "$PID" 2>/dev/null || true
    for attempt in 1 2 3 4 5; do
      if ! kill -0 "$PID" 2>/dev/null; then STOP_STATE=stopped; break; fi
      sleep 1
    done
  elif [[ "$PID" =~ ^[0-9]+$ ]] && ! kill -0 "$PID" 2>/dev/null; then
    STOP_STATE=stopped
  fi
fi
rm -f "$ROOT/pki/ca.key.pem"
rm -f "$ROOT/pki/server.key.pem"
rm -f "$ROOT/pki/server.csr.pem"
rm -f "$ROOT/pki/ca.srl"
rm -f "$ROOT/tmp/client.csr.pem"
rm -f "$ROOT/tmp/client.ext"
rm -f "$ROOT/tmp/client.pem"
rm -f "$ROOT/pki/client.pem"
rm -f "$ROOT/tmp/server-template.json"
rm -f "$ROOT/server-config.json"
rm -f "$ROOT/server.pid"
rm -f "$ROOT/server-public-input.json"
rm -f "$ROOT/tmp/server-lifecycle-owner.json"
for secret_path in "$ROOT/pki/ca.key.pem" "$ROOT/pki/server.key.pem" "$ROOT/pki/server.csr.pem" "$ROOT/pki/ca.srl" "$ROOT/pki/client.pem" "$ROOT/tmp/client.csr.pem" "$ROOT/tmp/client.ext" "$ROOT/tmp/client.pem" "$ROOT/tmp/server-template.json" "$ROOT/server-config.json" "$ROOT/server.pid" "$ROOT/server-public-input.json" "$ROOT/tmp/server-lifecycle-owner.json"; do
  if test -e "$secret_path"; then
    printf '%s\n' 'server_stop_state=unknown_secret_cleanup_incomplete' >&2
    exit 31
  fi
done
if [[ "$STOP_STATE" != stopped ]]; then
  printf '%s\n' 'server_stop_state=unknown_pid_but_secrets_removed'
  exit 32
fi
printf '%s\n' 'server_stopped_and_keys_removed=true'

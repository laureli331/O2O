# A3-03 server lifecycle adapter (offline)

## Verification plan and reuse

Before implementation, compared `server-entry.cjs`, `prepare-a-runner.cjs`, `jwks-handoff.cjs`, `return-bundle.cjs`, `verify-return.cjs`, the TAT/VPC adapter and its fixtures with the operator scripts dated 2026-11-24. The existing adapter already binds a source artifact to an in-progress run, verifies run/attempt/workflow SHA/CSR and egress, provides bounded TAT task polling, and leases/removes only its marked ingress rule. `server-entry.cjs` validates the 15-minute authorization and JWKS snapshot; `return-bundle.cjs` builds the already-defined return artifact. This change reuses those boundaries and adds no package or CAM action.

Validation: `node --test *.test.cjs`; offline transport observes start Invoke → exact task/readiness result → return submission → wait for source-run/attempt/workflow-bound caller TLS terminal evidence → stop Invoke → exact stop/cleanup result. A built return artifact alone does not trigger stop. Unknown Invoke/task results are never retried; one stop attempt is made even when start outcome is unknown. The adapter accepts only source materials minted by the existing verified-artifact selector. Existing VPC lease cleanup remains owned by `withIngressRule` and runs in its `finally` path, including when stop fails.

Start invocation and task polling share the actual remainder of the five-minute source, five-minute egress, ten-minute job, JWKS, authorization and 1h45 resource windows. Stop is bounded by the original authorization/resource cleanup deadline and its own remaining TAT timeout; it does not reset the source or resource window.

## Operator command templates

`tat-server-start.template.sh` and `tat-server-stop.template.sh` are review templates only. Create two reviewed, immutable TAT command records scoped to the dedicated CVM before any separately authorized real run. Their runtime `CommandId` values are required inputs to `validateLifecycleTargets`; placeholders, equal IDs, and missing values fail closed. No command creation, CAM grant, or cloud call is part of this change.

The start command accepts only `server_input_b64`, base64-decodes to the fixed public input path with mode 0600, composes the local private TLS material, then calls the existing `jwks-handoff.cjs assemble-local` and `server-entry.cjs --check-only` before starting its approved listener. It emits exactly `listener_ready=private_ipv4:8443\n` only after observing the configured private IPv4 listener. The stop command targets only `/opt/o2o-sp08-a303`, verifies the PID belongs to the expected server entry, sends TERM, checks process exit, removes only the named run key/CSR/PID files, verifies their absence, and emits exactly `server_stopped_and_keys_removed=true\n`. API task polling checks invocation, command and instance binding, `SUCCESS`, exit code, non-dropped output, and exact stdout bytes. Arbitrary stdout is never treated as proof.

The adapter accepts the existing PowerShell prep script's public JSON shape and adds `sourceBinding` directly from its verified source-material object before encoding. It validates matching run/attempt/workflow SHA and CSR digest, matching run/attempt/repository fields in the OIDC/request policy, private CVM IPv4/interface, fixed port 8443, CLB IPv4, and an unexpired GitHub JWKS snapshot no older than its 15-minute limit. The full input is strict UTF-8 JSON encoded as canonical base64 before TAT parameter substitution; the shell template rejects non-base64 characters before decoding. CA/server private keys remain on the CVM; runner keys remain job-local.

## Reuse audit and limits

- **Adopted:** Tencent Cloud Node SDKs already pinned in this package, its injectable transport, existing verified-material WeakMap, bounded invocation/task behavior, SG lease recovery, server entry/JWKS handoff and return-bundle contract.
- **Adapted:** small lifecycle adapter and two command templates; no second harness, scheduler, dependency or SDK.
- **Sources:** Tencent TAT authorization and Invoke/Describe docs are linked in `tencentyun-a303-offline-draft.md` (checked 2026-11-24). The operator shell scripts are the local source protocol. Tencent SDK package versions remain 4.1.241/4.1.351/4.1.220 with uuid 11.1.1 override; no license/maintenance/compatibility surface changed.
- **Verification boundary:** offline fixtures prove request shape, order, bindings and fail-closed output parsing. This Windows host has no demonstrated Bash/Linux/CVM/TAT environment; listener readiness, process termination, key removal, 300-second operation timing, permissions and real service compatibility remain unverified. A3-03 remains `HOLD`.

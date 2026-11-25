# A3-03 operator entry (offline preparation)

`operator-entry.cjs` exports `checkOnly(config)` and `runOperatorEntry(config, secrets, options)`.

The public JSON config contains only explicit reviewed values: repository and numeric identity bindings, trusted workflow path/ref/SHA, source run ID and accepted creation interval, CA fingerprint, fixed signing/start/stop targets, serialized server input, public expected target, absolute journal path, and absolute `pwsh` path. `checkOnly` validates the static shape and server target agreement without network access, secret access, or SDK construction; it does not establish trust readiness.

Execution requires `options.enableExternalDispatch === true` and a separate `secrets` object with explicit `{ token, credential: { secretId, secretKey } }`. The CLI intentionally supports only `--check-only <public-config.json>` and never loads secrets. There is no credential discovery or secret-file format.

Execution verifies the source run and artifact through `verifySourceMaterials`, then passes its WeakMap-branded material into the existing `runOperatorFlow`. Return-run selection uses `waitForReturnRun`; TLS completion uses `awaitVerifiedCallerRun` against the source caller run. The offline integration fixture exercises this exact route through certificate verification, SDK-shaped requests, ingress lease, return POST, run binding, caller completion, stop, and lease removal. It does not call GitHub or Tencent Cloud.

The return selection and caller completion are bounded by the source, egress, caller-job, and original five-minute source window. A timeout during a return poll is treated as unknown and is not retried as a dispatch. A3-03 remains HOLD; real credentials, reviewed command IDs and target values, cloud permissions, and live behavior remain outside this offline entry.

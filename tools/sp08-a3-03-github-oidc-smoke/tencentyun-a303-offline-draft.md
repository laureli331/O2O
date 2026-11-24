# A3-03 Tencent Cloud permissions and offline runbook — DRAFT / NOT DEPLOYABLE

No cloud resources/IDs currently exist in this draft. No cloud action was performed. All placeholders must be replaced and policy semantics re-reviewed by an administrator before any later, separately authorized use.

## Proposed verification before any real run

1. Parse JSON and assert explicit DRAFT marker, placeholder/unresolved fields and action boundaries. These documents are not an executable deployment path; their NOTICE text and placeholders are not technical deployment controls. Any future executor must reject unresolved fields and placeholders.
2. Compare each action/resource pair with Tencent CAM service-interface tables and API input/output docs; mark unresolved CAM mappings as blocked from policy application.
3. Check fixed command content and parameter expansion in existing scripts; reject a design where user-controlled CSR text becomes shell syntax.
4. Map the eleven operator inputs (the 11 named procedure/input files in the mapping table; the bootstrap helper and ZIP bundle are excluded) to prep vs. 300-second caller window, including source-run-bound fields and recovery state.
5. Run only the existing offline tests relevant to template/input/return/egress; do not call Tencent APIs.

## Official evidence and boundaries (checked 2026-11-24)

- [TAT CAM examples](https://cloud.tencent.com/document/product/1340/56294) show `tat:InvokeCommand` and `tat:DescribeInvocationTasks` scoped to command and CVM resources; it distinguishes denying `CreateCommand`, `ModifyCommand`, `RunCommand`. Proposed use is a pre-created fixed command, never runtime command creation or RunCommand.
- [InvokeCommand API](https://cloud.tencent.com/document/product/1340/52678) accepts CommandId, InstanceIds (up to 200), Parameters JSON, returns InvocationId. Existing single-CVM command parameters can still be dangerous if interpolated into shell; pass CSR as base64 argument only, validate/decode in fixed script, never eval/source it. Existing `tat-sign-csr.sh` does base64 decode and OpenSSL CSR verification. The fixed-command implementation must be frozen/reviewed before use; this draft does not establish safe argument substitution behavior in the console.
- [DescribeInvocationTasks](https://cloud.tencent.com/document/product/1340/52680) takes task IDs or filters, `HideOutput` defaults true; query one invocation task and expose only filtered status/public certificate data. TAT output is limited to 24KB plain text, scripts max 64KB base64 and records retained 3 months ([TAT overview](https://cloud.tencent.com/document/api/1340/52695)). Avoid COS output. Never output keys; GitHub artifacts contain public CSR/cert/status only.
- [CAM VPC supported API table](https://cloud.tencent.com/document/product/598/98194) says `DescribeSecurityGroupPolicies` resource-level at `qcs::cvm::uin/${uin}:sg/${sgid}` and IP limitation supported. The official VPC CAM table marks `CreateSecurityGroupPolicies` and `DeleteSecurityGroupPolicies` as resource-level on `qcs::cvm:${region}:uin/${uin}:sg/${sgId}`, and IP restrictions are unsupported for these actions. CAM general IP syntax is `condition: { ip_equal: { "qcs:ip": ["<OPERATOR_EGRESS>/32"] } }` ([condition keys/operators](https://cloud.tencent.com/document/product/598/10608)); this constrains the API caller source only, and is omitted from the draft because these VPC actions are marked IP-limit unsupported. No CAM evidence was found for protocol/port/CIDR or request-count conditions. The API contracts confirm these actions accept SecurityGroupId plus policy set/index inputs ([add](https://cloud.tencent.com/document/product/215/15807), [delete](https://cloud.tencent.com/document/product/215/15809)); neither API contract constrains an authorized caller to a particular rule shape. API request fields include rule properties (protocol/port/CIDR) so an authorized SG mutator may potentially add broader rules; CAM IP restriction is caller source, not destination runner /32. Program must validate exact TCP/8443/runner-egress/32 and target dedicated SG, capture prior state, delete only newly created rule by ID/index, and independently verify rollback. No create SG/instance/CLB, account/role/policy/budget actions.
- `DescribeInvocations` resource granularity remains unresolved; the JSON contains an explicit unresolved resource placeholder (not `*`) and no condition. Do not grant this action until its CAM resource scope is confirmed.
- [TAT API source SDK](https://github.com/TencentCloud/tencentcloud-sdk-nodejs) is not installed or invoked. Official API docs are the basis here; no local SDK source was available to verify. No dependency added.

## Input mapping (11 operator inputs/files)

| Input | Prep or 300s window | Provenance/meaning |
|---|---|---|
| `server-public-input.template.json` | prep | placeholders; runtime values later come from verified run, CSR, egress and CVM/CLB outputs |
| `prepare-server-input.ps1` | prep + 300s | requires caller run ID, artifact dir, leaf cert, CVM private IP/interface, CLB IPv4, JWKS file; reads manifest source_run_id/commit/attempt and CSR digest |
| `prepare-github-vars.ps1` | prep | creates expected policy claims and 14-minute expiry; workflow SHA/ref and repo/actor fields are pinned constants |
| `verify-source-egress.ps1` | 300s | consumes actual source run ID + manifest/CSR digest + egress manifest; produces verified /32 |
| `dispatch-caller-once.ps1` | prep | refuses if caller workflow run exists; dispatch exactly once |
| `dispatch-return-once.ps1` | 300s | binds return to source run/job/attempt/SHA/CSR digest; refuses second return dispatch |
| `revoke-github-vars.ps1` | recovery | deletes only the two named repo variables and verifies absence |
| `tat-sign-csr.sh` | 300s | accepts public CSR base64; outputs CSR SHA-256, leaf cert and CA cert base64; private CA key remains on CVM |
| `tat-build-check-start-server.sh` | 300s | installs configured public inputs, check-only, starts private 8443 listener and checks readiness |
| `tat-stop-and-key-cleanup.txt` | recovery | exact stop and key-file deletion commands; invoke individually, confirm process stopped and keys absent |
| `tat-install-server-code.sh` | prep | installs packaged server code; verify pinned source/package digest before later authorized use |

Three separate time budgets remain hard: CSR return 300s, egress validity 5m, JWKS authorization 15m, job deadline 10m. None has been relaxed; no latency guarantee is claimed.

## Offline sequence and recovery

Prep: fixed command/SG identity established by an authorized operator later; inspect clean fixed command; prepare short-lived child identity; dispatch caller once. During caller window: obtain real caller run/attempt/workflow SHA from GitHub, validate source artifact and CSR digest, verify runner's egress manifest to /32, sign CSR on CVM through fixed TAT command, add only TCP/8443 from that /32 to the dedicated SG, start service, then obtain public cert/status via invocation task output. Existing return script dispatches once with actual source fields. On timeout/unknown dispatch outcome, query existing run/InvocationId/task ID first; do not redispatch, resign, or remove a rule until state is known. If listener started, stop it and remove only the rule created by this attempt; if outcome cannot be established, stop new operations, do not redispatch/resign, and use the existing absolute 1-hour resource / 45-minute cleanup deadline: conservatively revoke temporary access and clean up known resources within that deadline, recording unknown state and cleanup evidence; do not retain resources beyond it. Existing returned materials are checked before source workflow poll. No private key in artifact.

## Identity, decisions, next unit

Use a purpose-limited sub-user/role and temporary credentials/STS if supported for the selected operator path; never long-lived root key or chat-pasted SecretKey. Administrator must later supply account UIN, region, fixed command ID/content review, one CVM ID, dedicated SG ID, and choose whether a human operator or a supported short-lived federation path performs actions. Do not create identity or grant access here. First executable unit after review/authorization: confirm CAM mappings and command parameter behavior, then offline policy parser/test; only a later specific authorization can allow API calls. A3-03 remains HOLD; no CloudBase/harness/deploy/SP09.

## Reuse and validation

Reuses existing TAT scripts, source/return workflow, CSR handoff, egress verification and tests; no new SDK/CLI/dependency. Official docs are Tencent primary sources; no third-party implementation adopted. Compatible with current Node validation toolchain because no runtime code changed. Validation must parse the draft and assert placeholders, action allowlist and wildcard boundary. Existing egress/JWKS tests remain the relevant runtime evidence; they do not prove Tencent IAM enforcement or API latency.


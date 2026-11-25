# A3-03 Tencent Cloud permissions and offline runbook — DRAFT / NOT DEPLOYABLE

No cloud resources/IDs currently exist in this draft. No cloud action was performed. All placeholders must be replaced and policy semantics re-reviewed by an administrator before any later, separately authorized use.

## Proposed verification before any real run

1. Parse JSON and assert explicit DRAFT marker, placeholder/unresolved fields and action boundaries. These documents are not an executable deployment path; their NOTICE text and placeholders are not technical deployment controls. Any future executor must reject unresolved fields and placeholders.
2. Compare each action/resource pair with Tencent CAM service-interface tables and API input/output docs; mark unresolved CAM mappings as blocked from policy application.
3. Check fixed command content and parameter expansion in existing scripts; reject a design where user-controlled CSR text becomes shell syntax.
4. Map the eleven operator inputs (the 11 named procedure/input files in the mapping table; the bootstrap helper and ZIP bundle are excluded) to prep vs. 300-second caller window, including source-run-bound fields and recovery state.
5. Run only the existing offline tests relevant to template/input/return/egress; do not call Tencent APIs.

## Official evidence and boundaries (checked 2026-11-24)

- [TAT CAM authorization table](https://intl.cloud.tencent.com/zh/document/product/598/57156?lang=zh) lists InvokeCommand resources as command and CVM/Lighthouse instance, and DescribeInvocationTasks resources as command and CVM/Lighthouse instance. Each resource ARN includes ${region}. The JSON uses separate action statements with CVM-only resources: qcs::tat:<REGION>:uin/<ACCOUNT_ID>:command/<FIXED_COMMAND_ID> and qcs::cvm:<REGION>:uin/<ACCOUNT_ID>:instance/<ONE_CVM_ID>. Do not add RunCommand, CreateCommand, or ModifyCommand to the operator identity. The [TAT CAM examples](https://cloud.tencent.com/document/product/1340/56294) likewise show denying those arbitrary command paths.
- [InvokeCommand](https://cloud.tencent.com/document/product/1340/52678) accepts a CommandId, InstanceIds (maximum 200), Parameters JSON and returns an InvocationId. [DescribeInvocationTasks](https://cloud.tencent.com/document/product/1340/52680) can filter by invocation-id, returns per-instance task status/output and defaults HideOutput=true. This covers the single-CVM lifecycle; no DescribeInvocations permission is needed. The TAT CAM table also lists DescribeInvocations at command-resource granularity, if future aggregate status is explicitly needed.
- TAT [RunCommand parameter docs](https://cloud.tencent.com/document/product/1340/52676) describe double-brace key placeholder substitution before command execution; CreateCommand can enable custom parameters and InvokeCommand.Parameters supplies values (up to 20 string parameters). Docs do not promise shell escaping. Existing tat-sign-csr.sh decodes argument 1 from base64 into a fixed file, runs openssl req -verify, then signs and emits only CSR digest and public certificates.

  Candidate pinned shell template: CSR_B64='{{csr_b64}}'; validate alphabet/size; decode to fixed file; openssl req -verify; sign; emit allowlisted public outputs.

  Order: obtain validated public CSR → canonical-base64 encode and locally validate alphabet/size → TAT substitutes into command text → shell parses text → script validates value → base64 decode → OpenSSL parses/verifies → sign. A quote can break out before script validation. Thus fixed command ID/template does not prevent shell injection by a malicious or compromised InvokeCommand principal. Local validation prevents operator mistakes only. Restrict this identity to a trusted operator; attacker-resistant invocation requires a broker/non-shell input channel, a key architecture/permission decision not implemented here. No deployed agent or cloud preview is available, so replacement order is documentation-derived, not target-environment tested.
- [VPC CAM table](https://cloud.tencent.com/document/product/598/98194) lists DescribeSecurityGroupPolicies, CreateSecurityGroupPolicies, and DeleteSecurityGroupPolicies at resource scope qcs::cvm:<REGION>:uin/<ACCOUNT_ID>:sg/<DEDICATED_RUNNER_SG_ID>. Query supports IP restrictions; mutations do not. General CAM syntax is condition: { ip_equal: { "qcs:ip": ["<OPERATOR_EGRESS>/32"] } } ([condition key/operator docs](https://cloud.tencent.com/document/product/598/10608)); this constrains API caller source, not runner ingress, and is omitted for mutations as unsupported. No documented CAM control constrains rule protocol, port, source CIDR or request count. API inputs permit those rule values ([add](https://cloud.tencent.com/document/product/215/15807), [delete](https://cloud.tencent.com/document/product/215/15809)); an authorized mutator can therefore write broader policy on this single SG. Program checks and rollback do not narrow that identity authority.
- TAT command content is limited to 64KB base64, output to 24KB, and execution records to three months ([TAT overview](https://cloud.tencent.com/document/api/1340/52695)). Do not use COS output. Only public CSR/certificate/status may reach the GitHub return artifact; no private key.
- The isolated tool package uses official Tencent Node SDK modules `tencentcloud-sdk-nodejs-tat@4.1.241`, `tencentcloud-sdk-nodejs-vpc@4.1.351`, and `tencentcloud-sdk-nodejs-common@4.1.220`; common resolves `uuid@11.1.1` under the approved exact override. Offline tests load the SDK clients and exercise Common SDK `uuid.v4()` through its real trace-ID path while stopping at an injected local transport boundary. This does not prove cloud credentials, IAM, API reachability, or service behavior. No SDK CLI or application/shared dependency is added.

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
| `tat-install-server-code.sh` | prep | use the versioned script beside this document, not the old temp copy; checks private Node v24.22.3 before extracting the original embedded four-file package; rejects existing server-code; offline test compares extracted sources with this checkout |

Three separate time budgets remain hard: CSR return 300s, egress validity 5m, JWKS authorization 15m, job deadline 10m. None has been relaxed; no latency guarantee is claimed.

The versioned installer reuses the existing operator package and bootstrap layout without downloads, dependencies or a global PATH change. Local Git Bash tests exercise a fake private Node and actual ZIP extraction; NTFS permission helpers are substituted in the fixture, so this is not Linux permission or cloud execution evidence. The embedded source package must continue matching the four repository sources; the test fails if they drift. Keep the old temporary preparation files as historical inputs, not the executable source for the next attempt.

## Offline sequence and recovery

Prep: fixed command/SG identity established by an authorized operator later; inspect clean fixed command; prepare short-lived child identity; dispatch caller once. During caller window: obtain real caller run/attempt/workflow SHA from GitHub, validate source artifact and CSR digest, verify runner's egress manifest to /32, sign CSR on CVM through fixed TAT command, add only TCP/8443 from that /32 to the dedicated SG, start service, then obtain public cert/status via invocation task output. Existing return script dispatches once with actual source fields. On timeout/unknown dispatch outcome, query existing run/InvocationId/task ID first; do not redispatch, resign, or remove a rule until state is known. If listener started, stop it and remove only the rule created by this attempt; if outcome cannot be established, stop new operations, do not redispatch/resign, and use the existing absolute 1-hour resource / 45-minute cleanup deadline: conservatively revoke temporary access and clean up known resources within that deadline, recording unknown state and cleanup evidence; do not retain resources beyond it. Existing returned materials are checked before source workflow poll. No private key in artifact.

## Identity, decisions, next unit

Use a purpose-limited sub-user/role and temporary credentials/STS if supported for the selected operator path; never long-lived root key or chat-pasted SecretKey. Administrator must later supply account UIN, region, fixed command ID/content review, one CVM ID, dedicated SG ID, and choose whether a human operator or a supported short-lived federation path performs actions. Do not create identity or grant access here. First executable unit after review/authorization: confirm CAM mappings and command parameter behavior, then offline policy parser/test; only a later specific authorization can allow API calls. A3-03 remains HOLD; no CloudBase/harness/deploy/SP09.

## Reuse and validation

Reuses existing TAT scripts, source/return workflow, CSR handoff, egress verification and tests. Tencent official modular Node SDK packages are isolated to this operator tool; the approved uuid override addresses the audited GHSA-w5hq-g745-h8pq path. Node 20.19.3 offline tests validate SDK module loading and real Common SDK v4 trace-ID generation; `npm audit` on the tool dependency tree previously reported zero vulnerabilities after the override. No live Tencent request was made. This evidence does not prove Tencent IAM enforcement, network latency, or completion within the 300-second window. Draft validation asserts placeholders, action allowlist and wildcard boundary; egress/JWKS tests remain relevant to their respective local contracts.


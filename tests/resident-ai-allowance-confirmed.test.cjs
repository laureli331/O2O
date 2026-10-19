'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = f => new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(path.join(root, f)));
const load = () => JSON.parse(read('docs/v1-development-preflight-20261018.json'));
const at = (rev, f) => cp.execFileSync('git', ['show', rev + ':' + f], { cwd: root, encoding: 'utf8' });
const sourceCommit = '4fc07686a6f8dc1775b14ad81b1113c60fd4ba40';
const order = ['earliest-expiry-first', 'free-first-if-same-expiry', 'paid-earliest-credited-first-if-same-expiry'];

function validate(r) {
  assert.equal(r.residentAi.freeIssuanceSubject, 'verified-natural-person');
  assert.deepEqual(r.residentAi.freeAllowanceDeduplication, {
    acrossWechatAccounts: true,
    identifier: 'protected-identity-deduplication-id',
    explicitPurposeNoticeRequired: true,
    paidEntitlementSharingAuthorized: false
  });
  assert.deepEqual(r.residentAi.consumptionOrder, order);
  assert.equal(r.residentAi.consumeOnUsableResult, true);
  assert.equal(r.residentAi.technicalFailureConsumes, false);
  const d = r.residentAllowanceDecision;
  assert.equal(d.sourceCommit, sourceCommit);
  assert.equal(d.responses.length, 3);
  assert.deepEqual(d.responses.map(x => x.kind), ['document-reference', 'choice', 'choice']);
  assert.deepEqual(d.responses.map(x => x.selected), [null, 'A', 'A']);
  assert.equal(d.responses[0].answer, 'E:\\O2O\\docs\\miniapp-filing-progress-20261018.md\n更新了, 在这个文档');
  assert.equal(d.responses[1].answer, 'A（推荐）：按已核验的同一自然人发放，同一人换微信账号不重复领；仅复用受保护的身份去重标识，需要明确告知该用途。');
  assert.equal(d.responses[2].answer, 'A（推荐）：先扣最早到期的可用次数；到期时间相同则免费优先，付费批次再按较早到账顺序扣。');
  for (let i = 0; i < 3; i++) assert.deepEqual(JSON.parse(d.responses[i].questionItemId), ['request_user_input_async', 'call_49f9fa1e61f246419599a90a75563da1', i]);
  assert.deepEqual(r.pendingQuestions, []);
}

test('actual replies distinguish the filing document reference from two A decisions', () => {
  const r = load();
  validate(r);
  const prior = JSON.parse(at(sourceCommit, 'docs/v1-development-preflight-20261018.json'));
  assert.equal(prior.residentAi.freeIssuanceSubject, null);
  assert.equal(prior.residentAi.consumptionOrder, null);
  assert.equal(r.residentAllowanceDecision.accountDocumentSha256LfNormalized, crypto.createHash('sha256').update(at(sourceCommit, r.accountProgress.sourceDocument).replace(/\r\n/g, '\n')).digest('hex'));
  assert.deepEqual(r.accountProgress, prior.accountProgress);
  for (let i = 0; i < 3; i++) assert(read(r.residentAllowanceDecision.sourceDocument).includes(r.residentAllowanceDecision.responses[i].question));
});

test('only approved issuance and ordering change while commercial unknowns and real-service gates remain', () => {
  const r = load(), prior = JSON.parse(at(sourceCommit, 'docs/v1-development-preflight-20261018.json'));
  for (const key of ['pack', 'balance', 'freePerNaturalMonth', 'freeExpiry', 'paymentChoice', 'packRefundRule', 'balanceRefundExecutionRule', 'realSalesEnabled']) assert.deepEqual(r.residentAi[key], prior.residentAi[key], key);
  for (const key of ['accountProgress', 'budget', 'technicalProposal', 'aiCandidates', 'aiProductionParameters', 'dataPlan', 'sources', 'execution', 'gatesPassed']) assert.deepEqual(r[key], prior[key], key);
  for (const id of ['resident-pack-refund-and-expired-unused-quantities', 'balance-principal-return-execution', 'quota-concurrency-and-identity-lifecycle', 'retention-and-final-privacy-text', 'real-capabilities-cost-and-technical-parameters']) assert(r.remainingDecisionAreas.includes(id));
});

test('active PRD identity purpose and AI order reflect current approval without rewriting other contracts', () => {
  const s = read('docs/prd.md'), before = at(sourceCommit, 'docs/prd.md');
  const identity = s.split(/\r?\n/).find(x => x.startsWith('- ID07 '));
  for (const text of ['同一已核验自然人去重', '换微信账号不重复领', '仅复用受保护的身份去重标识', '明确告知该用途', '保存期限', '依E03落实']) assert(identity.includes(text), text);
  const ai = s.match(/^\| AI10 \|[^\r\n]+/m)[0];
  for (const text of ['先扣最早到期', '同到期免费优先', '同到期付费按较早到账顺序扣', '技术失败不扣', '退款/到期未用补偿', '真实支付未验证不售卖']) assert(ai.includes(text), text);
  for (const line of before.split(/\r?\n/).filter(x => /^\| AI\d{2} \|/.test(x) && !x.startsWith('| AI10 |'))) assert(s.split(/\r?\n/).includes(line), line);
  for (const f of ['docs/prd-v1.5-archive-20261015.md', 'docs/v1-pricing-budget-confirmed-20261018.json', 'docs/miniapp-filing-progress-20261018.md']) assert.equal(read(f).replace(/\r\n/g, '\n'), at(sourceCommit, f).replace(/\r\n/g, '\n'), f);
});

test('current docs separate approved quota policy from still pending retention refund and concurrency implementation', () => {
  for (const f of ['docs/prd.md', 'docs/development-plan.md', 'docs/structured-design.md', 'docs/technical-decision.md', 'docs/external-evidence.md', 'docs/module-specs/current-development-basis-20261015.md', 'docs/ai-feature-decisions.md', 'CONTEXT.md']) {
    const line = read(f).split(/\r?\n/).find(x => x.startsWith('第一版开发前收口'));
    for (const text of ['同一已核验自然人去重', '最早到期', '同到期免费优先', '居民退款细节仍待确认']) assert(line.includes(text), f + ': ' + text);
  }
  const s = read(load().residentAllowanceDecision.sourceDocument);
  for (const text of ['不记作“全A”', '原始完整姓名或身份证号码', 'E02/E03/AG01/DG01', '相同到账时点', '精确到期边界', '不自动授权合并、共享或转移', 'HTML演示不证明服务端已经实现跨微信账号自然人去重']) assert(s.includes(text), text);
});

test('rejects per-account grants unconditional free-first ordering lost purpose notice and invented sharing', () => {
  for (const mutate of [
    r => r.residentAi.freeIssuanceSubject = 'wechat-account',
    r => r.residentAi.freeAllowanceDeduplication.acrossWechatAccounts = false,
    r => r.residentAi.freeAllowanceDeduplication.explicitPurposeNoticeRequired = false,
    r => r.residentAi.freeAllowanceDeduplication.identifier = 'raw-national-id',
    r => r.residentAi.freeAllowanceDeduplication.paidEntitlementSharingAuthorized = true,
    r => r.residentAi.consumptionOrder = ['free-first', 'earliest-expiry-first'],
    r => r.residentAi.consumptionOrder.reverse(),
    r => r.residentAi.technicalFailureConsumes = true,
    r => r.residentAllowanceDecision.responses[0].selected = 'A',
    r => r.residentAllowanceDecision.responses[0].kind = 'choice',
    r => r.residentAllowanceDecision.responses[1].answer = '全A'
  ]) {
    const r = load();
    mutate(r);
    assert.throws(() => validate(r));
  }
});

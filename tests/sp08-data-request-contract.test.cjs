const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const sharedRoot = path.join(root, 'packages', 'shared', 'src');

function loadTypeScriptModule(relativePath, cache = new Map()) {
  const filePath = path.resolve(sharedRoot, relativePath.endsWith('.ts') ? relativePath : `${relativePath}.ts`);
  if (cache.has(filePath)) return cache.get(filePath);

  const source = fs.readFileSync(filePath, 'utf8');
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filePath,
  }).outputText;
  const module = { exports: {} };
  cache.set(filePath, module.exports);

  const localRequire = (specifier) => {
    assert.ok(specifier.startsWith('.'), `shared contract must not load runtime dependency: ${specifier}`);
    const resolved = path.resolve(path.dirname(filePath), specifier);
    const moduleFile = fs.existsSync(`${resolved}.ts`) ? `${resolved}.ts` : path.join(resolved, 'index.ts');
    return loadTypeScriptModule(path.relative(sharedRoot, moduleFile), cache);
  };

  new Function('exports', 'require', 'module', javascript)(module.exports, localRequire, module);
  cache.set(filePath, module.exports);
  return module.exports;
}

test('shared public entry exports the SP08 request and money contracts', () => {
  const shared = loadTypeScriptModule('index.ts');

  assert.equal(typeof shared.parseCnyFen, 'function');
  assert.equal(typeof shared.formatCnyFen, 'function');
  assert.equal(typeof shared.parseIdleListingPrice, 'function');
  assert.equal(typeof shared.validateIdleListingText, 'function');
  assert.equal(typeof shared.parseCommandEnvelope, 'function');
  assert.equal(typeof shared.parseTrustedCommandContext, 'function');
  assert.equal(typeof shared.parseCommandResult, 'function');
  assert.equal(typeof shared.validatePrivateAddressBookPhone, 'function');
  assert.equal(typeof shared.validatePrivateAddressBookText, 'function');
  assert.equal(typeof shared.parseRepairOtherPublicTextProjection, 'function');
  assert.equal(typeof shared.parsePrivateAddressBookEntryDraft, 'function');
  assert.equal(typeof shared.parsePrivateAddressBookDefaultPointer, 'function');
  assert.equal(typeof shared.clearPrivateAddressBookDefaultOnDelete, 'function');
  assert.equal(typeof shared.createPrivateAddressBookTaskSnapshot, 'function');
  assert.equal(typeof shared.validatePublicImageCount, 'function');
  assert.equal(typeof shared.validateErrandAttachmentCount, 'function');
  assert.equal(typeof shared.validateRepairOtherPublicImageCount, 'function');
  assert.equal(shared.COMMAND_PROTOCOL_VERSION, 1);
});

test('command result parser accepts a success result and preserves its value', () => {
  const { parseCommandResult } = loadTypeScriptModule('contracts/result.ts');
  const value = { id: 'item-1', version: 3 };

  assert.deepEqual(parseCommandResult({
    status: 'succeeded',
    requestId: 'request-1',
    value,
  }), {
    ok: true,
    value: { status: 'succeeded', requestId: 'request-1', value },
  });
});

test('command result parser preserves processing and unknown without inventing a retry decision', () => {
  const { parseCommandResult } = loadTypeScriptModule('contracts/result.ts');

  for (const status of ['processing', 'unknown']) {
    assert.deepEqual(parseCommandResult({ status, requestId: 'request-2' }), {
      ok: true,
      value: { status, requestId: 'request-2' },
    });
  }
});

test('command result parser accepts rejected and failed results only with documented error fields', () => {
  const { parseCommandResult } = loadTypeScriptModule('contracts/result.ts');
  const error = {
    category: 'dependency-failure',
    code: 'supplier-timeout',
    requestId: 'request-3',
  };

  for (const status of ['rejected', 'failed']) {
    assert.deepEqual(parseCommandResult({ status, requestId: 'request-3', error }), {
      ok: true,
      value: { status, requestId: 'request-3', error },
    });
  }
});

test('command result parser rejects unknown, incomplete, or cross-request fields', () => {
  const { parseCommandResult } = loadTypeScriptModule('contracts/result.ts');
  const inheritedFields = Object.create({ status: 'unknown', requestId: 'request-4' });

  assert.deepEqual(parseCommandResult(null), { ok: false, reason: { code: 'not-object' } });
  assert.deepEqual(parseCommandResult(inheritedFields), {
    ok: false,
    reason: { code: 'missing-field', field: 'status' },
  });
  assert.deepEqual(parseCommandResult({ status: 'done', requestId: 'request-4' }), {
    ok: false,
    reason: { code: 'invalid-status' },
  });
  assert.deepEqual(parseCommandResult({ status: 'succeeded', requestId: 'request-4' }), {
    ok: false,
    reason: { code: 'missing-field', field: 'value' },
  });
  assert.deepEqual(parseCommandResult({ status: 'unknown', requestId: 'request-4', retry: true }), {
    ok: false,
    reason: { code: 'unexpected-field', field: 'retry' },
  });
  assert.deepEqual(parseCommandResult({
    status: 'failed',
    requestId: 'request-4',
    error: { category: 'not-safe', code: 'x', requestId: 'request-4' },
  }), { ok: false, reason: { code: 'invalid-error-category' } });
  assert.deepEqual(parseCommandResult({
    status: 'failed',
    requestId: 'request-4',
    error: { category: 'internal-failure', code: 'x', requestId: 'request-5' },
  }), { ok: false, reason: { code: 'request-id-mismatch' } });
});

test('private address book phone validation accepts an exact eleven-digit value', () => {
  const { validatePrivateAddressBookPhone } = loadTypeScriptModule('contracts/private-address-book.ts');

  assert.deepEqual(validatePrivateAddressBookPhone('13800138000'), {
    ok: true,
    value: '13800138000',
  });
  assert.deepEqual(validatePrivateAddressBookPhone('00000000000'), {
    ok: true,
    value: '00000000000',
  });
});

test('private address book phone validation rejects non-strings and anything other than eleven ASCII digits', () => {
  const { validatePrivateAddressBookPhone } = loadTypeScriptModule('contracts/private-address-book.ts');

  for (const input of [null, undefined, 13800138000, {}, []]) {
    assert.deepEqual(validatePrivateAddressBookPhone(input), { ok: false, reason: 'not-string' });
  }

  for (const input of ['', '1380013800', '138001380000', '138 0013 8000', '+8613800138000', '１３８００１３８０００']) {
    assert.deepEqual(validatePrivateAddressBookPhone(input), { ok: false, reason: 'not-eleven-digits' });
  }
});

test('private address book phone validation is a pure field-shape contract with no ownership claim', () => {
  const source = fs.readFileSync(path.join(sharedRoot, 'contracts', 'private-address-book.ts'), 'utf8');
  const contractsIndex = fs.readFileSync(path.join(sharedRoot, 'contracts', 'index.ts'), 'utf8');

  assert.match(contractsIndex, /export \* from '\.\/private-address-book';/);
  assert.match(source, /does not verify control of the number/);
  assert.match(source, /Unicode code points/);
  assert.doesNotMatch(source, /\bany\b|\bwindow\b|\bdocument\b|\bwx\s*\.|fetch\s*\(|collection\s*\(/);
});

test('F09 private address-book entry draft parser returns only normalized PRD fields', () => {
  const { parsePrivateAddressBookEntryDraft } = loadTypeScriptModule('contracts/private-address-book.ts');

  assert.deepEqual(parsePrivateAddressBookEntryDraft({
    contact: '  张三🛠  ',
    phone: '13800138000',
    community: '  湘阴渡社区  ',
    detailAddress: '  1号楼101室  ',
  }), {
    ok: true,
    value: {
      contact: '张三🛠',
      phone: '13800138000',
      community: '湘阴渡社区',
      detailAddress: '1号楼101室',
      remark: '',
    },
  });
});

test('F09 private address-book entry draft parser rejects malformed, incomplete, and client-asserted fields', () => {
  const { parsePrivateAddressBookEntryDraft } = loadTypeScriptModule('contracts/private-address-book.ts');
  const valid = {
    contact: '张三',
    phone: '13800138000',
    community: '湘阴渡社区',
    detailAddress: '1号楼101室',
  };

  for (const input of [null, undefined, [], 'entry', 1]) {
    assert.deepEqual(parsePrivateAddressBookEntryDraft(input), {
      ok: false,
      reason: { code: 'not-object' },
    });
  }

  for (const field of ['contact', 'phone', 'community', 'detailAddress']) {
    const input = { ...valid };
    delete input[field];
    assert.deepEqual(parsePrivateAddressBookEntryDraft(input), {
      ok: false,
      reason: { code: 'missing-field', field },
    });
  }

  const inherited = Object.assign(Object.create({ contact: '张三' }), valid);
  delete inherited.contact;
  assert.deepEqual(parsePrivateAddressBookEntryDraft(inherited), {
    ok: false,
    reason: { code: 'missing-field', field: 'contact' },
  });

  for (const field of ['ownerId', 'addressId', 'defaultAddressId', 'isDefault']) {
    assert.deepEqual(parsePrivateAddressBookEntryDraft({ ...valid, [field]: 'client-asserted' }), {
      ok: false,
      reason: { code: 'unexpected-field', field },
    });
  }
});

test('F09 private address-book entry draft parser reports field-specific validation failures', () => {
  const { parsePrivateAddressBookEntryDraft } = loadTypeScriptModule('contracts/private-address-book.ts');
  const valid = {
    contact: '张三',
    phone: '13800138000',
    community: '湘阴渡社区',
    detailAddress: '1号楼101室',
  };

  assert.deepEqual(parsePrivateAddressBookEntryDraft({ ...valid, phone: '123' }), {
    ok: false,
    reason: { code: 'invalid-field', field: 'phone', fieldReason: 'not-eleven-digits' },
  });
  assert.deepEqual(parsePrivateAddressBookEntryDraft({ ...valid, contact: '   ' }), {
    ok: false,
    reason: { code: 'invalid-field', field: 'contact', fieldReason: 'empty' },
  });
  assert.deepEqual(parsePrivateAddressBookEntryDraft({ ...valid, remark: 7 }), {
    ok: false,
    reason: { code: 'invalid-field', field: 'remark', fieldReason: 'not-string' },
  });
  assert.deepEqual(parsePrivateAddressBookEntryDraft({ ...valid, remark: '注'.repeat(101) }), {
    ok: false,
    reason: { code: 'invalid-field', field: 'remark', fieldReason: 'too-long' },
  });
  assert.deepEqual(parsePrivateAddressBookEntryDraft({ ...valid, remark: '  请先电话联系  ' }), {
    ok: true,
    value: { ...valid, remark: '请先电话联系' },
  });
});

test('F09 selecting a validated address creates a detached task snapshot without address-book metadata', () => {
  const {
    createPrivateAddressBookTaskSnapshot,
    parsePrivateAddressBookEntryDraft,
  } = loadTypeScriptModule('contracts/private-address-book.ts');
  const parsed = parsePrivateAddressBookEntryDraft({
    contact: ' 张三 ',
    phone: '13800138000',
    community: ' 湘阴渡社区 ',
    detailAddress: ' 1号楼101室 ',
    remark: ' 请先电话联系 ',
  });
  assert.equal(parsed.ok, true);

  const source = Object.assign({}, parsed.value, {
    addressId: 'address-book-row-1',
    ownerId: 'owner-1',
    isDefault: true,
  });
  const snapshot = createPrivateAddressBookTaskSnapshot(source);

  assert.deepEqual(snapshot, {
    contact: '张三',
    phone: '13800138000',
    community: '湘阴渡社区',
    detailAddress: '1号楼101室',
    remark: '请先电话联系',
  });
  assert.notEqual(snapshot, source);
  source.contact = '修改后的联系人';
  assert.equal(snapshot.contact, '张三');
  assert.deepEqual(Object.keys(snapshot).sort(), [
    'community',
    'contact',
    'detailAddress',
    'phone',
    'remark',
  ]);
});

test('F09 contact text is trimmed and measured by Unicode code points', () => {
  const { validatePrivateAddressBookText } = loadTypeScriptModule('contracts/private-address-book.ts');

  assert.deepEqual(validatePrivateAddressBookText('contact', '  张三🛠  '), {
    ok: true,
    value: '张三🛠',
    characterCount: 3,
  });
});

test('F09 address-book text fields enforce only their documented code-point limits', () => {
  const { validatePrivateAddressBookText } = loadTypeScriptModule('contracts/private-address-book.ts');

  for (const [field, text, limit] of [
    ['contact', '张'.repeat(20), 20],
    ['contact', '🛠'.repeat(20), 20],
    ['detailAddress', '路'.repeat(200), 200],
    ['remark', '注'.repeat(100), 100],
  ]) {
    assert.deepEqual(validatePrivateAddressBookText(field, text), {
      ok: true,
      value: text,
      characterCount: limit,
    });
  }

  for (const [field, text] of [
    ['contact', '张'.repeat(21)],
    ['contact', '🛠'.repeat(21)],
    ['detailAddress', '路'.repeat(201)],
    ['remark', '注'.repeat(101)],
  ]) {
    assert.deepEqual(validatePrivateAddressBookText(field, text), {
      ok: false,
      reason: 'too-long',
    });
  }

  const emojiWithModifier = '🧑🏽';
  assert.deepEqual(validatePrivateAddressBookText('contact', emojiWithModifier.repeat(10)), {
    ok: true,
    value: emojiWithModifier.repeat(10),
    characterCount: 20,
  });
  assert.deepEqual(validatePrivateAddressBookText('contact', emojiWithModifier.repeat(11)), {
    ok: false,
    reason: 'too-long',
  });

  assert.deepEqual(validatePrivateAddressBookText('community', '村'.repeat(201)), {
    ok: true,
    value: '村'.repeat(201),
    characterCount: 201,
  });
});

test('F09 required text rejects blank and non-string values while optional remark may be absent', () => {
  const { validatePrivateAddressBookText } = loadTypeScriptModule('contracts/private-address-book.ts');

  for (const field of ['contact', 'community', 'detailAddress']) {
    assert.deepEqual(validatePrivateAddressBookText(field, '  \t\n '), {
      ok: false,
      reason: 'empty',
    });
    for (const input of [null, 7, {}, []]) {
      assert.deepEqual(validatePrivateAddressBookText(field, input), {
        ok: false,
        reason: 'not-string',
      });
    }
  }

  assert.deepEqual(validatePrivateAddressBookText('remark', undefined), {
    ok: true,
    value: '',
    characterCount: 0,
  });
  assert.deepEqual(validatePrivateAddressBookText('remark', '  '), {
    ok: true,
    value: '',
    characterCount: 0,
  });
  assert.deepEqual(validatePrivateAddressBookText('postalCode', '123'), {
    ok: false,
    reason: 'unknown-field',
  });
});

test('F02 repair and other public text projection trims and returns only allowlisted public text', () => {
  const { parseRepairOtherPublicTextProjection } = loadTypeScriptModule('contracts/repair-other-public-text.ts');
  const input = {
    title: '  冰箱维修  ',
    description: '  冷藏室不制冷  ',
    business: '  家电维修  ',
    community: '  湘阴渡社区  ',
    landmark: '  2栋旁  ',
    privateDetailedAddress: '湘阴渡社区2栋101室',
    phone: '13800138000',
    ownerId: 'owner-private',
  };

  assert.deepEqual(parseRepairOtherPublicTextProjection(input), {
    ok: true,
    value: {
      title: '冰箱维修',
      description: '冷藏室不制冷',
      business: '家电维修',
      community: '湘阴渡社区',
      landmark: '2栋旁',
    },
  });
  assert.deepEqual(input, {
    title: '  冰箱维修  ',
    description: '  冷藏室不制冷  ',
    business: '  家电维修  ',
    community: '  湘阴渡社区  ',
    landmark: '  2栋旁  ',
    privateDetailedAddress: '湘阴渡社区2栋101室',
    phone: '13800138000',
    ownerId: 'owner-private',
  });
});

test('F02 repair and other public text projection handles optional landmark without inventing it', () => {
  const { parseRepairOtherPublicTextProjection } = loadTypeScriptModule('contracts/repair-other-public-text.ts');

  assert.deepEqual(parseRepairOtherPublicTextProjection({
    title: '电脑维修',
    description: '无法开机',
    business: '维修',
    community: '湘阴村',
  }), {
    ok: true,
    value: {
      title: '电脑维修',
      description: '无法开机',
      business: '维修',
      community: '湘阴村',
    },
  });
});

test('F02 repair and other public text projection rejects absent, inherited, blank, or mistyped required text', () => {
  const { parseRepairOtherPublicTextProjection } = loadTypeScriptModule('contracts/repair-other-public-text.ts');
  const valid = {
    title: '电脑维修',
    description: '无法开机',
    business: '维修',
    community: '湘阴村',
  };

  for (const input of [null, undefined, [], 'request', 1]) {
    assert.deepEqual(parseRepairOtherPublicTextProjection(input), {
      ok: false,
      reason: { code: 'not-object' },
    });
  }

  for (const field of ['title', 'description', 'business', 'community']) {
    const input = { ...valid };
    delete input[field];
    assert.deepEqual(parseRepairOtherPublicTextProjection(input), {
      ok: false,
      reason: { code: 'missing-field', field },
    });

    assert.deepEqual(parseRepairOtherPublicTextProjection({ ...valid, [field]: ' \t\n ' }), {
      ok: false,
      reason: { code: 'invalid-field', field, fieldReason: 'empty' },
    });

    assert.deepEqual(parseRepairOtherPublicTextProjection({ ...valid, [field]: 7 }), {
      ok: false,
      reason: { code: 'invalid-field', field, fieldReason: 'not-string' },
    });
  }

  const inheritedTitle = Object.assign(Object.create({ title: '电脑维修' }), {
    description: '无法开机',
    business: '维修',
    community: '湘阴村',
  });
  assert.deepEqual(parseRepairOtherPublicTextProjection(inheritedTitle), {
    ok: false,
    reason: { code: 'missing-field', field: 'title' },
  });

  assert.deepEqual(parseRepairOtherPublicTextProjection({ ...valid, landmark: 7 }), {
    ok: false,
    reason: { code: 'invalid-field', field: 'landmark', fieldReason: 'not-string' },
  });
});

test('F02 public text validates trimmed field limits using Unicode code points', () => {
  const { validateRepairOtherPublicText } = loadTypeScriptModule('contracts/repair-other-public-text.ts');
  const prd = fs.readFileSync(path.join(root, 'docs', 'prd.md'), 'utf8');

  assert.match(prd, /F02[^\n]*标题1—30、说明1—1000[^\n]*地标0—50/);
  assert.deepEqual(validateRepairOtherPublicText('title', `  ${'🛠'.repeat(30)}  `), {
    ok: true,
    value: '🛠'.repeat(30),
    characterCount: 30,
  });
  assert.deepEqual(validateRepairOtherPublicText('description', 'a'.repeat(1_000)), {
    ok: true,
    value: 'a'.repeat(1_000),
    characterCount: 1_000,
  });
  assert.deepEqual(validateRepairOtherPublicText('landmark', '  '), {
    ok: true,
    value: '',
    characterCount: 0,
  });
  assert.deepEqual(validateRepairOtherPublicText('landmark', '🧭'.repeat(50)), {
    ok: true,
    value: '🧭'.repeat(50),
    characterCount: 50,
  });
  assert.deepEqual(validateRepairOtherPublicText('title', '🛠'.repeat(31)), {
    ok: false,
    reason: 'too-long',
  });
  assert.deepEqual(validateRepairOtherPublicText('description', 'a'.repeat(1_001)), {
    ok: false,
    reason: 'too-long',
  });
  assert.deepEqual(validateRepairOtherPublicText('landmark', '🧭'.repeat(51)), {
    ok: false,
    reason: 'too-long',
  });
  assert.deepEqual(validateRepairOtherPublicText('title', ' e\u0301 '), {
    ok: true,
    value: 'e\u0301',
    characterCount: 2,
  });
});

test('F02 public text rejects invalid inputs and treats an omitted landmark as optional', () => {
  const { validateRepairOtherPublicText } = loadTypeScriptModule('contracts/repair-other-public-text.ts');

  assert.deepEqual(validateRepairOtherPublicText('category', '维修'), {
    ok: false,
    reason: 'unknown-field',
  });
  assert.deepEqual(validateRepairOtherPublicText('title', 1), {
    ok: false,
    reason: 'not-string',
  });
  assert.deepEqual(validateRepairOtherPublicText('title', ' \t\n '), {
    ok: false,
    reason: 'empty',
  });
  assert.deepEqual(validateRepairOtherPublicText('description', ''), {
    ok: false,
    reason: 'empty',
  });
  assert.deepEqual(validateRepairOtherPublicText('landmark', undefined), {
    ok: true,
    value: '',
    characterCount: 0,
  });
});

test('F03 required category and community text is trimmed and rejects blank or non-string input', () => {
  const { validateIdleListingRequiredText } = loadTypeScriptModule('contracts/idle-listing-text.ts');
  const prd = fs.readFileSync(path.join(root, 'docs', 'prd.md'), 'utf8');

  assert.match(prd, /F03[^\n]*标题1—30、说明1—1000、分类、村\/社区/);
  assert.deepEqual(validateIdleListingRequiredText('category', '  家居用品  '), {
    ok: true,
    value: '家居用品',
  });
  assert.deepEqual(validateIdleListingRequiredText('category', 'x'.repeat(2_000)), {
    ok: true,
    value: 'x'.repeat(2_000),
  });
  assert.deepEqual(validateIdleListingRequiredText('community', ' 湘阴渡社区 '), {
    ok: true,
    value: '湘阴渡社区',
  });
  assert.deepEqual(validateIdleListingRequiredText('category', '  '), {
    ok: false,
    reason: 'empty',
  });
  assert.deepEqual(validateIdleListingRequiredText('community', null), {
    ok: false,
    reason: 'not-string',
  });
  assert.deepEqual(validateIdleListingRequiredText('community', undefined), {
    ok: false,
    reason: 'not-string',
  });
  assert.deepEqual(validateIdleListingRequiredText('landmark', 'nearby'), {
    ok: false,
    reason: 'unknown-field',
  });

  const source = fs.readFileSync(path.join(sharedRoot, 'contracts', 'idle-listing-text.ts'), 'utf8');
  assert.doesNotMatch(source, /\bany\b|\bwindow\b|\bdocument\b|\bwx\s*\.|fetch\s*\(|collection\s*\(/);
});

test('F02 and F03 public image count accepts the inclusive zero-to-nine range', () => {
  const { validatePublicImageCount } = loadTypeScriptModule('contracts/public-image-count.ts');
  const prd = fs.readFileSync(path.join(root, 'docs', 'prd.md'), 'utf8');

  assert.match(prd, /F02[^\n]*公开图片0—9选填/);
  assert.match(prd, /F03[^\n]*图片0—9/);

  for (const count of [0, 1, 9]) {
    assert.deepEqual(validatePublicImageCount(count), {
      ok: true,
      value: count,
    });
  }
});

test('F02 and F03 public image count rejects non-integers and values outside the PRD range', () => {
  const { validatePublicImageCount } = loadTypeScriptModule('contracts/public-image-count.ts');

  for (const count of [null, undefined, '1', {}, [], NaN, Infinity, 1.5]) {
    assert.deepEqual(validatePublicImageCount(count), {
      ok: false,
      reason: 'not-integer',
    });
  }

  for (const count of [-1, 10]) {
    assert.deepEqual(validatePublicImageCount(count), {
      ok: false,
      reason: 'out-of-range',
    });
  }
});

test('F04 errand attachment count accepts only the inclusive zero-to-nine count range', () => {
  const { validateErrandAttachmentCount } = loadTypeScriptModule('contracts/errand-attachment-count.ts');
  const prd = fs.readFileSync(path.join(root, 'docs', 'prd.md'), 'utf8');
  const ownership = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'sp08-object-ownership-map-20261105.json'), 'utf8'));
  const f04 = ownership.fieldGroups.find((fieldGroup) => fieldGroup.prdFieldId === 'F04');

  assert.match(prd, /\| F04 \|[^\n]*附件0—9/);
  assert.match(f04.snapshotRule, /附件公开范围尚未由 PRD 明确/);

  for (const count of [0, 1, 9]) {
    assert.deepEqual(validateErrandAttachmentCount(count), {
      ok: true,
      value: count,
    });
  }
});

test('F04 errand attachment count rejects non-integers and values outside the PRD range', () => {
  const { validateErrandAttachmentCount } = loadTypeScriptModule('contracts/errand-attachment-count.ts');

  for (const count of [null, undefined, '1', {}, [], NaN, Infinity, 1.5]) {
    assert.deepEqual(validateErrandAttachmentCount(count), {
      ok: false,
      reason: 'not-integer',
    });
  }

  for (const count of [-1, 10]) {
    assert.deepEqual(validateErrandAttachmentCount(count), {
      ok: false,
      reason: 'out-of-range',
    });
  }
});

test('F04 errand service fee requires a positive PRD-bounded exact yuan amount', () => {
  const { parseErrandServiceFee } = loadTypeScriptModule('contracts/errand-service-fee.ts');
  const prd = fs.readFileSync(path.join(root, 'docs', 'prd.md'), 'utf8');

  assert.match(prd, /金额最多2位小数、上限99,999\.99元/);
  assert.match(prd, /\| F04 \|[^\n]*正数服务费/);
  assert.match(prd, /跑腿由发布者填写明确的正数服务费/);

  for (const [input, valueFen] of [['0.01', 1], ['1', 100], ['99999.99', 9_999_999]]) {
    assert.deepEqual(parseErrandServiceFee(input), {
      ok: true,
      valueFen,
    });
  }
});

test('F04 errand service fee rejects zero, malformed, imprecise, over-limit, and non-string values', () => {
  const { parseErrandServiceFee } = loadTypeScriptModule('contracts/errand-service-fee.ts');
  const invalidInputs = [
    [0, 'not-decimal-string'],
    [null, 'not-decimal-string'],
    [undefined, 'not-decimal-string'],
    ['', 'invalid-format'],
    [' 1', 'invalid-format'],
    ['0', 'not-positive'],
    ['0.00', 'not-positive'],
    ['-1', 'invalid-format'],
    ['1.001', 'too-precise'],
    ['100000', 'out-of-range'],
  ];

  for (const [input, reason] of invalidInputs) {
    assert.deepEqual(parseErrandServiceFee(input), {
      ok: false,
      reason,
    });
  }
});

test('F04 service-fee validator reuses the exact-fen parser without defining transaction or transport behavior', () => {
  const source = fs.readFileSync(path.join(sharedRoot, 'contracts', 'errand-service-fee.ts'), 'utf8');
  const contractsIndex = fs.readFileSync(path.join(sharedRoot, 'contracts', 'index.ts'), 'utf8');

  assert.match(contractsIndex, /export \* from '\.\/errand-service-fee';/);
  assert.match(source, /parseCnyFen/);
  assert.doesNotMatch(source, /\bany\b|\bwindow\b|\bdocument\b|\bwx\s*\.|fetch\s*\(|collection\s*\(/);
});

test('F05 errand advance terms require a positive capped amount only when the applicant is willing to advance', () => {
  const { parseErrandAdvanceTerms } = loadTypeScriptModule('contracts/errand-advance-terms.ts');
  const prd = fs.readFileSync(path.join(root, 'docs', 'prd.md'), 'utf8');

  assert.match(prd, /\| F05 \|[^\n]*跑腿只读接受发布者正数服务费和是否垫付、愿垫付的正数上限/);
  assert.match(prd, /跑腿仍按已确认申请的是否垫付与正数上限规则/);

  assert.deepEqual(parseErrandAdvanceTerms({ willingToAdvance: false }), {
    ok: true,
    value: { willingToAdvance: false, advanceLimitFen: null },
  });
  assert.deepEqual(parseErrandAdvanceTerms({ willingToAdvance: false, advanceLimitYuan: 'invalid-but-irrelevant' }), {
    ok: true,
    value: { willingToAdvance: false, advanceLimitFen: null },
  });
  assert.deepEqual(parseErrandAdvanceTerms({ willingToAdvance: true, advanceLimitYuan: '0.01' }), {
    ok: true,
    value: { willingToAdvance: true, advanceLimitFen: 1 },
  });
  assert.deepEqual(parseErrandAdvanceTerms({ willingToAdvance: true, advanceLimitYuan: '99999.99' }), {
    ok: true,
    value: { willingToAdvance: true, advanceLimitFen: 9_999_999 },
  });
});

test('F05 errand advance terms reject malformed objects, willingness, and invalid required caps', () => {
  const { parseErrandAdvanceTerms } = loadTypeScriptModule('contracts/errand-advance-terms.ts');

  for (const input of [null, [], 'not-an-object']) {
    assert.deepEqual(parseErrandAdvanceTerms(input), {
      ok: false,
      reason: { code: 'not-object' },
    });
  }
  assert.deepEqual(parseErrandAdvanceTerms({ advanceLimitYuan: '1' }), {
    ok: false,
    reason: { code: 'missing-field', field: 'willingToAdvance' },
  });
  assert.deepEqual(parseErrandAdvanceTerms({ willingToAdvance: 'yes', advanceLimitYuan: '1' }), {
    ok: false,
    reason: { code: 'invalid-willingness' },
  });
  assert.deepEqual(parseErrandAdvanceTerms({ willingToAdvance: true }), {
    ok: false,
    reason: { code: 'missing-field', field: 'advanceLimitYuan' },
  });
  for (const [advanceLimitYuan, reason] of [
    ['0', 'not-positive'],
    ['0.00', 'not-positive'],
    ['', 'invalid-format'],
    ['1.001', 'too-precise'],
    ['100000', 'out-of-range'],
    [1, 'not-decimal-string'],
  ]) {
    assert.deepEqual(parseErrandAdvanceTerms({ willingToAdvance: true, advanceLimitYuan }), {
      ok: false,
      reason: { code: 'invalid-advance-limit', reason },
    });
  }
});

test('F05 advance-terms parser accepts only its own allowlisted fields and stays a pure shared contract', () => {
  const source = fs.readFileSync(path.join(sharedRoot, 'contracts', 'errand-advance-terms.ts'), 'utf8');
  const contractsIndex = fs.readFileSync(path.join(sharedRoot, 'contracts', 'index.ts'), 'utf8');
  const inherited = Object.create({ willingToAdvance: true });
  inherited.advanceLimitYuan = '1';

  assert.match(contractsIndex, /export \* from '\.\/errand-advance-terms';/);
  assert.deepEqual(loadTypeScriptModule('contracts/errand-advance-terms.ts').parseErrandAdvanceTerms(inherited), {
    ok: false,
    reason: { code: 'missing-field', field: 'willingToAdvance' },
  });
  assert.deepEqual(loadTypeScriptModule('contracts/errand-advance-terms.ts').parseErrandAdvanceTerms({
    willingToAdvance: false,
    clientOwnerId: 'forged',
  }), {
    ok: false,
    reason: { code: 'unexpected-field', field: 'clientOwnerId' },
  });
  assert.match(source, /parseErrandServiceFee/);
  assert.doesNotMatch(source, /\bany\b|\bwindow\b|\bdocument\b|\bwx\s*\.|fetch\s*\(|collection\s*\(/);
});

test('F09 default-address pointer models zero or one nonblank opaque address id', () => {
  const { parsePrivateAddressBookDefaultPointer } = loadTypeScriptModule('contracts/private-address-book.ts');

  assert.deepEqual(parsePrivateAddressBookDefaultPointer({ defaultAddressId: null }), {
    ok: true,
    value: { defaultAddressId: null },
  });
  assert.deepEqual(parsePrivateAddressBookDefaultPointer({ defaultAddressId: 'address-a' }), {
    ok: true,
    value: { defaultAddressId: 'address-a' },
  });
  assert.deepEqual(parsePrivateAddressBookDefaultPointer({ defaultAddressId: 'address-b' }), {
    ok: true,
    value: { defaultAddressId: 'address-b' },
  });
  assert.deepEqual(parsePrivateAddressBookDefaultPointer({ defaultAddressId: ' address-c ' }), {
    ok: true,
    value: { defaultAddressId: ' address-c ' },
  });
});

test('F09 default-address pointer rejects malformed, inherited, blank, or untrusted fields', () => {
  const { parsePrivateAddressBookDefaultPointer } = loadTypeScriptModule('contracts/private-address-book.ts');
  const inherited = Object.create({ defaultAddressId: 'address-a' });

  for (const input of [null, undefined, [], 'address-a', 1]) {
    assert.deepEqual(parsePrivateAddressBookDefaultPointer(input), {
      ok: false,
      reason: { code: 'not-object' },
    });
  }
  assert.deepEqual(parsePrivateAddressBookDefaultPointer(inherited), {
    ok: false,
    reason: { code: 'missing-field' },
  });
  for (const defaultAddressId of ['', '  ', 1, false, undefined]) {
    assert.deepEqual(parsePrivateAddressBookDefaultPointer({ defaultAddressId }), {
      ok: false,
      reason: { code: 'invalid-address-id' },
    });
  }
  assert.deepEqual(parsePrivateAddressBookDefaultPointer({ defaultAddressId: null, ownerId: 'forged' }), {
    ok: false,
    reason: { code: 'unexpected-field', field: 'ownerId' },
  });
});

test('F09 deleting the current default clears only the pointer and never promotes another address', () => {
  const { clearPrivateAddressBookDefaultOnDelete } = loadTypeScriptModule('contracts/private-address-book.ts');
  const currentDefault = { defaultAddressId: 'address-a' };

  assert.deepEqual(clearPrivateAddressBookDefaultOnDelete(currentDefault, 'address-a'), {
    defaultAddressId: null,
  });
  assert.deepEqual(clearPrivateAddressBookDefaultOnDelete(currentDefault, 'address-b'), currentDefault);
  assert.deepEqual(clearPrivateAddressBookDefaultOnDelete({ defaultAddressId: null }, 'address-a'), {
    defaultAddressId: null,
  });
});

test('F09 default-address helpers remain pure and explicitly do not prove ownership or atomic deletion', () => {
  const source = fs.readFileSync(path.join(sharedRoot, 'contracts', 'private-address-book.ts'), 'utf8');

  assert.match(source, /defaultAddressId/);
  assert.match(source, /does not verify address ownership or atomic deletion/);
  assert.doesNotMatch(source, /\bany\b|\bwindow\b|\bdocument\b|\bwx\s*\.|fetch\s*\(|collection\s*\(/);
});

test('yuan decimal strings convert to integer fen without floating point', () => {
  const { parseCnyFen, formatCnyFen } = loadTypeScriptModule('contracts/money.ts');
  const examples = [
    ['0', 0, '0.00'],
    ['0.01', 1, '0.01'],
    ['1.2', 120, '1.20'],
    ['99999.99', 9_999_999, '99999.99'],
  ];

  for (const [input, expectedFen, expectedText] of examples) {
    const parsed = parseCnyFen(input);
    assert.deepEqual(parsed, { ok: true, value: expectedFen });
    assert.equal(formatCnyFen(parsed.value), expectedText);
  }
});

test('yuan decimal parser rejects unknown, imprecise, malformed, negative, and over-limit input', () => {
  const { parseCnyFen } = loadTypeScriptModule('contracts/money.ts');
  const invalidInputs = [
    null,
    undefined,
    1.01,
    '1e2',
    ' 1.00',
    '+1.00',
    '-0.01',
    '1.001',
    '100000.00',
    '1,000.00',
    '.50',
  ];

  for (const input of invalidInputs) {
    assert.equal(parseCnyFen(input).ok, false, `expected rejection for ${String(input)}`);
  }
  assert.deepEqual(parseCnyFen('100000.00'), { ok: false, reason: 'out-of-range' });
  assert.deepEqual(parseCnyFen('1.001'), { ok: false, reason: 'too-precise' });
  assert.deepEqual(parseCnyFen('01.00'), { ok: true, value: 100 });
});

test('F03 idle listing price accepts face-to-face negotiation or a positive PRD-bounded yuan amount', () => {
  const { parseIdleListingPrice } = loadTypeScriptModule('contracts/idle-listing-price.ts');
  const prd = fs.readFileSync(path.join(root, 'docs', 'prd.md'), 'utf8');

  assert.match(prd, /F03[^\n]*明确价格须大于0且≤99,999\.99\/最多2位小数，或面议/);
  assert.deepEqual(parseIdleListingPrice('面议'), {
    ok: true,
    value: { kind: 'negotiable' },
  });
  assert.deepEqual(parseIdleListingPrice('0.01'), {
    ok: true,
    value: { kind: 'fixed', amountFen: 1 },
  });
  assert.deepEqual(parseIdleListingPrice('1.2'), {
    ok: true,
    value: { kind: 'fixed', amountFen: 120 },
  });
  assert.deepEqual(parseIdleListingPrice('99999.99'), {
    ok: true,
    value: { kind: 'fixed', amountFen: 9_999_999 },
  });
});

test('F03 idle listing price rejects zero, malformed, over-precise, out-of-range, and non-string values', () => {
  const { parseIdleListingPrice } = loadTypeScriptModule('contracts/idle-listing-price.ts');

  for (const input of [null, undefined, 1, {}, []]) {
    assert.deepEqual(parseIdleListingPrice(input), { ok: false, reason: 'not-string' });
  }
  for (const input of ['0', '0.00']) {
    assert.deepEqual(parseIdleListingPrice(input), { ok: false, reason: 'not-positive' });
  }
  assert.deepEqual(parseIdleListingPrice('100000.00'), { ok: false, reason: 'out-of-range' });
  assert.deepEqual(parseIdleListingPrice('1.001'), { ok: false, reason: 'too-precise' });
  for (const input of ['', ' 面议 ', ' 1.00', '+1.00', '-0.01', '1,000.00', '.50']) {
    assert.deepEqual(parseIdleListingPrice(input), { ok: false, reason: 'invalid-format' });
  }
});

test('F03 idle listing price validator reuses the pure exact-fen parser without widening into storage or platform behavior', () => {
  const source = fs.readFileSync(path.join(sharedRoot, 'contracts', 'idle-listing-price.ts'), 'utf8');
  const contractsIndex = fs.readFileSync(path.join(sharedRoot, 'contracts', 'index.ts'), 'utf8');

  assert.match(contractsIndex, /export \* from '\.\/idle-listing-price';/);
  assert.match(source, /parseCnyFen/);
  assert.match(source, /does not specify that behavior/);
  assert.doesNotMatch(source, /\bany\b|\bwindow\b|\bdocument\b|\bwx\s*\.|fetch\s*\(|collection\s*\(/);
});

test('F03 idle listing text trims edge whitespace and counts Unicode code points at title, description, and landmark limits', () => {
  const { validateIdleListingText } = loadTypeScriptModule('contracts/idle-listing-text.ts');
  const prd = fs.readFileSync(path.join(root, 'docs', 'prd.md'), 'utf8');

  assert.match(prd, /\| F03 \|[^\n]*标题1—30、说明1—1000[^\n]*地标0—50选填/);
  assert.deepEqual(validateIdleListingText('title', '  闲置😀  '), {
    ok: true,
    value: '闲置😀',
    characterCount: 3,
  });
  assert.deepEqual(validateIdleListingText('title', '😀'.repeat(30)), {
    ok: true,
    value: '😀'.repeat(30),
    characterCount: 30,
  });
  assert.deepEqual(validateIdleListingText('description', '😀'.repeat(1000)), {
    ok: true,
    value: '😀'.repeat(1000),
    characterCount: 1000,
  });
  assert.deepEqual(validateIdleListingText('landmark', undefined), {
    ok: true,
    value: '',
    characterCount: 0,
  });
  assert.deepEqual(validateIdleListingText('landmark', '  '), {
    ok: true,
    value: '',
    characterCount: 0,
  });
  assert.deepEqual(validateIdleListingText('landmark', '😀'.repeat(50)), {
    ok: true,
    value: '😀'.repeat(50),
    characterCount: 50,
  });
});

test('F03 idle listing text rejects blank required values, over-limit text, and non-string optional landmarks', () => {
  const { validateIdleListingText } = loadTypeScriptModule('contracts/idle-listing-text.ts');

  assert.deepEqual(validateIdleListingText('title', ' \t\n '), { ok: false, reason: 'empty' });
  assert.deepEqual(validateIdleListingText('description', ''), { ok: false, reason: 'empty' });
  assert.deepEqual(validateIdleListingText('title', '😀'.repeat(31)), { ok: false, reason: 'too-long' });
  assert.deepEqual(validateIdleListingText('description', '😀'.repeat(1001)), { ok: false, reason: 'too-long' });
  assert.deepEqual(validateIdleListingText('landmark', '😀'.repeat(51)), { ok: false, reason: 'too-long' });
  for (const input of [null, 1, {}, []]) {
    assert.deepEqual(validateIdleListingText('landmark', input), { ok: false, reason: 'not-string' });
  }
  assert.deepEqual(validateIdleListingText('invalid', 'value'), { ok: false, reason: 'unknown-field' });
});

test('F03 idle listing text validator remains pure and has no platform or persistence behavior', () => {
  const sourcePath = path.join(sharedRoot, 'contracts', 'idle-listing-text.ts');
  const contractsIndex = fs.readFileSync(path.join(sharedRoot, 'contracts', 'index.ts'), 'utf8');
  const source = fs.existsSync(sourcePath) ? fs.readFileSync(sourcePath, 'utf8') : '';

  assert.match(contractsIndex, /export \* from '\.\/idle-listing-text';/);
  assert.match(source, /Array\.from\(value\)\.length/);
  assert.doesNotMatch(source, /\bany\b|\bwindow\b|\bdocument\b|\bwx\s*\.|fetch\s*\(|collection\s*\(/);
});

test('request envelope separates untrusted client data from trusted server context', () => {
  const commandSource = fs.readFileSync(path.join(sharedRoot, 'contracts', 'command.ts'), 'utf8');
  const resultSource = fs.readFileSync(path.join(sharedRoot, 'contracts', 'result.ts'), 'utf8');
  const combined = `${commandSource}\n${resultSource}`;

  for (const requiredToken of ['operationKey', 'objectId', 'expectedVersion', 'payload', 'actorId', 'receivedAtEpochMs']) {
    assert.ok(combined.includes(requiredToken), `missing contract element ${requiredToken}`);
  }
  for (const outcome of ['succeeded', 'rejected', 'failed', 'processing', 'unknown']) {
    assert.ok(resultSource.includes(`'${outcome}'`), `missing result outcome ${outcome}`);
  }

  const clientEnvelope = commandSource.match(/export interface CommandEnvelope[\s\S]*?\n}/)?.[0];
  assert.ok(clientEnvelope, 'CommandEnvelope declaration must exist');
  assert.doesNotMatch(clientEnvelope, /actorId|receivedAtEpochMs|serverTime|role|amountFen/);
  assert.doesNotMatch(combined, /\bany\b|\bwindow\b|\bdocument\b|\bwx\s*\./);
});

test('trusted command context parser checks the adapter-provided shape without establishing trust', () => {
  const { parseTrustedCommandContext } = loadTypeScriptModule('contracts/command.ts');
  const source = fs.readFileSync(path.join(sharedRoot, 'contracts', 'command.ts'), 'utf8');
  const input = { actorId: 'actor-1', receivedAtEpochMs: 1_800_000_000_000, requestId: 'request-1' };

  assert.match(source, /does not authenticate an actor/);
  assert.doesNotMatch(source, /\bany\b|\bwindow\b|\bdocument\b|\bwx\s*\.|fetch\s*\(|collection\s*\(/);
  assert.deepEqual(parseTrustedCommandContext(input), { ok: true, value: input });
  assert.deepEqual(parseTrustedCommandContext({ actorId: 'actor-1', receivedAtEpochMs: 0, requestId: 'request-1' }), {
    ok: true,
    value: { actorId: 'actor-1', receivedAtEpochMs: 0, requestId: 'request-1' },
  });
  assert.deepEqual(parseTrustedCommandContext({ ...input, role: 'admin' }), {
    ok: false,
    reason: { code: 'unexpected-field', field: 'role' },
  });
});

test('trusted command context parser rejects malformed, incomplete, blank, and non-finite facts', () => {
  const { parseTrustedCommandContext } = loadTypeScriptModule('contracts/command.ts');
  const valid = { actorId: 'actor-1', receivedAtEpochMs: 1_800_000_000_000, requestId: 'request-1' };

  for (const input of [null, undefined, [], 'context', 1]) {
    assert.deepEqual(parseTrustedCommandContext(input), { ok: false, reason: { code: 'not-object' } });
  }
  assert.deepEqual(parseTrustedCommandContext(Object.create(valid)), {
    ok: false,
    reason: { code: 'missing-field', field: 'actorId' },
  });
  assert.deepEqual(parseTrustedCommandContext({ ...valid, actorId: '   ' }), {
    ok: false,
    reason: { code: 'empty-field', field: 'actorId' },
  });
  assert.deepEqual(parseTrustedCommandContext({ ...valid, requestId: '' }), {
    ok: false,
    reason: { code: 'empty-field', field: 'requestId' },
  });
  for (const receivedAtEpochMs of ['now', Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(parseTrustedCommandContext({ ...valid, receivedAtEpochMs }), {
      ok: false,
      reason: { code: 'invalid-field-type', field: 'receivedAtEpochMs' },
    });
  }
});

test('command envelope parser narrows only the documented generic structure', () => {
  const { parseCommandEnvelope } = loadTypeScriptModule('contracts/command.ts');
  const payload = { nested: [1, true, null] };
  const input = {
    protocolVersion: 1,
    requestId: 'req-1',
    objectId: 'object-1',
    operation: 'module-owned-operation',
    operationKey: 'op-key-1',
    expectedVersion: 3,
    payload,
  };

  assert.deepEqual(parseCommandEnvelope(input), { ok: true, value: input });
  const withoutExpectedVersion = { ...input };
  delete withoutExpectedVersion.expectedVersion;
  assert.deepEqual(parseCommandEnvelope(withoutExpectedVersion), { ok: true, value: withoutExpectedVersion });
  assert.deepEqual(parseCommandEnvelope({ ...input, payload: null }), {
    ok: true,
    value: { ...input, payload: null },
  });
  assert.deepEqual(parseCommandEnvelope({ ...input, operation: 'future-module-operation' }).ok, true);
});

test('command envelope parser rejects non-object inputs and missing own required fields', () => {
  const { parseCommandEnvelope } = loadTypeScriptModule('contracts/command.ts');
  const valid = {
    protocolVersion: 1,
    requestId: 'req-1',
    objectId: 'object-1',
    operation: 'operation-1',
    operationKey: 'op-key-1',
    payload: {},
  };

  for (const input of [null, undefined, [], 'command', 1]) {
    assert.deepEqual(parseCommandEnvelope(input), { ok: false, reason: { code: 'not-object' } });
  }

  for (const field of ['protocolVersion', 'requestId', 'objectId', 'operation', 'operationKey', 'payload']) {
    const input = { ...valid };
    delete input[field];
    assert.deepEqual(parseCommandEnvelope(input), {
      ok: false,
      reason: { code: 'missing-field', field },
    });
  }

  const inherited = Object.assign(Object.create({ requestId: 'inherited' }), valid);
  delete inherited.requestId;
  assert.deepEqual(parseCommandEnvelope(inherited), {
    ok: false,
    reason: { code: 'missing-field', field: 'requestId' },
  });
});

test('command envelope parser rejects malformed types, unsupported version, empty identifiers, and untrusted extra fields', () => {
  const { parseCommandEnvelope } = loadTypeScriptModule('contracts/command.ts');
  const valid = {
    protocolVersion: 1,
    requestId: 'req-1',
    objectId: 'object-1',
    operation: 'operation-1',
    operationKey: 'op-key-1',
    payload: {},
  };

  assert.deepEqual(parseCommandEnvelope({ ...valid, protocolVersion: 2 }), {
    ok: false,
    reason: { code: 'unsupported-protocol-version' },
  });
  for (const field of ['requestId', 'objectId', 'operation', 'operationKey']) {
    assert.deepEqual(parseCommandEnvelope({ ...valid, [field]: '' }), {
      ok: false,
      reason: { code: 'empty-field', field },
    });
    assert.deepEqual(parseCommandEnvelope({ ...valid, [field]: '   ' }), {
      ok: false,
      reason: { code: 'empty-field', field },
    });
    assert.deepEqual(parseCommandEnvelope({ ...valid, [field]: 1 }), {
      ok: false,
      reason: { code: 'invalid-field-type', field },
    });
  }
  assert.deepEqual(parseCommandEnvelope({ ...valid, expectedVersion: '3' }), {
    ok: false,
    reason: { code: 'invalid-field-type', field: 'expectedVersion' },
  });
  assert.deepEqual(parseCommandEnvelope({ ...valid, payload: undefined }), {
    ok: false,
    reason: { code: 'invalid-field-type', field: 'payload' },
  });
  for (const expectedVersion of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.deepEqual(parseCommandEnvelope({ ...valid, expectedVersion }), {
      ok: false,
      reason: { code: 'invalid-field-type', field: 'expectedVersion' },
    });
  }
  for (const field of ['actorId', 'role', 'amountFen', 'receivedAtEpochMs', 'serverTime', 'paymentConfirmed']) {
    assert.deepEqual(parseCommandEnvelope({ ...valid, [field]: 'forged' }), {
      ok: false,
      reason: { code: 'unexpected-field', field },
    });
  }
});

test('idempotency reuse replays the original outcome only for a matching validated payload', () => {
  const { resolveIdempotencyReuse } = loadTypeScriptModule('contracts/idempotency.ts');
  const originalOutcomes = [
    { status: 'succeeded', requestId: 'original-success', value: { version: 2 } },
    { status: 'rejected', requestId: 'original-rejected', error: { category: 'business-rejected', code: 'RULE', requestId: 'original-rejected' } },
    { status: 'failed', requestId: 'original-failed', error: { category: 'dependency-failure', code: 'DEPENDENCY', requestId: 'original-failed' } },
    { status: 'processing', requestId: 'original-processing' },
    { status: 'unknown', requestId: 'original-unknown' },
  ];

  for (const originalResult of originalOutcomes) {
    assert.deepEqual(resolveIdempotencyReuse('same', originalResult), {
      outcome: 'replay',
      originalResult,
    });
  }

  assert.deepEqual(resolveIdempotencyReuse('different', originalOutcomes[0]), {
    outcome: 'reject',
    reason: 'payload-mismatch',
  });
});

test('idempotency reuse is a shared pure contract and does not invent storage or transport APIs', () => {
  const source = fs.readFileSync(path.join(sharedRoot, 'contracts', 'idempotency.ts'), 'utf8');
  const contractsIndex = fs.readFileSync(path.join(sharedRoot, 'contracts', 'index.ts'), 'utf8');
  const sharedIndex = fs.readFileSync(path.join(sharedRoot, 'index.ts'), 'utf8');

  assert.match(contractsIndex, /export \* from '\.\/idempotency';/);
  assert.match(sharedIndex, /export \* from '\.\/contracts';/);
  assert.match(source, /IdempotencyPayloadComparison/);
  assert.match(source, /CommandResult/);
  assert.doesNotMatch(source, /\bany\b|\bwindow\b|\bdocument\b|\bwx\s*\.|fetch\s*\(|collection\s*\(/);
});

test('SP08 progress record keeps this local contract slice distinct from cloud/product acceptance', () => {
  const record = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'sp08-data-request-contract-progress-20261105.json'), 'utf8'));

  assert.equal(record.taskId, 'SP08');
  assert.equal(record.status, 'in-progress');
  assert.equal(record.productAcceptancePassed, false);
  assert.equal(record.cloudMutationsPerformed, false);
  assert.ok(record.scope.includes('shared-idempotency-reuse-decision'));
  assert.ok(record.scope.includes('command-envelope-runtime-structure-validation'));
  assert.ok(record.scope.includes('trusted-command-context-runtime-shape-validation'));
  assert.ok(record.scope.includes('command-result-runtime-shape-validation'));
  assert.ok(record.scope.includes('f09-private-address-book-phone-shape-validation'));
  assert.ok(record.scope.includes('f09-private-address-book-text-shape-validation'));
  assert.ok(record.scope.includes('f09-private-address-book-entry-draft-payload-validation'));
  assert.ok(record.scope.includes('f09-private-address-book-default-pointer-and-delete-transition'));
  assert.ok(record.scope.includes('f09-selected-address-detached-task-snapshot-copy'));
  assert.ok(record.scope.includes('f02-repair-other-public-text-projection'));
  assert.ok(record.scope.includes('f02-repair-other-text-length-validation'));
  assert.ok(record.scope.includes('f02-repair-other-public-image-count-validation'));
  assert.ok(record.scope.includes('f03-idle-listing-price-field-validation'));
  assert.ok(record.scope.includes('f03-idle-listing-text-length-validation'));
  assert.ok(record.scope.includes('f03-idle-listing-required-category-community-text-shape-validation'));
  assert.ok(record.scope.includes('f04-errand-attachment-count-validation'));
  assert.ok(record.scope.includes('f04-errand-positive-service-fee-validation'));
  assert.ok(record.notProven.includes('command-result-business-outcome-evidence'));
  assert.ok(record.notProven.includes('remaining-module-specific-command-validation'));
  assert.ok(!record.notProven.includes('f02-repair-other-text-length-validation-and-character-count-rule'));
  assert.ok(!record.notProven.includes('f03-idle-listing-title-and-description-length-validation'));
  assert.ok(record.notProven.includes('atomic-idempotency-claim-with-business-write'));
  assert.ok(record.notProven.includes('business-transaction-concurrency'));
  assert.ok(record.notProven.includes('physical-indexes-and-uniqueness'));
  assert.ok(record.reuseDecision.f03IdleListingPrice.includes('parseCnyFen'));
  assert.ok(record.reuseDecision.f03IdleListingText.includes('Unicode 码点'));
  assert.ok(record.reuseDecision.f03IdleListingRequiredText.includes('String.trim()'));
  assert.ok(record.reuseDecision.f03IdleListingRequiredText.includes('没有给出允许类别目录'));
  assert.ok(record.reuseDecision.f02RepairOtherText.includes('Unicode 码点'));
  assert.ok(record.reuseDecision.f04ErrandAttachmentCount.includes('validateIntegerCountInRange'));
  assert.ok(record.reuseDecision.f04ErrandAttachmentCount.includes('不推断附件媒体类型、公开范围或上传/读取权限'));
  assert.ok(record.reuseDecision.f04ErrandServiceFee.includes('parseCnyFen'));
  assert.equal(record.evidence.idleListingPriceValidation, 'packages/shared/src/contracts/idle-listing-price.ts#parseIdleListingPrice');
  assert.equal(record.evidence.idleListingTextValidation, 'packages/shared/src/contracts/idle-listing-text.ts#validateIdleListingText');
  assert.equal(record.evidence.idleListingRequiredTextValidation, 'packages/shared/src/contracts/idle-listing-text.ts#validateIdleListingRequiredText');
  assert.equal(record.evidence.repairOtherPublicTextValidation, 'packages/shared/src/contracts/repair-other-public-text.ts#validateRepairOtherPublicText');
  assert.equal(record.evidence.errandAttachmentCountValidation, 'packages/shared/src/contracts/errand-attachment-count.ts#validateErrandAttachmentCount');
  assert.equal(record.evidence.errandServiceFeeValidation, 'packages/shared/src/contracts/errand-service-fee.ts#parseErrandServiceFee');
  assert.equal(record.evidence.integerCountRangeHelper, 'packages/shared/src/contracts/integer-count-range.ts#validateIntegerCountInRange');
});

test('SP08 database capability map distinguishes documented platform limits from synthetic probe evidence', () => {
  const map = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'sp08-database-capability-map-20261105.json'), 'utf8'));

  assert.equal(map.taskId, 'SP08');
  assert.equal(map.productAcceptancePassed, false);
  assert.equal(map.cloudMutationsPerformed, false);
  assert.equal(map.selectedDatabase.mode, 'document');
  assert.equal(map.transaction.documented.serverSideOnly, true);
  assert.equal(map.transaction.documented.maxDurationSeconds, 10);
  assert.equal(map.transaction.documented.queryMethods.includes('where'), false);
  assert.equal(map.indexes.documented.uniqueIndex.supported, true);
  assert.equal(map.indexes.documented.uniqueIndex.missingFieldTreatedAsNull, true);
  assert.equal(map.transaction.syntheticProbe.commit.allDocumentsVisible, true);
  assert.equal(map.transaction.syntheticProbe.rollback.noPartialWrites, true);
  assert.equal(map.transaction.syntheticProbe.concurrentIncrement.finalValue, 2);
  assert.equal(map.transaction.syntheticProbe.concurrentIncrement.businessScenariosRepresented, false);
  assert.ok(map.stillUnproven.includes('product-data-access-paths-and-physical-indexes'));
  assert.ok(map.stillUnproven.includes('business-invariant-concurrency'));
  assert.ok(map.sources.some((source) => source.url === 'https://docs.cloudbase.net/database/transaction'));
  assert.ok(map.sources.some((source) => source.url === 'https://docs.cloudbase.net/database/data-index'));
});

test('SP08 logical ownership map covers PRD field groups without pretending to define physical schemas', () => {
  const map = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'sp08-object-ownership-map-20261105.json'), 'utf8'));

  assert.equal(map.taskId, 'SP08');
  assert.equal(map.status, 'logical-draft');
  assert.equal(map.physicalSchemaDefined, false);
  assert.equal(map.cloudMutationsPerformed, false);
  assert.deepEqual(map.fieldGroups.map((group) => group.prdFieldId), Array.from({ length: 22 }, (_, index) => `F${String(index + 1).padStart(2, '0')}`));
  assert.ok(map.fieldGroups.every((group) => (
    group.ownerModule
    && Array.isArray(group.publicView)
    && Array.isArray(group.conditionalView)
    && Array.isArray(group.privateView)
    && group.snapshotRule
  )));
  assert.ok(map.snapshots.some((snapshot) => snapshot.id === 'public-request-projection' && snapshot.versioned === true));
  assert.ok(map.snapshots.some((snapshot) => snapshot.id === 'selected-address' && snapshot.editAfterSelectionChangesPriorSnapshot === false));
  assert.ok(map.snapshots.some((snapshot) => snapshot.id === 'rating-publication' && snapshot.onlyApprovedVersionIsPublic === true));
  assert.ok(map.unresolved.some((item) => item.id === 'errand-attachment-visibility'));
  assert.ok(map.unresolved.some((item) => item.id === 'merchant-post-rule-owner'));
  assert.ok(map.unresolved.some((item) => item.id === 'retention-and-erasure-periods'));
  assert.ok(map.sources.some((source) => source.path === 'docs/prd.md' && source.reference.includes('F01-F22')));
  assert.ok(map.sources.some((source) => source.path === 'docs/backend-architecture-contract-20261103.md' && source.reference.includes('Section 3')));
});

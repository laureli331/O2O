'use strict';

const contract = require('../../utils/probe-contract');
const { createProbeWorkflow } = require('../../utils/probe-workflow');

function randomHex(length = 16) {
  let value = '';
  while (value.length < length) value += Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
  return value.slice(0, length);
}

function wxCall(api, options) {
  return new Promise((resolve, reject) => api({ ...options, success: resolve, fail: reject }));
}

function createLocalFile(text) {
  const filePath = `${wx.env.USER_DATA_PATH}/sp01-${randomHex(16)}.txt`;
  return wxCall(wx.getFileSystemManager().writeFile.bind(wx.getFileSystemManager()), {
    filePath,
    data: text,
    encoding: 'utf8',
  }).then(() => filePath);
}

const workflow = createProbeWorkflow({
  getIdentity: async (nonce) => {
    const response = await wx.cloud.callFunction({ name: 'sp01IdentityProbe', data: { nonce } });
    return response.result;
  },
  createLocalTextFile: createLocalFile,
  removeLocalFile: (filePath) => wxCall(wx.getFileSystemManager().unlink.bind(wx.getFileSystemManager()), { filePath }),
  uploadFile: (cloudPath, filePath) => wx.cloud.uploadFile({ cloudPath, filePath }),
  getTempFileURL: (fileID) => wx.cloud.getTempFileURL({ fileList: [fileID] }),
  downloadFile: (fileID) => wx.cloud.downloadFile({ fileID }),
  readDownloadedText: async (filePath) => {
    const result = await wxCall(wx.getFileSystemManager().readFile.bind(wx.getFileSystemManager()), { filePath, encoding: 'utf8' });
    if (typeof result?.data !== 'string') throw new Error('CONTENT_CHECK_FAILED');
    return result.data;
  },
  deleteFile: (fileID) => wx.cloud.deleteFile({ fileList: [fileID] }),
  makeRunId: () => randomHex(16),
});

function errorCode(error) {
  const code = error?.code || error?.errCode || 'UNKNOWN';
  return /^[A-Za-z0-9_:-]{1,60}$/.test(String(code)) ? String(code).toUpperCase() : 'UNKNOWN';
}

function identityDiagnostic(error) {
  if (errorCode(error) !== 'IDENTITY_CALL_FAILED') return '';
  return `云函数返回码：${error.providerCode || 'UNKNOWN'}；调用请求 ID：${error.requestId || '未提供'}。`
    + `内层错误码：${(error.nestedCodes || []).join(', ') || '未提取到'}；已知错误标记：${(error.markers || []).join(', ') || '未提取到'}。`;
}

function accessLabel(result) {
  if (!result) return '未测试';
  if (result.kind === 'accessible') {
    if (result.matchesOwnerProof === true) return '可以访问，内容与原证明一致';
    if (result.matchesOwnerProof === false) return '可以访问，内容已变化';
    if (result.matchesOwnerProof === null) return '可以访问，内容未能核验';
    return '可以访问';
  }
  const diagnostic = `；内层码：${(result.nestedCodes || []).join(', ') || '未提取到'}；标记：${(result.markers || []).join(', ') || '未提取到'}`;
  if (result.kind === 'denied') return `明确权限拒绝（${result.code}）${diagnostic}`;
  return `无法判定（${result.code || 'UNKNOWN'}）${diagnostic}`;
}

function reportFor(result) {
  if (result.overall === 'same-account-stop') return '身份摘要相同，已停止；没有进行读取、临时链接或写入请求。请确认账号 B 实际登录了另一个微信账号。';
  if (result.overall === 'failed-cleanup') return '本轮有一项清理未确认。请停止重试；查看下方提示，核对相应的本机临时文件或确切云端测试文件。';
  if (result.overall === 'failed-isolation') return '本轮发现跨账号可访问。结果只适用于当前文件、账号和配置；不要在此工具外继续操作。';
  if (result.overall === 'isolated-in-this-test') return '本轮三种访问均得到明确权限拒绝。结论仅限这份文件、这两个身份和当前配置。';
  return '至少一项返回的不是明确权限结果，本轮不能判断隔离是否成立。先核对网络、文件是否存在和返回码，不要把未知错误当作权限拒绝。';
}

Page({
  data: { nonce: '', bundleText: '', busy: false, report: '' },

  onBundleInput(event) { this.setData({ bundleText: event.detail.value, report: '' }); },

  generateNonce() {
    this.setData({ nonce: `sp01-${randomHex(24)}`, bundleText: '', report: '共享码已生成。请由账号 A 创建测试文件，再把完整测试包交给账号 B。' });
  },

  parseBundle() {
    let bundle;
    try { bundle = JSON.parse(this.data.bundleText); } catch (_) { throw Object.assign(new Error(), { code: 'INVALID_JSON' }); }
    if (!contract.validateOwnerBundle(bundle).valid) throw Object.assign(new Error(), { code: 'INVALID_OWNER_BUNDLE' });
    return bundle;
  },

  async checkIdentityOnly() {
    if (this.data.busy) return;
    this.setData({ busy: true, report: '正在单独查询身份；不会创建、上传或删除文件…' });
    try {
      await workflow.identify(`sp01-${randomHex(24)}`);
      this.setData({ report: '身份调用成功，返回格式和目标 AppID 校验通过。未创建测试包或文件，未执行存储权限验证。' });
    } catch (error) {
      this.setData({ report: `身份调用未完成。错误码：${errorCode(error)}。${identityDiagnostic(error)}未创建测试包或文件；不要重复点击。` });
    } finally { this.setData({ busy: false }); }
  },

  async createOwnerFile() {
    if (!contract.validateNonce(this.data.nonce)) {
      this.setData({ report: '测试码格式不正确，请重新生成。' });
      return;
    }
    this.setData({ busy: true, bundleText: '', report: '正在读取当前账号摘要并创建一份合成文件…' });
    try {
      const bundle = await workflow.createOwnerFile(this.data.nonce);
      const bundleText = JSON.stringify(bundle, null, 2);
      this.setData({ bundleText, report: `账号 A 已创建测试文件。身份摘要：${bundle.ownerFingerprint}。本机临时文件清理：${bundle.localTempCleanup}。请复制测试包给账号 B。` });
    } catch (error) {
      const code = errorCode(error);
      const pathNotice = contract.validateCloudPath(error?.cloudPath)
        ? `\n只检查这一条测试路径：${error.cloudPath}。停止重试，不要分享测试包。`
        : '';
      const cleanupNotice = code === 'LOCAL_TEMP_CLEANUP_FAILED'
        ? '本机临时文件清理失败；对应云端测试文件已确认删除。'
        : code === 'OWNER_CLEANUP_PENDING'
          ? '本轮文件清理未获确认。'
          : code === 'OWNER_UPLOAD_FAILED'
            ? '上传结果未确认。'
            : code === 'LOCAL_TEMP_CREATE_FAILED'
              ? '未能创建本机合成临时文件，尚未尝试上传。'
            : '操作未完成。';
      const localCleanupNotice = error?.localTempCleanup === 'cleanup-failed' ? '本机临时文件清理也未获确认。' : '';
      this.setData({ bundleText: '', report: `${cleanupNotice}${localCleanupNotice}错误码：${code}。${identityDiagnostic(error)}没有输出身份原文或临时授权信息。${pathNotice}` });
    } finally { this.setData({ busy: false }); }
  },

  loadBundle() {
    try {
      const bundle = this.parseBundle();
      this.setData({ nonce: bundle.nonce, report: `测试包有效。文件路径：${bundle.cloudPath}。现在可在账号 B 上核对身份。` });
    } catch (error) {
      this.setData({ report: `测试包无效，错误码：${errorCode(error)}。没有发起云端请求。` });
    }
  },

  async runOtherProbe() {
    let bundle;
    try { bundle = this.parseBundle(); } catch (error) {
      this.setData({ report: `测试包无效，错误码：${errorCode(error)}。没有发起云端请求。` });
      return;
    }
    this.setData({ busy: true, report: '先核对当前账号身份。若与创建者相同，后续文件操作会被拦截。' });
    try {
      const result = await workflow.testAsOther(bundle);
      const lines = [
        '存储诊断版本：storage-errors-v1',
        reportFor(result),
        `身份不同：${result.identity.sameAccount ? '否' : '是'}`,
        `临时链接：${accessLabel(result.read?.tempLink)}`,
        `直接下载：${accessLabel(result.read?.direct)}`,
        `同路径写入：${accessLabel(result.overwrite)}`,
      ];
      if (result.overwrite?.cleanup) lines.push(`第二账号写入后的定向清理：${result.overwrite.cleanup.kind}（${result.overwrite.cleanup.code || '无错误码'}）`);
      if (result.overwrite?.localTempCleanup) lines.push(`本机临时文件清理：${result.overwrite.localTempCleanup}`);
      this.setData({ report: lines.join('\n') });
    } catch (error) {
      this.setData({ report: `探针中止，错误码：${errorCode(error)}。没有展示云端错误原文。` });
    } finally { this.setData({ busy: false }); }
  },

  async verifyOwnerFile() {
    let bundle;
    try { bundle = this.parseBundle(); } catch (error) {
      this.setData({ report: `测试包无效，错误码：${errorCode(error)}。没有发起云端请求。` });
      return;
    }
    this.setData({ busy: true, report: '正在核对创建者身份并检查合成文件内容…' });
    try {
      const result = await workflow.verifyOwnerFile(bundle);
      const check = result.contentCheck;
      const diagnostic = check
        ? `\n预期字符数：${check.expectedLength}；实际字符数：${check.actualLength}；文本类型：${check.marker}。`
        : '\n文本诊断不可用。';
      this.setData({ report: `探针版本：owner-read-v3\n创建者文件核验：${accessLabel(result)}。这里只比较合成证明文本，不显示文件内容。${diagnostic}` });
    } catch (error) {
      this.setData({ report: `探针版本：owner-read-v3\n核验未完成，错误码：${errorCode(error)}。` });
    } finally { this.setData({ busy: false }); }
  },

  cleanupOwnerFile() {
    let bundle;
    try { bundle = this.parseBundle(); } catch (error) {
      this.setData({ report: `测试包无效，错误码：${errorCode(error)}。没有发起云端请求。` });
      return;
    }
    wx.showModal({
      title: '删除一份合成文件',
      content: `只删除这份文件：${bundle.cloudPath}`,
      confirmText: '删除文件',
      confirmColor: '#b42318',
      success: async (response) => {
        if (!response.confirm) return;
        this.setData({ busy: true, report: '正在重新核对创建者身份，然后删除测试包中的确切 fileID…' });
        try {
          const result = await workflow.cleanupOwnerFile(bundle);
          this.setData({ report: result.kind === 'deleted' ? 'CloudBase 已确认这份确切 fileID 的删除请求成功。请在控制台只读检查测试目录为空。' : `删除结果未确认，错误码：${result.code || 'UNKNOWN'}。停止重试并检查同一文件。` });
        } catch (error) {
          this.setData({ report: `删除未完成，错误码：${errorCode(error)}。没有扩大删除范围。` });
        } finally { this.setData({ busy: false }); }
      },
    });
  },

  copyBundle() {
    if (!this.data.bundleText) return;
    wx.setClipboardData({ data: this.data.bundleText });
  },
});

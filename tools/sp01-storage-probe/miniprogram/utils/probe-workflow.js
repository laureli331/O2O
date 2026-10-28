'use strict';

const contract = require('./probe-contract');

function createProbeWorkflow(api) {
  async function identify(nonce) {
    if (!contract.validateNonce(nonce)) throw contract.makeProbeError('INVALID_NONCE');
    let result;
    try {
      result = await api.getIdentity(nonce);
    } catch (cause) {
      const error = contract.makeProbeError('IDENTITY_CALL_FAILED');
      Object.assign(error, contract.identityCallDiagnostics(cause));
      throw error;
    }
    if (!result || result.success !== true || !contract.validateFingerprint(result.fingerprint)) {
      throw contract.makeProbeError(result?.errorCode === 'APP_ID_MISMATCH' ? 'WRONG_APP' : 'IDENTITY_CHECK_FAILED');
    }
    if (result.appMatchesTarget !== true) throw contract.makeProbeError('WRONG_APP');
    return result.fingerprint;
  }

  async function attemptTempLink(fileID) {
    try {
      const result = await api.getTempFileURL(fileID);
      const entry = result?.fileList?.[0];
      if (entry?.tempFileURL) return { kind: 'accessible' };
      return contract.classifyStorageError(entry || result);
    } catch (error) {
      return contract.classifyStorageError(error);
    }
  }

  async function attemptDownload(bundle) {
    try {
      const result = await api.downloadFile(bundle.fileID);
      if (!result?.tempFilePath || (result.statusCode !== undefined && result.statusCode !== 200)) {
        return contract.classifyStorageError(result);
      }
      try {
        const content = await api.readDownloadedText(result.tempFilePath);
        return { kind: 'accessible', matchesOwnerProof: content === bundle.ownerContent };
      } catch (_) {
        return { kind: 'accessible', matchesOwnerProof: null, code: 'CONTENT_CHECK_FAILED' };
      }
    } catch (error) {
      return contract.classifyStorageError(error);
    }
  }

  async function attemptOverwrite(bundle) {
    const runId = api.makeRunId();
    if (!contract.validateRunId(runId)) return { kind: 'inconclusive', code: 'INVALID_LOCAL_RUN_ID' };
    const content = `SP01-SYNTHETIC-OTHER:${runId}`;
    let localPath;
    let result;
    let localTempCleanup = 'not-created';
    try {
      localPath = await api.createLocalTextFile(content);
      const upload = await api.uploadFile(bundle.cloudPath, localPath);
      if (!contract.validateFileID(upload?.fileID, bundle.cloudPath)) {
        result = { kind: 'accessible', cleanup: { kind: 'cleanup-pending', code: 'UNEXPECTED_FILE_ID' } };
      } else {
        let cleanup;
        try {
          const deletion = await api.deleteFile(upload.fileID);
          const deleted = deletion?.fileList?.some((entry) => entry?.fileID === upload.fileID && entry.status === 0);
          cleanup = deleted ? { kind: 'deleted' } : { kind: 'cleanup-pending', code: contract.safeCode(deletion?.fileList?.[0] || deletion) };
        } catch (error) {
          cleanup = { kind: 'cleanup-pending', code: contract.safeCode(error) };
        }
        result = { kind: 'accessible', cleanup };
      }
    } catch (error) {
      result = contract.classifyStorageError(error);
    } finally {
      if (localPath) {
        try {
          await api.removeLocalFile(localPath);
          localTempCleanup = 'removed';
        } catch (_) {
          localTempCleanup = 'cleanup-pending';
        }
      }
    }
    return { ...result, localTempCleanup };
  }

  function overallFor(read, overwrite) {
    if (overwrite.kind === 'accessible' && (overwrite.cleanup?.kind !== 'deleted' || overwrite.localTempCleanup !== 'removed')) return 'failed-cleanup';
    if (overwrite.localTempCleanup === 'cleanup-pending') return 'failed-cleanup';
    if (read.tempLink.kind === 'accessible' || read.direct.kind === 'accessible' || overwrite.kind === 'accessible') return 'failed-isolation';
    if (read.tempLink.kind !== 'denied' || read.direct.kind !== 'denied' || overwrite.kind !== 'denied') return 'inconclusive';
    return 'isolated-in-this-test';
  }

  function validateBundleOrThrow(bundle) {
    if (!contract.validateOwnerBundle(bundle).valid) throw contract.makeProbeError('INVALID_OWNER_BUNDLE');
  }

  async function createOwnerFile(nonce) {
    const ownerFingerprint = await identify(nonce);
    const runId = api.makeRunId();
    if (!contract.validateRunId(runId)) throw contract.makeProbeError('INVALID_LOCAL_RUN_ID');
    const cloudPath = `${contract.PROBE_DIRECTORY}/owner-probe-${runId}.txt`;
    const ownerContent = `SP01-SYNTHETIC-OWNER:${runId}`;
    let localPath;
    let upload;
    let operationError;
    let localTempCleanup = 'not-created';
    try {
      localPath = await api.createLocalTextFile(ownerContent);
    } catch (_) {
      operationError = contract.makeProbeError('LOCAL_TEMP_CREATE_FAILED');
    }
    if (!operationError) {
      try {
        upload = await api.uploadFile(cloudPath, localPath);
      } catch (_) {
        operationError = contract.makeProbeError('OWNER_UPLOAD_FAILED');
        operationError.cloudPath = cloudPath;
      }
    }
    if (localPath) {
      try {
        await api.removeLocalFile(localPath);
        localTempCleanup = 'removed';
      } catch (_) {
        localTempCleanup = 'cleanup-failed';
      }
    }
    if (operationError) {
      operationError.localTempCleanup = localTempCleanup;
      throw operationError;
    }
    if (!contract.validateFileID(upload?.fileID, cloudPath)) {
      const error = contract.makeProbeError('OWNER_CLEANUP_PENDING');
      error.cloudPath = cloudPath;
      throw error;
    }
    if (localTempCleanup !== 'removed') {
      let deleted = false;
      try {
        const result = await api.deleteFile(upload.fileID);
        deleted = result?.fileList?.some((entry) => entry?.fileID === upload.fileID && entry.status === 0) === true;
      } catch (_) {
        // Do not expose storage response details or broaden cleanup beyond this file ID.
      }
      if (!deleted) {
        const error = contract.makeProbeError('OWNER_CLEANUP_PENDING');
        error.cloudPath = cloudPath;
        error.fileID = upload.fileID;
        throw error;
      }
      throw contract.makeProbeError('LOCAL_TEMP_CLEANUP_FAILED');
    }
    return {
      version: 1,
      nonce,
      ownerFingerprint,
      fileID: upload.fileID,
      cloudPath,
      ownerContent,
      localTempCleanup: 'removed',
    };
  }

  async function testAsOther(bundle) {
    validateBundleOrThrow(bundle);
    const currentFingerprint = await identify(bundle.nonce);
    const identity = contract.compareIdentity(bundle.ownerFingerprint, currentFingerprint);
    if (!identity.canProbe) {
      return { identity: { ...identity, currentFingerprint }, overall: 'same-account-stop' };
    }
    const read = {
      tempLink: await attemptTempLink(bundle.fileID),
      direct: await attemptDownload(bundle),
    };
    const overwrite = await attemptOverwrite(bundle);
    return { identity: { ...identity, currentFingerprint }, read, overwrite, overall: overallFor(read, overwrite) };
  }

  async function verifyOwnerFile(bundle) {
    validateBundleOrThrow(bundle);
    const currentFingerprint = await identify(bundle.nonce);
    if (currentFingerprint !== bundle.ownerFingerprint) throw contract.makeProbeError('NOT_OWNER_ACCOUNT');
    return attemptDownload(bundle);
  }

  async function cleanupOwnerFile(bundle) {
    validateBundleOrThrow(bundle);
    const currentFingerprint = await identify(bundle.nonce);
    if (currentFingerprint !== bundle.ownerFingerprint) throw contract.makeProbeError('NOT_OWNER_ACCOUNT');
    try {
      const result = await api.deleteFile(bundle.fileID);
      const deleted = result?.fileList?.some((entry) => entry?.fileID === bundle.fileID && entry.status === 0);
      return deleted ? { kind: 'deleted' } : { kind: 'cleanup-pending', code: contract.safeCode(result?.fileList?.[0] || result) };
    } catch (error) {
      return { kind: 'cleanup-pending', code: contract.safeCode(error) };
    }
  }

  return { identify, createOwnerFile, testAsOther, verifyOwnerFile, cleanupOwnerFile };
}

module.exports = { createProbeWorkflow };

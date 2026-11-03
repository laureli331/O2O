'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const review = require('../docs/sp01-readiness-review-20261030.json');
const quality = require('../docs/v1-quality-acceptance-20261027.json');
const plan = require('../docs/v1-executable-development-plan-20261027.json');
const huaweiRenderLayerInspection = require('../docs/sp01-huawei-render-layer-inspection-20261102.json');
const huaweiAutomatedSwipeDiagnostic = require('../docs/sp01-huawei-gfxinfo-automated-swipe-diagnostic-20261102.json');

test('SP01 current review covers the exact contract criteria without silently removing pending preparation', () => {
  const contract = quality.taskContracts.find(x => x.task === 'SP01');
  const criteria = review.qualityReview.flatMap(row => row.criteria);
  assert.deepEqual([...criteria].sort(), [...contract.qualityCriteria].sort());
  assert.equal(new Set(criteria).size, criteria.length);
  assert.deepEqual(review.datasetShapesInherited, quality.measurement.datasetShapes);
  const items = new Set(review.openItems.map(x => x.id));
  assert.equal(items.size, 6);
  for (const row of review.qualityReview) {
    assert.equal(row.productResult, 'not-executed');
    for (const id of row.openItems) assert.ok(items.has(id));
    for (const id of row.laterEvidenceTasks || []) assert.ok(plan.tasks.some(task => task.id === id));
  }
  for (const item of review.openItems) {
    if (item.id === 'R02') {
      assert.equal(item.state, 'verified-for-SP01');
      assert.equal(item.verificationScope, 'SP01-isolated-compatibility-only');
      const evidence = require('../' + item.evidence);
      assert.equal(evidence.checks.sharedFullStrictExitCode, 0);
      assert.equal(evidence.simulator.resetCount0Observed, true);
      assert.equal(evidence.productAcceptancePassed, false);
    } else if (item.id === 'R01') {
      const candidate = require('../docs/sp01-maintenance-candidate-20261030.json');
      const audit = require('../docs/sp01-r01-registry-audit-20261101.json');
      const registryFollowup = require('../docs/sp01-r01-registry-follow-up-20261102.json');
      assert.equal(candidate.adopted, true);
      assert.equal(candidate.audit.after.total, 32);
      assert.equal(audit.fullTree.affectedPackageEntries, 48);
      assert.deepEqual(audit.fullTree.severityEntries, { critical: 4, high: 13, moderate: 31, low: 0, info: 0 });
      assert.equal(audit.fullTree.distinctAdvisoryUrls, 25);
      assert.equal(audit.omitDevAudit.affectedPackageEntries, 19);
      assert.deepEqual(audit.historicalCandidateAudit.severityEntries, { critical: 4, high: 13, moderate: 15, low: 0, info: 0 });
      assert.equal(audit.decision.r01Status, 'pending');
      assert.equal(audit.decision.sp01Passed, false);
      assert.equal(audit.decision.userConfirmedDependencyChoice, 'keep webpack 5.91.0 to match the exact Taro peer; do not adopt the override');
      assert.equal(audit.decision.webpackOverrideAdopted, false);
      assert.doesNotMatch(audit.decision.nextAction, /next decision is whether/);
      assert.equal(item.registryAuditEvidence, 'docs/sp01-r01-registry-audit-20261101.json');
      assert.equal(item.latestRegistryFollowupEvidence, 'docs/sp01-r01-registry-follow-up-20261102.json');
      assert.match(item.known, /用户确认保留Webpack 5\.91\.0/);
      assert.match(item.known, /48个受影响包条目/);
      assert.match(item.known, /32条保留不覆盖/);
      const webpack = audit.reviewedPaths.find((entry) => entry.id === 'webpack-and-h5-devserver');
      assert.equal(webpack.peerConstraint, '@tarojs/webpack5-runner@4.3.1 declares webpack peer version 5.91.0 exactly.');
      assert.equal(webpack.latestVersionOverrideExperiment.weappBuildExitCode, 1);
      assert.match(webpack.latestVersionOverrideExperiment.weappBuildError, /EntryDependency/);
      assert.equal(webpack.minimumPatchedOverrideExperiment.webpack, '5.104.1');
      assert.equal(webpack.minimumPatchedOverrideExperiment.weappTypecheckAndBuildExitCode, 0);
      assert.equal(webpack.minimumPatchedOverrideExperiment.webTypecheckAndBuildExitCode, 0);
      assert.equal(webpack.minimumPatchedOverrideExperiment.decision.startsWith('Isolated candidate only'), true);
      assert.equal(webpack.normalWeappBuildLoadTrace.remoteTemplateFetchPerformed, false);
      assert.equal(webpack.normalWeappBuildLoadTrace.swiperAndH5DevServerModulesRequired, false);
      assert.match(audit.decision.nextAction, /do not adopt.*override/);
      assert.equal(registryFollowup.reviewedPackages['@tarojs/taro'].latestDistTag, '4.3.2');
      assert.equal(registryFollowup.reviewedPackages['@tarojs/cli'].downloadGitRepoDependencyRange, '^3.0.2');
      assert.equal(registryFollowup.reviewedPackages['download-git-repo'].latestDistTag, '3.0.2');
      assert.equal(registryFollowup.reviewedPackages['@tarojs/components'].latestStableDistTag, '4.3.1');
      assert.equal(registryFollowup.reviewedPackages['@tarojs/components'].version431SwiperDependency, '11.1.15');
      assert.deepEqual(registryFollowup.reviewedPackages['@tarojs/taro'].version432PeerRequirements, {
        '@tarojs/helper': '4.3.2',
        '@tarojs/shared': '4.3.2',
        '@tarojs/components': '4.3.2'
      });
      assert.equal(registryFollowup.reviewedPackages['@tarojs/taro'].version432RuntimeDependencies['@tarojs/runtime'], '4.3.2');
      assert.equal(registryFollowup.reviewedPackages['@tarojs/runtime'].version432StablePackageQuery, 'not published (npm returned E404)');
      assert.equal(registryFollowup.reviewedPackages['@tarojs/helper'].version432StablePackageQuery, 'not published (npm returned E404)');
      assert.equal(registryFollowup.releaseFamilyResolution.result, 'incomplete-stable-release-family-at-query-time');
      assert.equal(registryFollowup.reviewedPackages['@tarojs/components'].version432Beta, '4.3.2-beta.2');
      assert.equal(registryFollowup.reviewedPackages['@tarojs/webpack5-runner'].webpackPeer, '5.91.0');
      assert.equal(registryFollowup.reuseDecision.adopted, false);
      assert.equal(registryFollowup.decision.r01Status, 'pending');
      assert.equal(registryFollowup.decision.sp01Passed, false);
      assert.ok(review.sources.includes('docs/sp01-r01-registry-follow-up-20261102.json'));
      assert.ok(review.sources.includes('docs/sp01-r01-registry-follow-up-20261102.md'));
      const registryFollowupMarkdown = fs.readFileSync(path.join(__dirname, '../docs/sp01-r01-registry-follow-up-20261102.md'), 'utf8');
      assert.match(registryFollowupMarkdown, /@tarojs\/cli@4\.3\.2/);
      assert.match(registryFollowupMarkdown, /swiper@11\.1\.15/);
      assert.match(registryFollowupMarkdown, /稳定发布组在本次查询时不完整/);
      assert.match(registryFollowupMarkdown, /R01 继续 pending/);
      const registryRefresh = require('../docs/sp01-r01-registry-refresh-20261103.json');
      const registryRefreshMarkdown = fs.readFileSync(path.join(__dirname, '../docs/sp01-r01-registry-refresh-20261103.md'), 'utf8');
      assert.equal(registryRefresh.queries['@tarojs/components@4.3.2'].result, 'published');
      assert.equal(registryRefresh.queries['@tarojs/helper@4.3.2'].result, 'published');
      assert.equal(registryRefresh.queries['@tarojs/runtime@4.3.2'].result, 'published');
      assert.equal(registryRefresh.historicalCorrection.historicalSnapshotPreserved, true);
      assert.equal(registryRefresh.scope.manifestOrLockChanged, false);
      assert.equal(registryRefresh.decision.r01Status, 'pending');
      assert.equal(registryRefresh.decision.sp01Passed, false);
      assert.equal(registryRefresh.decision.sp07Started, false);
      assert.equal(item.latestRegistryRefreshEvidence, 'docs/sp01-r01-registry-refresh-20261103.json');
      assert.ok(review.sources.includes('docs/sp01-r01-registry-refresh-20261103.json'));
      assert.ok(review.sources.includes('docs/sp01-r01-registry-refresh-20261103.md'));
      assert.match(registryRefreshMarkdown, /更正.*11 月 2 日/);
      assert.match(registryRefreshMarkdown, /R01 继续 pending/);
      const planSp01 = plan.tasks.find((task) => task.id === 'SP01');
      assert.equal(planSp01.executionProgress.latestRegistryRefreshEvidence, 'docs/sp01-r01-registry-refresh-20261103.json');
      assert.ok(plan.sources.includes('docs/sp01-r01-registry-refresh-20261103.json'));
      assert.ok(plan.sources.includes('docs/sp01-r01-registry-refresh-20261103.md'));
      assert.equal(item.state, 'pending');
      assert.match(item.nextAction, /已完成实际Gitee clone=true抓取集成核对/);
      assert.match(item.nextAction, /R01及SP01保持pending/);
      const decompressInterop = require('../docs/sp01-taro-decompress-interop-20261103.json');
      const decompressInteropMarkdown = fs.readFileSync(path.join(__dirname, '../docs/sp01-taro-decompress-interop-20261103.md'), 'utf8');
      assert.equal(decompressInterop.chain.download.version, '7.1.0');
      assert.equal(decompressInterop.chain.vulnerablePackage.version, '4.2.1');
      assert.equal(decompressInterop.chain.maintainedFork.version, '10.2.2');
      assert.equal(decompressInterop.chain.downloadGitRepo.version, '3.0.2');
      assert.equal(decompressInterop.localExperiment.npmOverrideGraphVerified, true);
      assert.equal(decompressInterop.directCommonJsCall.actualError, 'TypeError: decompress is not a function');
      assert.equal(decompressInterop.directCommonJsCall.outputDirectoryCreated, false);
      assert.equal(decompressInterop.defaultExportAdapterExtraction.adapterIsTestOnly, true);
      assert.equal(decompressInterop.defaultExportAdapterExtraction.extractedCharacterCount, 38);
      assert.equal(decompressInterop.scope.securityFindingResolved, false);
      assert.equal(decompressInterop.directCommonJsCall.outcome, 'type-error-decompress-is-not-a-function');
      assert.equal(decompressInterop.defaultExportAdapterExtraction.extractedContentMatched, true);
      assert.equal(decompressInterop.scope.formalDependenciesChanged, false);
      assert.equal(decompressInterop.scope.taroRemoteTemplateEndToEndExecuted, false);
      assert.equal(decompressInterop.scope.maliciousArchiveOrVulnerabilityExploitTested, false);
      assert.equal(decompressInterop.cliTemplateCallPath.githubTemplateCanReachDownloadAndDecompress, true);
      assert.equal(decompressInterop.cliTemplateCallPath.giteeCloneAvoidsDownloadAndDecompress, true);
      assert.equal(decompressInterop.localTemplateFetchIntegration.success, true);
      assert.equal(decompressInterop.localTemplateFetchIntegration.syntheticZipContentMatched, true);
      assert.equal(decompressInterop.localTemplateFetchIntegration.externalNetworkRequests, 0);
      assert.equal(decompressInterop.localTemplateFetchIntegration.cloudCalls, 0);
      assert.equal(decompressInterop.localTemplateFetchIntegration.archiveBytes, 179);
      assert.equal(decompressInterop.localTemplateFetchIntegration.temporaryDirectoryRemovedAfterRun, true);
      assert.equal(decompressInterop.localGiteeCloneIntegration.success, true);
      assert.equal(decompressInterop.localGiteeCloneIntegration.installedCliFunctionInvoked, true);
      assert.equal(decompressInterop.localGiteeCloneIntegration.cloneBranch, true);
      assert.equal(decompressInterop.localGiteeCloneIntegration.gitFixtureContentMatched, true);
      assert.equal(decompressInterop.localGiteeCloneIntegration.gitMetadataRemovedFromOutput, true);
      assert.equal(decompressInterop.localGiteeCloneIntegration.externalNetworkRequests, 0);
      assert.equal(decompressInterop.localGiteeCloneIntegration.actualGiteeRemoteRequested, false);
      assert.equal(decompressInterop.localGiteeCloneIntegration.decompressInvocations, 0);
      assert.equal(decompressInterop.localGiteeCloneIntegration.temporaryDirectoryRemovedAfterRun, true);
      const actualGitee = decompressInterop.actualGiteeRemoteFetchIntegration;
      assert.equal(actualGitee.success, true);
      assert.equal(actualGitee.sourceCommit, 'c4cd3830794aa4e053d1c20e991d125f586cd1d9');
      assert.equal(actualGitee.cloneBranch, true);
      assert.equal(actualGitee.sourceTemplateDirectories, 15);
      assert.equal(actualGitee.fetchedTemplateDirectories, 15);
      assert.equal(actualGitee.sourceFilesCompared, 535);
      assert.equal(actualGitee.matchedFiles, 535);
      assert.deepEqual(actualGitee.mismatches, []);
      assert.equal(actualGitee.destinationsContainingGitMetadata, 0);
      assert.equal(actualGitee.decompressFunctionCalls, 0);
      assert.equal(actualGitee.taroTemporaryDirectoryRemoved, true);
      assert.equal(actualGitee.dependenciesInstalled, false);
      assert.equal(actualGitee.projectInitialized, false);
      assert.equal(actualGitee.rootLicenseFilesFound, 0);
      assert.equal(actualGitee.repositoryLicense, 'unknown');
      assert.equal(actualGitee.adopted, false);
      assert.equal(decompressInterop.scope.templateFetchFunctionIntegrationExecuted, true);
      assert.equal(decompressInterop.scope.templateFetchCloneIntegrationExecuted, true);
      assert.equal(decompressInterop.scope.actualGiteeRemoteTemplateFetchExecuted, true);
      assert.equal(decompressInterop.decision.r01Status, 'pending');
      assert.equal(decompressInterop.decision.sp01Passed, false);
      assert.equal(item.latestDecompressInteropEvidence, 'docs/sp01-taro-decompress-interop-20261103.json');
      assert.match(item.latestDecompressInteropSummary, /actual Gitee.*535 files/);
      assert.ok(review.sources.includes('docs/sp01-taro-decompress-interop-20261103.json'));
      assert.ok(review.sources.includes('docs/sp01-taro-decompress-interop-20261103.md'));
      assert.equal(planSp01.executionProgress.latestDecompressInteropEvidence, 'docs/sp01-taro-decompress-interop-20261103.json');
      assert.match(planSp01.executionProgress.latestTemplateFetchIntegrationSummary, /actual Gitee.*535 files/);
      assert.match(item.latestDecompressInteropSummary, /local Git clone fixture/);
      assert.match(planSp01.executionProgress.latestTemplateFetchIntegrationSummary, /local Git clone fixture/);
      assert.ok(plan.sources.includes('docs/sp01-taro-decompress-interop-20261103.json'));
      assert.ok(plan.sources.includes('docs/sp01-taro-decompress-interop-20261103.md'));
      assert.match(decompressInteropMarkdown, /直接CommonJS调用失败/);
      assert.match(decompressInteropMarkdown, /合成ZIP解压通过/);
      assert.match(decompressInteropMarkdown, /本机回环集成调用.*模板抓取函数/);
      assert.match(decompressInteropMarkdown, /本机 Git 克隆集成.*Gitee `clone=true` 分支/);
      assert.match(decompressInteropMarkdown, /未执行完整交互式 taro init 或恶意归档测试/);
      assert.match(decompressInteropMarkdown, /Gitee 默认源.*clone=true/);
      assert.match(decompressInteropMarkdown, /实际 Gitee.*535 个文件/);
      assert.match(decompressInteropMarkdown, /许可证.*未知/);
    } else if (item.id === 'R03') {
      const capability = require('../docs/sp01-device-capability-20261030.json');
      const readinessMarkdown = fs.readFileSync(path.join(__dirname, '../docs/sp01-readiness-review-20261030.md'), 'utf8');
      assert.equal(item.state, 'pending');
      assert.equal(item.latestLocalProbeRevision.revision, 'device-capability-v2-20261101-r1');
      assert.equal(item.latestLocalProbeRevision.phoneRetest, 'confirmed; route duration field is undefined');
      assert.equal(item.latestLocalProbeRevision.phoneReportEvidence, 'docs/sp01-device-capability-20261030.json#localTests.latestProbeRevision.phoneResult');
      assert.equal(item.iphoneSystemUpdateReported, 'User reports iPhone XR updated to iOS 18.7.11 after Developer Mode remained unavailable; no post-update capability report has been supplied');
      assert.equal(item.userReportedMacAccess, 'none; user reports currently no Mac');
      assert.deepEqual(item.iphoneFrameSamplingDecision, {
        date: '2026-11-01',
        externalCameraMethod: 'declined-by-user',
        decision: 'Keep the iPhone frame-sampling gap open until a suitable iPhone frame-by-frame tool is available',
        opticalCaptureImplemented: false,
        acceptanceEvidence: false,
      });
      assert.deepEqual(item.iphoneFrameSamplingToolReview, {
        reviewedAt: '2026-11-01',
        candidate: 'GameBench Pro Desktop',
        status: 'candidate-not-validated',
        currentWindowsEvidence: '2024 release notes say iOS 17.4+ profiling on Windows and a current guide documents iOS 17.4+ wireless setup on Windows; current requirements separately say iOS 17 profiling needs macOS 13+ and latest Xcode, so wired Windows support is unresolved',
        perFrameEvidence: 'current release notes say wired iOS sessions retain frame times and jank; dashboard documentation offers timeline export but does not specify per-frame export granularity or format',
        blockingConflict: 'current requirements page says profiling iOS 17 requires macOS 13+ and latest Xcode, while release notes and a Windows setup guide describe Windows support; target iPhone XR on iOS 18.7.11 is untested',
        targetDeviceValidation: 'not-tested-on-iPhone-XR-iOS-18.7.11',
        miniProgramWebViewAttribution: 'not-validated; vendor warns that FPS may track the wrong onscreen element, and WeChat mini-program WebView attribution is undocumented',
        localOnlyMode: 'vendor documents disabling screenshots and automatic sync, with session upload initiated through a Cloud button; local-only behavior must be verified before capture',
        sourceAndReuse: 'proprietary measurement product; source code and an open-source license were not verified; no product-code dependency adopted; temporary external-tool candidate only',
        cost: 'official trial page advertises 30 minutes of testing over 28 days with no credit card; account signup and paid pricing after trial are not verified',
        officialDownloadAccess: {
          checkedAt: '2026-11-01',
          installerAvailability: 'official dashboard Downloads page; public installation guide has no direct installer link',
          userAuthenticationRequiredForDownloads: true,
          installerObtained: false,
          userActionRequired: 'none; user reports having no GameBench account, and no registration or account creation is requested',
        },
        userAccountStatus: 'User reports no GameBench account; no account registration requested',
        noAccountCandidateReview: {
          checkedAt: '2026-11-01',
          decision: 'No reviewed candidate currently meets QP05 evidence requirements. Do not install or run the unsigned KeyMob executable. Keep the iPhone frame-sampling gap open.',
          keymob: {
            sources: [
              'https://keymob.com/download/',
              'https://keymob.com/guides/faq/',
              'https://www.keymob.com/guides/performance-monitoring/',
              'https://keymob.com/guides/fps-and-jank/',
              'https://keymob.com/privacy/',
              'https://www.keymob.com/download.html',
            ],
            accountAndCost: 'Current download and FAQ say no account/login; charts are trial-limited to 1 minute per app launch and full chart/history access requires VIP. A legacy download page still describes a registered-account 7-day trial, so vendor pages conflict.',
            measurementScope: 'Vendor says a mini-program can be selected as its own process and defines its counter as frames presented per second; it also says it cannot debug WebView contents. No public evidence documents raw per-frame timestamps, input trajectories, or QP05 long-frame attribution/export.',
            privacy: 'Current policy says viewed device metrics/logs/files are displayed locally, while the app reports device model, OS, device identifier and usage/error diagnostics. No account is required for the free path.',
            windowsInstall: 'Windows 10/11 x64; vendor may require a separate Apple device driver; Windows 11 includes WebView2 per vendor docs.',
            packageStaticInspection: {
              downloadedFromOfficialLink: true,
              redirectedHost: 'downloadfiles.kxdang.com',
              archiveBytes: 21438202,
              archiveSha256: '45123DC80E440BBC892F150FA165CAC94CD0DB5089C49A3B6A84F1FF25E04985',
              entryCount: 1,
              executableBytes: 51908608,
              executableSha256: '44CDC3687DF373BF2F20CC5ED3DD44DE2E34D6D8B0426CF15A1BB2AE20B8BBF0',
              authenticodeStatus: 'NotSigned',
              publisherAndVersionMetadata: 'not present',
              executed: false,
              localArchivePath: 'E:/O2O/.codex-tmp/keymob-static-review-20261101/keymob-win-x86_64.zip',
            },
            qp05Evidence: false,
          },
          lazyios: {
            source: 'https://github.com/Manuel-1312/lazyios',
            license: 'GPL-3.0-or-later',
            latestReviewedCommit: 'cfc49978da814c8b16d934af73a0b57100f43932',
            latestReviewedCommitDate: '2026-10-26',
            sourceFinding: 'Windows-capable CLI uses pymobiledevice3 Graphics.fps(); the pinned-compatible upstream Graphics API yields whole-display Core Animation FPS about once per second, not per-frame timestamps. It requires the iPhone to trust the computer and Developer Mode to be enabled.',
            qp05Evidence: false,
            installed: false,
          },
          mobileProfiler: {
            source: 'https://github.com/lemon08x/mobile-profiler',
            license: 'not declared in GitHub repository metadata',
            latestReviewedCommit: '71813b98a0f6b82d66a39eaba43717d73d89adc2',
            latestReviewedCommitDate: '2026-07-24',
            sourceFinding: 'Large cross-platform profiler with an optional pymobiledevice3 iOS sidecar; inspected iOS collector uses DVT Graphics samples and about-one-second performance sampling. No evidence of per-frame input-aligned trace for this mini-program.',
            qp05Evidence: false,
            adopted: false,
          },
        },
        localTrialProgress: 'No GameBench account is available and no registration was requested. The KeyMob archive was downloaded from its official download link for static inspection only; its executable is unsigned and has not been run or installed. No accountless candidate currently satisfies QP05.',
        sources: [
          'https://docs.gamebench.net/docs/studio-pro-desktop/requirements/',
          'https://docs.gamebench.net/docs/studio-pro-desktop/relnotes/v1-30-0/',
          'https://docs.gamebench.net/docs/studio-pro-desktop/relnotes/v1-38-4/',
          'https://docs.gamebench.net/docs/studio-pro-desktop/wireless-testing-ios17plus-method-2/',
          'https://docs.gamebench.net/docs/studio-pro-desktop/configuration/',
          'https://docs.gamebench.net/docs/studio-pro-desktop/getting-started/',
          'https://docs.gamebench.net/docs/web-dashboard/getting-started/',
          'https://docs.gamebench.net/docs/web-dashboard/session-detail/metrics-timeline/',
          'https://docs.gamebench.net/docs/web-dashboard/session-detail/fps/',
          'https://trial.gamebench.net/',
        ],
        installAuthorized: true,
        cloudUploadAuthorized: false,
        acceptanceEvidence: false,
      });
      assert.match(item.nextAction, /GameBench requires signed-in dashboard access.*user reports having no account/s);
      assert.match(item.nextAction, /user reports having no account.*do not ask them to register or download it/s);
      assert.match(item.nextAction, /KeyMob candidate was checked.*EXE is unsigned/s);
      assert.match(item.nextAction, /lazyios.*mobile-profiler.*neither provides per-frame\/input-aligned evidence/s);
      assert.match(item.nextAction, /do not install these candidates/);
      assert.match(item.nextAction, /Do not use external-camera capture/);
      assert.match(item.nextAction, /Keep the iPhone gap open/);
      assert.match(readinessMarkdown, /用户明确拒绝外拍\/光学测量方案，决定保留 iPhone 逐帧证据缺口/);
      assert.match(readinessMarkdown, /GameBench Pro Desktop 经官方资料初筛后仅作为候选工具，尚未安装或验证/s);
      assert.match(readinessMarkdown, /用户明确表示没有 GameBench 账号，不要求用户注册或另建账号/s);
      assert.match(readinessMarkdown, /无账号候选复核/);
      assert.match(readinessMarkdown, /Windows ZIP 仅作静态检查.*未签名且无发布者\/版本元数据/s);
      assert.match(readinessMarkdown, /目前没有已验证的无账号候选满足验收合同/s);
      assert.match(readinessMarkdown, /Windows\/iOS 兼容性有资料冲突.*macOS 13.*Xcode/s);
      assert.match(item.developerModeExplanation, /pairing is initiated or the device was previously paired with a Mac/);
      assert.equal(item.evidence, 'docs/sp01-device-capability-20261030.json');
      assert.equal(capability.documentedRuntimeCapabilities.apiCanProveLiveFps, false);
      assert.equal(capability.routeDurationOfficialDefinition.routeMetricDefinition, 'route processing time; entryType navigation');
      assert.equal(capability.routeDurationOfficialDefinition.officialRuntimeCauseDocumented, false);
      assert.equal(capability.routeDurationOfficialDefinition.sourceUrl, capability.sources.officialPerformanceTypingsSource);
      assert.equal(capability.realDeviceRuns.length, 4);
      assert.ok(capability.realDeviceRuns.every((run) => run.renderer === 'webview'));
      assert.ok(capability.realDeviceRuns.every((run) => run.performanceApiAvailable && run.observerRegistered));
      assert.ok(capability.realDeviceRuns.every((run) => run.supportedEntryTypes.join(',') === 'interaction,loadPackage,navigation,render,resource,script'));
      assert.ok(capability.realDeviceRuns.filter((run) => run.id !== 'DEVICE04').every((run) => run.currentEntries === 'not-provided'));
      assert.equal(capability.realDeviceRuns.find((run) => run.id === 'DEVICE04').currentEntries, 'see DEVICE04-GPU-PROFILE-1');
      assert.equal(capability.revisedProbeRetests.length, 3);
      const firstRetest = capability.revisedProbeRetests.find((run) => run.id === 'DEVICE01-REVISED-1');
      assert.equal(firstRetest.probeCommit, 'aa61c9a');
      assert.equal(firstRetest.reportedEntryRowCount, 20);
      const retest = capability.revisedProbeRetests.find((run) => run.id === 'DEVICE01-DURATION-FIX-1');
      assert.ok(retest, 'the corrected formatter has a fresh OPPO report');
      assert.equal(retest.probeCommit, '6c4636a');
      assert.equal(retest.reportedEntryRowCount, 20);
      assert.deepEqual(retest.entryTypeCounts, { script: 1, navigation: 2, render: 10, interaction: 6, loadPackage: 1, resource: 0 });
      assert.equal(retest.recognizedEntryCount, 10);
      assert.deepEqual(retest.unrecognizedEntryCountsByType, { render: 4, interaction: 6 });
      assert.equal(retest.rowsWithDisplayedDurationCount, 14);
      assert.equal(retest.rowsWithoutDisplayedDurationCount, 6);
      assert.equal(retest.routeDurationMissing, true);
      assert.equal(retest.mergedSourcesMayDuplicateRows, true);
      assert.deepEqual(retest.unrecognizedDurationSamplesMsByType, { render: [569, 560, 569, 560], interaction: [4, 1, 1, 4, 1, 1] });
      assert.equal(retest.fpsOrFrameMetricReported, false);
      assert.equal(retest.cloudOrNetworkUsed, false);
      const snapshotRetest = capability.revisedProbeRetests.find((run) => run.id === 'DEVICE01-SNAPSHOT-FIX-1');
      assert.equal(snapshotRetest.probeCommitRequested, '7e9ba98');
      assert.equal(snapshotRetest.probeRevisionEmbeddedInReport, false);
      assert.equal(snapshotRetest.reportedEntryRowCount, 10);
      assert.deepEqual(snapshotRetest.entryTypeCounts, { script: 1, navigation: 2, render: 5, interaction: 2, loadPackage: 0, resource: 0 });
      assert.equal(snapshotRetest.recognizedEntryCount, 7);
      assert.deepEqual(snapshotRetest.unrecognizedEntryCountsByType, { render: 1, interaction: 2 });
      assert.deepEqual(snapshotRetest.unrecognizedDurationSamplesMsByType, { render: [591], interaction: [4, 1] });
      assert.equal(snapshotRetest.rowsWithDisplayedDurationCount, 6);
      assert.equal(snapshotRetest.rowsWithoutDisplayedDurationCount, 4);
      assert.equal(snapshotRetest.routeDurationMissing, true);
      assert.equal(snapshotRetest.visibleRepeatedTypeDurationPatterns, false);
      assert.equal(snapshotRetest.fpsOrFrameMetricReported, false);
      assert.equal(snapshotRetest.cloudOrNetworkUsed, false);
      assert.match(capability.fpsMeasurementResearch.status, /SurfaceFlinger TimeStats ran on the connected Android 10 Huawei/);
      assert.equal(capability.fpsMeasurementResearch.androidCandidate.bestAvailableDevice, 'DEVICE04 HUAWEI SEA-AL10, Android 10, user-selected 60Hz');
      assert.match(capability.fpsMeasurementResearch.androidCandidate.deviceAvailability, /did not find System Tracing/);
      assert.equal(capability.fpsMeasurementResearch.androidCandidate.unverified.length, 2);
      const surfaceFlinger = capability.fpsMeasurementResearch.surfaceFlingerTimeStats;
      assert.match(surfaceFlinger.method, /dumpsys SurfaceFlinger --timestats/);
      assert.equal(surfaceFlinger.aospAndroid10SupportConfirmed, true);
      assert.equal(surfaceFlinger.huaweiRuntimeSupportVerified, true);
      assert.equal(surfaceFlinger.wechatLayerAttributionVerified, true);
      assert.equal(surfaceFlinger.contractSamplerApproved, false);
      const capture = surfaceFlinger.latestFeasibilityCapture;
      assert.equal(capture.deviceModel, 'SEA-AL10');
      assert.equal(capture.androidVersion, '10');
      assert.equal(capture.foregroundActivity, 'com.tencent.mm/.plugin.appbrand.ui.AppBrandUI00');
      assert.equal(capture.layerName, 'com.tencent.mm/com.tencent.mm.plugin.appbrand.ui.AppBrandUI00#0');
      assert.equal(capture.totalFrames, 25);
      assert.equal(capture.averageFPS, 31.25);
      assert.deepEqual(capture.nonzeroPresent2PresentBuckets, { '16ms': 23, '82ms': 1, '350ms': 1 });
      assert.equal(capture.reportedDisplayOnTimeMs, 33664);
      assert.equal(capture.scrollActionConfirmed, false);
      assert.equal(capture.acceptanceEvidence, false);
      assert.equal(capture.collectionDisableExitCode, 0);
      const gfxinfo = capability.fpsMeasurementResearch.gfxinfoFramestats;
      assert.equal(gfxinfo.mainProcessIsMiniProgramView, false);
      assert.equal(gfxinfo.appBrandProcess, 'com.tencent.mm:appbrand0');
      assert.equal(gfxinfo.viewRootWindow, 'com.tencent.mm/com.tencent.mm.plugin.appbrand.ui.AppBrandUI00');
      assert.equal(gfxinfo.totalFrames, 1070);
      assert.equal(gfxinfo.jankyFrames, 13);
      assert.equal(gfxinfo.percentile99Ms, 17);
      assert.equal(gfxinfo.recentProfileRowCount, 10);
      assert.equal(gfxinfo.longestRecentIntendedVsyncIntervalMs, 115.81);
      assert.equal(gfxinfo.resetCommandVerifiedOnHuawei, true);
      assert.equal(gfxinfo.acceptanceEvidence, false);
      assert.equal(gfxinfo.currentPreResetReadOnlySnapshot.totalFrames, 3033);
      assert.equal(gfxinfo.currentPreResetReadOnlySnapshot.jankyFrames, 13);
      assert.equal(gfxinfo.currentPreResetReadOnlySnapshot.jankyPercent, 0.43);
      assert.equal(gfxinfo.currentPreResetReadOnlySnapshot.resetCommandVerifiedOnHuawei, true);
      assert.equal(gfxinfo.postResetVerification.resetExitCode, 0);
      assert.equal(gfxinfo.postResetVerification.totalFramesAfterReset, 66);
      assert.equal(gfxinfo.postResetVerification.jankyFramesAfterReset, 0);
      assert.equal(gfxinfo.postResetVerification.acceptanceEvidence, false);
      assert.equal(gfxinfo.preScrollReadOnlySnapshot.totalFrames, 301);
      assert.equal(gfxinfo.preScrollReadOnlySnapshot.acceptanceEvidence, false);
      assert.equal(gfxinfo.controlledScrollWindowReset.resetExitCode, 0);
      assert.equal(gfxinfo.controlledScrollWindowReset.summaryQueryExitCode, 0);
      assert.equal(gfxinfo.controlledScrollWindowReset.totalFramesImmediatelyAfterReset, 0);
      assert.equal(gfxinfo.controlledScrollWindowReset.jankyFramesImmediatelyAfterReset, 0);
      assert.equal(gfxinfo.controlledScrollWindowReset.foregroundViewRootObserved, true);
      assert.equal(gfxinfo.controlledScrollWindowReset.acceptanceEvidence, false);
      const scrollAttempt = gfxinfo.firstUserScrollAttempt;
      assert.equal(scrollAttempt.framestatsExitCode, 0);
      assert.equal(scrollAttempt.totalFramesSinceReset, 1636);
      assert.equal(scrollAttempt.jankyFramesSinceReset, 0);
      assert.equal(scrollAttempt.elapsedFromResetToCaptureMs, 240572.4);
      assert.equal(scrollAttempt.profileRowsReturned, 10);
      assert.equal(scrollAttempt.nonzeroNewestInputEventCount, 0);
      assert.equal(scrollAttempt.oldestInputEventSentinelCount, 10);
      assert.equal(scrollAttempt.acceptanceEvidence, false);
      assert.equal(scrollAttempt.profileDataRows.length, 10);
      const liveAttempt = gfxinfo.livePollScrollAttempt;
      assert.equal(liveAttempt.captureDurationMs, 15226);
      assert.equal(liveAttempt.userConfirmedApproximateScrollDurationMs, 5000);
      assert.equal(liveAttempt.gestureStartStopTimestamped, false);
      assert.equal(liveAttempt.pollingSeriesElapsedTotalJanky.length, 43);
      assert.equal(liveAttempt.totalFramesAtEnd, 203);
      assert.equal(liveAttempt.jankyFramesAtEnd, 1);
      assert.equal(liveAttempt.nonzeroNewestInputEventCount, 0);
      assert.equal(liveAttempt.finalProfileDataRows.length, 10);
      assert.equal(liveAttempt.acceptanceEvidence, false);
      const syntheticSwipe = gfxinfo.syntheticSwipeFeasibilitySample;
      assert.equal(syntheticSwipe.deviceModel, 'SEA-AL10');
      assert.equal(syntheticSwipe.inputType, 'ADB-injected-synthetic-touch-events');
      assert.equal(syntheticSwipe.durationArgumentMs, 5000);
      assert.equal(syntheticSwipe.commandWallMs, 5419.1);
      assert.equal(syntheticSwipe.totalFramesRendered, 93);
      assert.equal(syntheticSwipe.jankyFrames, 0);
      assert.equal(syntheticSwipe.recentFrameStatsRows, 10);
      assert.equal(syntheticSwipe.oldestInputEventNoEventSentinelCount, 10);
      assert.equal(syntheticSwipe.newestInputEventNonzeroCount, 0);
      assert.equal(syntheticSwipe.maxAdjacentIntendedVsyncGapMsInRecentRows, 33.07);
      assert.equal(syntheticSwipe.recentRowsGapsOver100ms, 0);
      assert.equal(syntheticSwipe.webviewFrameAttributionVerified, false);
      assert.equal(syntheticSwipe.fpsInterpretable, false);
      assert.equal(syntheticSwipe.acceptanceEvidence, false);
      const trace = gfxinfo.localTraceFeasibilitySample;
      assert.equal(trace.atraceExitCode, 0);
      assert.equal(trace.syntheticSwipeExitCode, 0);
      assert.equal(trace.traceEntriesInBuffer, trace.traceEntriesWritten);
      assert.ok(trace.appBrandDoFrameMarkerCount > 0);
      assert.ok(trace.appBrandDeliverInputMarkerCount > 0);
      assert.equal(trace.isolatedWebviewPresentFramesFound, false);
      assert.equal(trace.fpsInterpretable, false);
      assert.equal(trace.acceptanceEvidence, false);
      const oppoTrace = gfxinfo.oppoFrameTimelineFeasibilitySample;
      assert.equal(oppoTrace.deviceModel, 'PLJ110');
      assert.equal(oppoTrace.thirdTraceAppBrandFrameCount, 84);
      assert.ok(oppoTrace.thirdTraceInputDeliverySliceCount > 0);
      assert.equal(oppoTrace.selectedRefreshHz, 120);
      assert.equal(oppoTrace.isolatedWebviewLayerVerified, false);
      assert.equal(oppoTrace.actualProductHeavyContentTested, false);
      assert.equal(oppoTrace.fpsInterpretableForQp05, false);
      assert.equal(oppoTrace.acceptanceEvidence, false);
      const oppo60 = gfxinfo.oppo60HzMethodCheck;
      assert.equal(oppo60.deviceModel, 'PLJ110');
      assert.equal(oppo60.activeDisplayHz, 60);
      assert.equal(oppo60.secondTraceAppBrandFrameCount, 152);
      assert.equal(oppo60.isolatedWebviewLayerVerified, false);
      assert.equal(oppo60.acceptanceEvidence, false);
      const frameTimelineOnly = gfxinfo.oppoFrameTimelineOnlyRetest;
      assert.equal(frameTimelineOnly.date, '2026-11-01');
      assert.equal(frameTimelineOnly.activeDisplayHz, 60);
      assert.equal(frameTimelineOnly.manualAttempt.userReportedWindowMissed, true);
      assert.equal(frameTimelineOnly.manualAttempt.actualFrameCount, 9);
      assert.equal(frameTimelineOnly.manualAttempt.statusBarNamedFrameCount, 3);
      assert.equal(frameTimelineOnly.manualAttempt.unnamedFrameCount, 6);
      assert.equal(frameTimelineOnly.manualAttempt.appBrandFrameCount, 0);
      assert.equal(frameTimelineOnly.manualAttempt.userGestureEvidence, false);
      assert.equal(frameTimelineOnly.syntheticAttempt.traceDurationMs, 8000);
      assert.equal(frameTimelineOnly.syntheticAttempt.swipeDurationArgumentMs, 5000);
      assert.equal(frameTimelineOnly.syntheticAttempt.actualFrameCount, 94);
      assert.equal(frameTimelineOnly.syntheticAttempt.appBrandFrameCount, 45);
      assert.equal(frameTimelineOnly.syntheticAttempt.appBrandFrameSpanSeconds, 1.034);
      assert.equal(frameTimelineOnly.syntheticAttempt.maxAdjacentAppBrandFrameGapMs, 329.87);
      assert.equal(frameTimelineOnly.syntheticAttempt.traceProcessorNonzeroErrorStats, 0);
      assert.equal(frameTimelineOnly.syntheticAttempt.userGestureEvidence, false);
      assert.equal(frameTimelineOnly.syntheticAttempt.fpsInterpretable, false);
      const manualCapture = frameTimelineOnly.manualScrollCapture;
      assert.equal(manualCapture.status, 'completed-manual-scroll-method-evidence-only');
      assert.equal(manualCapture.traceConfig.durationMs, 20000);
      assert.equal(manualCapture.traceConfig.dataSource, 'android.surfaceflinger.frametimeline');
      assert.equal(manualCapture.activeDisplayHz, 60);
      assert.equal(manualCapture.userReportedApproximateScrollDurationMs, 5000);
      assert.equal(manualCapture.userConfirmedScrollCompletedDuringCapture, true);
      assert.equal(manualCapture.gestureStartStopTimestamped, false);
      assert.equal(manualCapture.inputTracksIncluded, false);
      assert.equal(manualCapture.appBrandLayer, 'TX - VRI-com.tencent.mm/com.tencent.mm.plugin.appbrand.ui.AppBrandUI00#589005');
      assert.equal(manualCapture.actualFrameCount, 538);
      assert.equal(manualCapture.expectedFrameCount, 538);
      assert.equal(manualCapture.actualFrameTimestampSpanSeconds, 10.079);
      assert.equal(manualCapture.expectedFrameTimestampSpanSeconds, 10.079);
      assert.deepEqual(manualCapture.presentTypeCounts, { 'On-time Present': 538 });
      assert.deepEqual(manualCapture.jankTypeCounts, { None: 538 });
      assert.deepEqual(manualCapture.jankSeverityTypeCounts, { None: 538 });
      assert.equal(manualCapture.onTimeFinishCount, 538);
      assert.equal(manualCapture.maxAdjacentAppBrandFrameGapMs, 317.55);
      assert.equal(manualCapture.unnamedLayerFrameCount, 542);
      assert.equal(manualCapture.unnamedLayerFrameTimestampSpanSeconds, 12.163);
      assert.equal(manualCapture.statusBarFrameCount, 1);
      assert.equal(manualCapture.navigationBarFrameCount, 1);
      assert.equal(manualCapture.traceProcessorNonzeroErrorStats, 0);
      assert.equal(manualCapture.isolatedWebviewPresentFramesVerified, false);
      assert.equal(manualCapture.gestureSegmentInterpretable, false);
      assert.equal(manualCapture.fpsInterpretable, false);
      assert.equal(manualCapture.acceptanceEvidence, false);
      assert.equal(manualCapture.remoteTemporaryTraceAndConfigFilesDeletedAfterLocalCopy, true);
      assert.equal(manualCapture.rawTrace.bytes, 298562);
      assert.match(manualCapture.rawTrace.sha256, /^[a-f0-9]{64}$/);
      assert.equal(frameTimelineOnly.acceptanceEvidence, false);
      assert.match(frameTimelineOnly.manualAttempt.rawTrace.sha256, /^[a-f0-9]{64}$/);
      assert.match(frameTimelineOnly.syntheticAttempt.rawTrace.sha256, /^[a-f0-9]{64}$/);
      assert.match(readinessMarkdown, /20秒纯 FrameTimeline 采样期间报告完成约5秒手动滑动/);
      assert.match(readinessMarkdown, /152帧跨2\.845秒/);
      assert.match(readinessMarkdown, /不是产品页或 QP05 证据/);
      assert.equal(gfxinfo.postCaptureForegroundCheck.resumedActivity, 'com.android.settings/.Settings$DisplaySettingsActivity');
      assert.equal(gfxinfo.postCaptureForegroundCheck.syntheticGestureIssued, false);
      assert.equal(gfxinfo.appAttribution.mainProcessViewRoot, 'com.tencent.mm/com.tencent.mm.ui.LauncherUI');
      assert.equal(gfxinfo.appAttribution.appBrandViewRootCount, 1);
      assert.match(gfxinfo.resetCommand, /dumpsys gfxinfo com\.tencent\.mm:appbrand0 reset/);
      assert.match(review.openItems.find((item) => item.id === 'R03').nextAction, /do not repeat the same manual host trace/);
      assert.doesNotMatch(review.openItems.find((item) => item.id === 'R03').nextAction, /explicitly confirm readiness before starting/);
      assert.doesNotMatch(review.openItems.find((item) => item.id === 'R03').nextAction, /current device is not connected over ADB/);
      assert.match(review.openItems.find((item) => item.id === 'R03').localTraceEvidence, /61,017\/61,017 events/);
      assert.match(review.openItems.find((item) => item.id === 'R03').oppoFrameTimelineEvidence, /45 named AppBrand host frames/);
      assert.match(review.openItems.find((item) => item.id === 'R03').oppoFrameTimelineEvidence, /manual FrameTimeline-only capture window was missed/);
      assert.match(review.openItems.find((item) => item.id === 'R03').oppoFrameTimelineEvidence, /538 actual and 538 expected frames/);
      assert.equal(review.openItems.find((item) => item.id === 'R03').manualScrollCaptureEvidence, 'docs/sp01-device-capability-20261030.json#fpsMeasurementResearch.gfxinfoFramestats.oppoFrameTimelineOnlyRetest.manualScrollCapture');
      assert.equal(capability.sources.androidGfxinfoResetGuidance, 'https://android.googlesource.com/platform/frameworks/base/+/562ae3a/docs/html/training/testing/performance.jd');
      assert.equal(capability.sources.androidAospInputShellSwipe, 'https://android.googlesource.com/platform/frameworks/base/+/81f52b053da6/services/core/java/com/android/server/input/InputShellCommand.java');
      assert.equal(capability.sources.perfettoAndroidTracing, 'https://perfetto.dev/docs/learning-more/android');
      assert.equal(capability.sources.perfettoFrameTimeline, 'https://perfetto.dev/docs/data-sources/frametimeline');
      assert.match(capability.localTooling.adb.version, /1\.0\.39/);
      assert.equal(capability.localTooling.adb.deviceCountAtCheck, 0);
      assert.equal(capability.localTooling.adb.latestReadOnlyDeviceCheck.model, 'SEA-AL10');
      assert.equal(capability.localTooling.adb.latestReadOnlyDeviceCheck.androidVersion, '10');
      assert.equal(capability.sources.androidDumpsys, 'https://developer.android.com/tools/dumpsys');
      assert.equal(capability.sources.androidSlowSessions, 'https://developer.android.com/topic/performance/issues/slow-session');
      assert.equal(capability.sources.aospAndroid10SurfaceFlinger, 'https://android.googlesource.com/platform/frameworks/native/+/refs/heads/android10-release/services/surfaceflinger/SurfaceFlinger.cpp');
      assert.equal(capability.sources.aospAndroid10TimeStats, 'https://android.googlesource.com/platform/frameworks/native/+/refs/heads/android10-release/services/surfaceflinger/TimeStats/TimeStats.cpp');
      assert.match(surfaceFlinger.histogramBoundary, /102ms bucket can include values at or below 100ms/);
      assert.equal(surfaceFlinger.contractSamplerApproved, false);
      assert.match(capability.fpsMeasurementResearch.gpuRenderingFallback.method, /Profile GPU Rendering/);
      assert.equal(capability.fpsMeasurementResearch.gpuRenderingFallback.status, 'visual capture feasibility observed; numerical extraction and contract-grade per-segment statistics not validated');
      assert.equal(capability.fpsMeasurementResearch.gpuRenderingFallback.unverified.length, 2);
      const gpuRetest = capability.gpuProfileRetests.find((item) => item.id === 'DEVICE04-GPU-PROFILE-1');
      assert.ok(gpuRetest);
      assert.equal(gpuRetest.gpuOverlayVisibleOverProbe, true);
      assert.equal(gpuRetest.gpuBarsRefreshDuringScroll, true);
      assert.equal(gpuRetest.numericFrameTimesExtracted, false);
      assert.equal(gpuRetest.averageFpsCalculated, false);
      assert.equal(gpuRetest.over100msAppStallAttribution, false);
      assert.equal(gpuRetest.reportedEntryRowCount, 11);
      assert.match(capability.fpsMeasurementResearch.iosCandidate.limitation, /current equipment/);
      assert.equal(capability.sources.androidOnDeviceSystemTracing, 'https://developer.android.com/topic/performance/tracing/on-device');
      assert.equal(capability.sources.androidUiJankDetection, 'https://developer.android.com/studio/profile/jank-detection');
      assert.equal(capability.sources.androidGpuRendering, 'https://developer.android.com/topic/performance/rendering/inspect-gpu-rendering');
      assert.equal(capability.sources.perfettoLocalUi, 'https://perfetto.dev/docs/getting-started/system-tracing');
      assert.equal(capability.sources.appleDeveloperMode, 'https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device');
      assert.equal(capability.fpsToolMenu.userReportedPresent, false);
      assert.equal(capability.systemTracingMenu.userReportedPresent, false);
      assert.equal(capability.runtimeVersionDiscrepancies[0].status, 'latest-device-report-confirms-3.17.5; earlier-report-preserved');
      assert.equal(capability.localTests.realPhoneRuns, '4 unique devices; 9 user-provided capability reports including four revised OPPO retests and one Huawei GPU-profile retest');
      assert.equal(capability.localTests.freshEntriesAfterRevisedProbe, 'Earlier snapshot-source correction report: 10 rows with visible repeats absent, but its build revision was not embedded; the later r1 route-field retest is recorded separately');
      assert.equal(capability.freshEntryFollowUp.oneDeviceRetest, 'Latest probe revision retest supplied from OPPO PLJ110: route duration field is undefined; this resolves the displayed field-state question only, not route cause or FPS');
      assert.equal(capability.freshEntryFollowUp.iphoneSystemUpdateReported, 'User reports iPhone XR updated to iOS 18.7.11 after Developer Mode remained unavailable; no post-update capability report has been supplied');
      assert.equal(capability.localTests.latestProbeRevision.revision, 'device-capability-v2-20261101-r1');
      assert.equal(capability.localTests.latestProbeRevision.phoneRetest, 'confirmed; route duration field is undefined');
      assert.equal(capability.localTests.latestProbeRevision.phoneResult.deviceModel, 'OPPO PLJ110');
      assert.equal(capability.localTests.latestProbeRevision.phoneResult.routeDurationFieldState, 'undefined');
      assert.equal(capability.localTests.latestProbeRevision.phoneResult.fpsAvailable, false);
      assert.equal(capability.localTests.latestProbeRevision.phoneResult.cloudNetworkOrFileWrites, false);
      assert.equal(capability.localTests.latestProbeRevision.cloudAccess, false);
      assert.doesNotMatch(capability.fpsMeasurementResearch.gfxinfoFramestats.nextStep, /Obtain one fresh OPPO report/);
      assert.match(capability.fpsMeasurementResearch.gfxinfoFramestats.nextStep, /route duration undefined on OPPO PLJ110/i);
      assert.equal(capability.fpsMeasurementResearch.iosCandidate.userReportedMacAccess, 'none; user reports currently no Mac');
      assert.equal(capability.fpsMeasurementResearch.iosCandidate.developerModeExplanation, 'Apple documents that Developer Mode appears in Settings only after device pairing is initiated or the device was previously paired with a Mac');
    } else assert.ok(['pending', 'awaiting-user'].includes(item.state));
    assert.ok(item.nextAction.length > 20);
  }
});

test('Huawei follow-up device report is retained as local diagnostic evidence only', () => {
  const evidencePath = '../docs/sp01-device-capability-huawei-follow-up-20261102.json';
  const evidence = require(evidencePath);
  const item = review.openItems.find((entry) => entry.id === 'R03');

  assert.equal(evidence.device.manufacturer, 'HUAWEI');
  assert.equal(evidence.device.model, 'SEA-AL10');
  assert.equal(evidence.device.androidVersion, '10');
  assert.equal(evidence.device.wechatVersion, '8.0.79');
  assert.equal(evidence.device.baseLibrary, '3.17.5');
  assert.equal(evidence.device.renderer, 'webview');
  assert.equal(evidence.device.initialOnShow.currentPerformanceEntries, 'not-provided');
  assert.deepEqual(evidence.onDemandRead.entries, [
    { name: 'appLaunch', type: 'navigation', durationMs: 1350 },
    { name: 'downloadPackage', type: 'loadPackage', durationMs: 429 },
    { name: 'evaluateScript', type: 'script', durationMs: 10 },
    { name: 'route', type: 'navigation', durationMs: null },
    { name: 'firstPaint', type: 'render', durationMs: null },
    { name: 'firstRender', type: 'render', durationMs: 43 },
    { name: 'firstContentfulPaint', type: 'render', durationMs: null },
    { name: 'largestContentfulPaint', type: 'render', durationMs: null },
  ]);
  assert.equal(evidence.onDemandRead.routeDurationField, 'undefined');
  assert.equal(evidence.onDemandRead.explicitFpsMetricFound, false);
  assert.equal(evidence.cloudRequests, false);
  assert.equal(evidence.networkRequests, false);
  assert.equal(evidence.fileWritesOnDevice, false);
  assert.equal(evidence.acceptanceEvidence, false);
  assert.equal(fs.existsSync(path.resolve(__dirname, '../docs/evidence/sp01-device-capability-huawei-follow-up-20261102.png')), true);
  assert.equal(fs.existsSync(path.resolve(__dirname, '../docs/evidence/sp01-device-capability-huawei-read-again-20261102.png')), true);
  assert.equal(item.state, 'pending');
  assert.equal(item.latestHuaweiDeviceCapabilityFollowUp.evidence, 'docs/sp01-device-capability-huawei-follow-up-20261102.json');
  assert.equal(item.latestHuaweiDeviceCapabilityFollowUp.currentPerformanceEntries, 8);
  assert.equal(item.latestHuaweiDeviceCapabilityFollowUp.routeEntry, 'observed; duration undefined');
  assert.ok(review.sources.includes('docs/sp01-device-capability-huawei-follow-up-20261102.json'));
  assert.equal(review.sp01Passed, false);
  assert.equal(review.sp07Started, false);
});

test('R03 controlled Huawei SurfaceFlinger drag remains sampler-feasibility evidence only', () => {
  const evidence = require('../docs/sp01-huawei-gfxinfo-swipe-20261102.json');
  const drag = evidence.latestControlledSurfaceFlingerLatencyDragProbe;
  const r03 = review.openItems.find(item => item.id === 'R03');
  const planSp01 = plan.tasks.find(task => task.id === 'SP01');

  assert.equal(drag.device.model, 'HUAWEI SEA-AL10');
  assert.equal(drag.device.userSelectedRefreshRateHz, 60);
  assert.equal(drag.foreground.sampledLayer, 'com.tencent.mm/com.tencent.mm.plugin.appbrand.ui.AppBrandUI00#0');
  assert.equal(drag.method.syntheticSwipeDurationArgumentMs, 1500);
  assert.equal(drag.method.hostMeasuredCommandElapsedMs, 1934.7);
  assert.equal(drag.capture.presentedFrameCount, 89);
  assert.equal(drag.capture.presentTimestampSpanMs, 1451.66);
  assert.equal(drag.capture.medianPresentIntervalMs, 16.42);
  assert.equal(drag.capture.gapsOver1_5RefreshPeriods, 0);
  assert.equal(drag.reuseAssessment.thirdPartyDependencyAdded, false);
  assert.equal(drag.method.networkOrCloudUsed, false);
  assert.match(drag.methodSource.url, /android\.googlesource\.com/);
  assert.equal(drag.limitations.some(text => /WebView compositor frame stream is not isolated/.test(text)), true);
  assert.equal(drag.acceptanceEvidence, false);
  assert.equal(drag.sp01Passed, false);

  assert.equal(r03.state, 'pending');
  assert.equal(r03.latestControlledSurfaceFlingerLatencyDragProbe.presentedFrameCount, 89);
  assert.equal(r03.latestControlledSurfaceFlingerLatencyDragProbe.webViewFramesIsolated, false);
  assert.equal(r03.latestControlledSurfaceFlingerLatencyDragProbe.acceptanceEvidence, false);
  assert.equal(planSp01.executionProgress.latestControlledSurfaceFlingerLatencyDragProbe.evidence,
    'docs/sp01-huawei-gfxinfo-swipe-20261102.json#latestControlledSurfaceFlingerLatencyDragProbe');
  assert.equal(planSp01.productAcceptancePassed, false);
  assert.equal(review.sp01Passed, false);
  assert.equal(review.sp07Started, false);
  const reviewMarkdown = fs.readFileSync(path.resolve(__dirname, '../docs/sp01-readiness-review-20261030.md'), 'utf8');
  assert.match(reviewMarkdown, /89 个呈现帧，时间跨度 1451\.66ms/);
  assert.match(reviewMarkdown, /不是产品页滚动 FPS，也不满足 QP05/);
});

test('R04 preserves the historical one-shot Pakomo sample that exceeded its authorization window', () => {
  const sample = require('../docs/sp01-network-huawei-pakomo-light-run-20261102.json');
  const r04 = review.openItems.find(item => item.id === 'R04');
  const evidencePath = 'docs/sp01-network-huawei-pakomo-light-run-20261102.json';

  assert.ok(review.sources.includes(evidencePath));
  assert.ok(r04.evidence.split('; ').includes(evidencePath));
  assert.equal(r04.overrunPakomoSampleEvidence, evidencePath);
  assert.equal(sample.authorization.maximumVpnDurationSeconds, 60);
  assert.equal(sample.authorization.deviceTimerObservedDurationSeconds, 68);
  assert.equal(sample.authorization.overrunSeconds, 8);
  assert.equal(sample.authorization.limitExceeded, true);
  assert.deepEqual(
    [sample.sample.attempts, sample.sample.succeeded, sample.sample.failed],
    [30, 30, 0]
  );
  assert.deepEqual(
    [sample.sample.medianMs, sample.sample.p95Ms, sample.sample.maxMs],
    [398, 656, 1985]
  );
  assert.equal(sample.sample.scope, 'application-roundtrip-not-link-rtt-or-packet-loss');
  assert.equal(sample.sample.databaseOrStorageWrites, false);
  assert.equal(sample.after.pakomoConfirmedStopped, true);
  assert.equal(sample.after.wifiConnected, true);
  assert.equal(sample.after.vpnNetworkAgentFound, false);
  assert.equal(sample.after.internetValidation, false);
  assert.equal(sample.r04AcceptanceEligible, false);
  assert.equal(sample.r04Passed, false);
  assert.equal(sample.sp01Passed, false);
  assert.equal(r04.state, 'pending');
  assert.match(r04.known, /device timer showed 68 seconds against a 60-second authorization/i);
  assert.match(r04.known, /30\/30.*P50=398ms.*P95=656ms.*max=1985ms/);
  const reviewMarkdown = fs.readFileSync(path.resolve(__dirname, '../docs/sp01-readiness-review-20261030.md'), 'utf8');
  assert.match(reviewMarkdown, /后续获准的单次采样.*计时显示68秒.*上限8秒/);
});

test('R04 records the later Pakomo attempt that resumed the wrong mini-program without a valid sample', () => {
  const attempt = require('../docs/sp01-pakomo-wrong-app-attempt-20261102.json');
  const r04 = review.openItems.find(item => item.id === 'R04');
  const evidencePath = 'docs/sp01-pakomo-wrong-app-attempt-20261102.json';

  assert.ok(review.sources.includes(evidencePath));
  assert.ok(r04.evidence.split('; ').includes(evidencePath));
  assert.equal(r04.latestFailedPakomoAttemptEvidence, evidencePath);
  assert.equal(attempt.authorization.userAuthorizedOneRun, true);
  assert.equal(attempt.authorization.maximumVpnDurationSeconds, 60);
  assert.equal(attempt.authorization.durationMeasuredSeconds, null);
  assert.equal(attempt.authorization.consumed, true);
  assert.equal(attempt.pakomo.start.confirmed, true);
  assert.equal(attempt.pakomo.start.profile, '轻度弱网');
  assert.equal(attempt.pakomo.start.applicationScope, '指定应用：微信');
  assert.equal(attempt.pakomo.stop.confirmedInactive, true);
  assert.equal(attempt.sample.validSampleReturned, false);
  assert.equal(attempt.sample.databaseOrStorageWrites, false);
  assert.equal(attempt.sample.expectedPage, 'SP01 网络采样');
  assert.equal(attempt.sample.resumedPage, '狼人杀发牌助手');
  assert.equal(attempt.pakomo.recovery.wifiValidated, true);
  assert.equal(attempt.pakomo.recovery.vpnNetworkAgentFound, false);
  assert.equal(attempt.currentForegroundPageAfterUserSwitch.adbForegroundActivity, 'com.tencent.mm/.plugin.appbrand.ui.AppBrandUI00');
  assert.equal(attempt.r04Passed, false);
  assert.equal(attempt.sp01Passed, false);
  assert.equal(r04.state, 'pending');

  const reviewMarkdown = fs.readFileSync(path.resolve(__dirname, '../docs/sp01-readiness-review-20261030.md'), 'utf8');
  assert.match(reviewMarkdown, /后续一次弱网尝试.*狼人杀发牌助手.*没有取得有效样本/);
});

test('SP01 review preserves gates, source files and historical evidence boundaries', () => {
  for (const file of review.sources) assert.ok(fs.existsSync(path.resolve(__dirname, '..', file)), file);
  assert.equal(review.e06GatePassed, false);
  assert.equal(review.sp01Passed, false);
  assert.equal(review.sp07Started, false);
  assert.equal(review.productAcceptancePassed, false);
  assert.equal(review.existingPlanAndQualityThresholdsChanged, false);
  assert.equal(review.knownFacts.currentCloudStateRequeried, true);
  assert.equal(review.knownFacts.currentCloudSnapshotEvidence, 'docs/sp01-cloud-function-snapshot-20261102.json');
  const cloudSnapshot = require('../docs/sp01-cloud-function-snapshot-20261102.json');
  assert.equal(cloudSnapshot.scope, 'read-only-cloud-function-state-query');
  assert.equal(cloudSnapshot.query.loginExpired, false);
  assert.equal(cloudSnapshot.environment.functionCount, 1);
  assert.deepEqual(cloudSnapshot.environment.functions, [{ name: 'sp01IdentityProbe', status: 'Active', runtime: 'Nodejs16.13', timeoutSeconds: 3 }]);
  assert.equal(cloudSnapshot.query.invokedFunction, false);
  assert.equal(cloudSnapshot.query.cloudWrites, false);
  assert.equal(review.updatedAt, '2026-11-03');
  assert.deepEqual(review.devicePowerSettingsObservation, {
    observedAt: '2026-11-02',
    device: 'HUAWEI SEA-AL10 / Android 10',
    source: 'local ADB settings and power-state readback',
    screenOffTimeoutBeforeMs: 600000,
    screenOffTimeoutAfterMs: 1800000,
    stayOnWhilePluggedInMask: 2,
    wakefulness: 'Awake',
    stayOn: true,
    scope: 'device-screen behavior only; not SP01 network or endurance acceptance'
  });
  assert.deepEqual(review.latestDeviceSleepSettingAdjustment, {
    observedAt: '2026-11-02',
    device: 'HUAWEI SEA-AL10 / Android 10',
    source: 'local ADB settings and power-state readback',
    screenOffTimeoutBeforeMs: 1800000,
    screenOffTimeoutAfterMs: 7200000,
    usbPowered: true,
    stayOnWhilePluggedInMask: 2,
    wakefulness: 'Awake',
    stayOn: true,
    scope: 'temporary device-screen setup for long local SP01 measurements; not acceptance evidence',
    postMeasurementRestoration: {
      observedAt: '2026-11-02',
      source: 'local ADB settings readback after Huawei atrace host-process diagnostic',
      screenOffTimeoutBeforeMs: 7200000,
      screenOffTimeoutAfterMs: 1800000,
      usbPowered: true,
      stayOnWhilePluggedInMask: 2,
      scope: 'restored the recorded 30-minute timeout after local measurement; USB-powered stay-awake remains enabled'
    }
  });
  const plan = require('../docs/v1-executable-development-plan-20261027.json');
  const planSp01 = plan.tasks.find(x => x.id === 'SP01');
  assert.equal(planSp01.productAcceptancePassed, false);
  assert.deepEqual(planSp01.executionProgress.latestDeviceSleepSettingAdjustment, review.latestDeviceSleepSettingAdjustment);
  assert.equal(review.openItems.find(x => x.id === 'R04').state, 'pending');
  assert.equal(review.openItems.find(x => x.id === 'R05').state, 'pending');
  const powerReviewMarkdown = fs.readFileSync(path.resolve(__dirname, '../docs/sp01-readiness-review-20261030.md'), 'utf8');
  assert.match(powerReviewMarkdown, /ADB读回屏幕超时600000毫秒.*拔掉USB后为30分钟超时/);
  assert.match(powerReviewMarkdown, /屏幕超时从1800000毫秒调为7200000毫秒（2小时），并读回确认/);
  assert.match(powerReviewMarkdown, /不构成R04弱网或R05耐久\/内存测量证据/);
  assert.equal(review.knownFacts.historicalDirectDownloadCodeAttributed, false);
  assert.equal(review.openItems.find(x => x.id === 'R01').vulnerabilityReproductionAuthorizedByThisReview, false);
  assert.equal(review.openItems.find(x => x.id === 'R06').newCloudActionAuthorizedByThisReview, false);
  assert.match(review.openItems.find(x => x.id === 'R05').known, /continuous 60 minutes, at least 60 complete cycles/);
  assert.match(review.openItems.find(x => x.id === 'R06').known, /暂无数据/);
  assert.match(review.openItems.find(x => x.id === 'R04').known, /P50=284ms, P95=470ms/);
  assert.match(review.openItems.find(x => x.id === 'R04').known, /borrowed a China Telecom-customized Zhaonengxuntong ZN-M2 router/);
  assert.ok(review.openItems.find(x => x.id === 'R04').unknown.some(x => x.includes('borrowed ZN-M2 firmware')));
  const r04 = review.openItems.find(x => x.id === 'R04');
  const abortedPakomoAttempt = require('../docs/sp01-pakomo-attempt-20261102.json');
  assert.ok(review.sources.includes('docs/sp01-pakomo-attempt-20261102.json'));
  assert.ok(r04.evidence.split('; ').includes('docs/sp01-pakomo-attempt-20261102.json'));
  assert.equal(r04.previousNoSamplePakomoAttemptEvidence, 'docs/sp01-pakomo-attempt-20261102.json');
  assert.equal(abortedPakomoAttempt.sample.performed, false);
  assert.equal(abortedPakomoAttempt.authorization.durationLimitExceededByMs, 17092);
  assert.match(r04.known, /device timer showed 68 seconds against a 60-second authorization/i);
  const correlatedPakomoSample = require('../docs/sp01-network-huawei-pakomo-correlated-20261102.json');
  assert.equal(r04.correlatedPakomoSampleEvidence, 'docs/sp01-network-huawei-pakomo-correlated-20261102.json');
  assert.ok(review.sources.includes(r04.correlatedPakomoSampleEvidence));
  assert.ok(r04.evidence.split('; ').includes(r04.correlatedPakomoSampleEvidence));
  assert.equal(correlatedPakomoSample.run.kind, 'agent-observed-correlated-device-run');
  assert.equal(correlatedPakomoSample.run.pakomo.startResponse.confirmed, true);
  assert.equal(correlatedPakomoSample.run.pakomo.startResponse.scope, 'applications');
  assert.equal(correlatedPakomoSample.run.pakomo.statusBeforeStop.active, true);
  assert.equal(correlatedPakomoSample.run.pakomo.statusBeforeStop.delayed, 93);
  assert.equal(correlatedPakomoSample.run.pakomo.statusBeforeStop.dropped, 0);
  assert.equal(correlatedPakomoSample.run.sample.attempts, 30);
  assert.equal(correlatedPakomoSample.run.sample.succeeded, 30);
  assert.equal(correlatedPakomoSample.run.sample.p50LowerMiddleMs, 403);
  assert.equal(correlatedPakomoSample.run.sample.p95NearestRankMs, 622);
  assert.equal(correlatedPakomoSample.run.sample.maxMs, 6407);
  assert.equal(correlatedPakomoSample.run.sample.rawElapsedMs.length, 30);
  assert.ok(correlatedPakomoSample.run.sample.rawElapsedMs.every(Number.isFinite));
  const correlatedElapsedSorted = [...correlatedPakomoSample.run.sample.rawElapsedMs].sort((a, b) => a - b);
  assert.equal(correlatedElapsedSorted[Math.floor((correlatedElapsedSorted.length - 1) / 2)], correlatedPakomoSample.run.sample.p50LowerMiddleMs);
  assert.equal(correlatedElapsedSorted[Math.ceil(correlatedElapsedSorted.length * 0.95) - 1], correlatedPakomoSample.run.sample.p95NearestRankMs);
  assert.equal(Math.max(...correlatedPakomoSample.run.sample.rawElapsedMs), correlatedPakomoSample.run.sample.maxMs);
  assert.equal(
    correlatedPakomoSample.run.sample.rawElapsedMs.slice(1).reduce((sum, value, index) => sum + Math.abs(value - correlatedPakomoSample.run.sample.rawElapsedMs[index]), 0) / (correlatedPakomoSample.run.sample.rawElapsedMs.length - 1),
    correlatedPakomoSample.run.sample.meanConsecutiveDifferenceMs
  );
  assert.equal(correlatedPakomoSample.run.interpretation.provesPerRequestShaping, false);
  assert.equal(correlatedPakomoSample.run.after.stopConfirmedInactive, true);
  assert.equal(correlatedPakomoSample.run.after.wifiRecoveredAndNotVpn, true);
  assert.equal(correlatedPakomoSample.r04Passed, false);
  assert.equal(correlatedPakomoSample.sp01Passed, false);
  assert.match(r04.known, /later agent-operated correlated run.*delayed=93.*dropped=0/i);
  assert.match(r04.known, /Aggregate counters cannot identify individual CloudBase calls.*not per-request shaping/i);
  assert.match(r04.nextAction, /independent link measures.*interrupted-request behavior.*public[- ]Wi-Fi/i);
  assert.equal(r04.latestBoundedPakomoSampleEvidence, 'docs/sp01-network-huawei-pakomo-bounded-20261102.json');
  assert.equal(review.openItems.find(x => x.id === 'R04').deviceInstallEvidence.adbInstallResult, 'Success');
  assert.equal(review.openItems.find(x => x.id === 'R04').deviceWeakNetworkEvidence.source, 'user-reported; not directly observed by the agent');
  assert.equal(review.openItems.find(x => x.id === 'R04').deviceWeakNetworkEvidence.reportedResults.wechatConnectivity, 'normal');
  assert.equal(review.openItems.find(x => x.id === 'R04').deviceWeakNetworkEvidence.cloudBaseSample.succeeded, 30);
  assert.equal(review.openItems.find(x => x.id === 'R04').deviceWeakNetworkEvidence.normalProfileBaseline.p95Ms, 848);
  assert.equal(review.openItems.find(x => x.id === 'R04').deviceWeakNetworkEvidence.pairedReruns.normalSucceeded, 60);
  assert.equal(review.openItems.find(x => x.id === 'R04').deviceWeakNetworkEvidence.pairedReruns.lightSucceeded, 60);
  assert.deepEqual(review.openItems.find(x => x.id === 'R04').deviceWeakNetworkEvidence.pairedReruns.rerunPairsAveragedP50DifferencesMs, [82, 108.5]);
  assert.equal(review.openItems.find(x => x.id === 'R04').deviceWeakNetworkEvidence.vpnStoppedAfterRun, 'user-confirmed');
  assert.equal(review.openItems.find(x => x.id === 'R04').deviceWeakNetworkEvidence.measuredWeakNetworkEffect, false);
  const pakomoProtocolReview = require('../docs/sp01-pakomo-control-protocol-review-20261102.json');
  assert.equal(review.openItems.find(x => x.id === 'R04').pakomoControlProtocolEvidence, 'docs/sp01-pakomo-control-protocol-review-20261102.json');
  assert.equal(pakomoProtocolReview.scope, 'local-static-source-review');
  assert.equal(pakomoProtocolReview.statusCommand.changesVpnOrRule, false);
  assert.equal(pakomoProtocolReview.statusCommand.writesLocalDiagnostics, true);
  assert.equal(pakomoProtocolReview.statusCommand.returnsActiveStageAndCounters, true);
  assert.equal(pakomoProtocolReview.statusCommand.cloudWrites, false);
  assert.equal(pakomoProtocolReview.startCommand.requiresSystemVpnConsent, true);
  assert.equal(pakomoProtocolReview.startCommand.waitedStartConfirmsAppliedConfig, true);
  assert.equal(pakomoProtocolReview.startCommand.returnsExactNumericRuleParameters, false);
  assert.equal(pakomoProtocolReview.startCommand.returnsSelectedPackageNames, false);
  assert.deepEqual(
    [
      pakomoProtocolReview.lightPresetSource.latencyMs,
      pakomoProtocolReview.lightPresetSource.jitterMs,
      pakomoProtocolReview.lightPresetSource.packetLossPercent,
      pakomoProtocolReview.lightPresetSource.downloadKbps,
      pakomoProtocolReview.lightPresetSource.uploadKbps
    ],
    [100, 30, 1, 2048, 1024]
  );
  assert.equal(pakomoProtocolReview.appropriateUseForNextRun.perRunStateEvidencePossible, true);
  assert.equal(pakomoProtocolReview.stopCommand.waitedStopCanConfirmInactive, true);
  assert.equal(pakomoProtocolReview.appropriateUseForNextRun.noTestWasRunAsPartOfThisReview, true);
  assert.equal(pakomoProtocolReview.acceptanceEvidence, false);
  assert.match(review.openItems.find(x => x.id === 'R04').known, /dry-run stopped before producing a complete task graph/);
  assert.match(review.openItems.find(x => x.id === 'R04').known, /no APK was produced or inspected/);
  assert.equal(review.openItems.find(x => x.id === 'R04').state, 'pending');
  assert.ok(review.sources.includes('docs/sp01-network-huawei-paired-reruns-20261102.json'));
  assert.equal(review.openItems.find(x => x.id === 'R05').state, 'pending');
  assert.equal(review.openItems.find(x => x.id === 'R06').state, 'pending');
  const recoveryItem = review.openItems.find(x => x.id === 'R06');
  const recovery = require('../docs/sp01-recovery-capability-20261101.json');
  assert.ok(review.sources.includes('docs/sp01-recovery-capability-20261101.json'));
  assert.equal(recovery.officialPackageCapabilityTable.publishedPlanCapabilities.freeTrialDataRollbackSupported, false);
  assert.equal(recovery.officialPackageCapabilityTable.publishedPlanCapabilities.personalDataRollbackSupported, false);
  assert.equal(recovery.officialPackageCapabilityTable.publishedPlanCapabilities.standardAndAboveDataRollbackDays, 14);
  assert.equal(recovery.targetPlanIdentityVerified, false);
  assert.equal(recovery.targetRollbackEntitlementVerified, false);
  assert.equal(recovery.restoreTestPerformed, false);
  assert.equal(recoveryItem.recoveryCapabilityEvidence, 'docs/sp01-recovery-capability-20261101.json');
  assert.equal(review.e06GatePassed, false);
  assert.equal(review.sp01Passed, false);
  assert.equal(review.openItems.find(x => x.id === 'R04').routerOwnerContactStatus, 'temporarily-unavailable-reported-by-user-2026-11-01');
  assert.ok(review.sources.includes('docs/sp01-huawei-render-layer-inspection-20261102.json'));
  assert.equal(review.openItems.find(x => x.id === 'R03').latestRenderLayerInspectionEvidence, 'docs/sp01-huawei-render-layer-inspection-20261102.json');
  assert.equal(review.openItems.find(x => x.id === 'R03').latestRenderLayerRepeat.gfxinfo.totalFramesRendered, 385);
  assert.equal(review.openItems.find(x => x.id === 'R03').latestRenderLayerRepeat.gfxinfo.jankyFrames, 27);
  assert.equal(review.openItems.find(x => x.id === 'R03').latestRenderLayerRepeat.acceptanceEvidence, false);
  assert.equal(huaweiRenderLayerInspection.device.model, 'HUAWEI SEA-AL10');
  assert.equal(huaweiRenderLayerInspection.foreground.focusedActivity, 'com.tencent.mm/.plugin.appbrand.ui.AppBrandUI00');
  assert.ok(huaweiRenderLayerInspection.surfaceFlinger.namedLayers.includes('com.tencent.mm/com.tencent.mm.plugin.appbrand.ui.AppBrandUI00#0'));
  assert.equal(huaweiRenderLayerInspection.surfaceFlinger.webViewSpecificLayerFound, false);
  assert.equal(huaweiRenderLayerInspection.surfaceFlinger.interpretation, 'no-identifiable-webview-layer-in-snapshot; does-not-prove-webview-absent');
  assert.equal(huaweiRenderLayerInspection.latestReadOnlyRepeat.foreground.focusedActivity, 'com.tencent.mm/.plugin.appbrand.ui.AppBrandUI00');
  assert.equal(huaweiRenderLayerInspection.latestReadOnlyRepeat.surfaceFlinger.webViewSpecificLayerFound, false);
  assert.equal(huaweiRenderLayerInspection.latestReadOnlyRepeat.gfxinfo.process, 'com.tencent.mm:appbrand0');
  assert.equal(huaweiRenderLayerInspection.latestReadOnlyRepeat.gfxinfo.totalFramesRendered, 385);
  assert.equal(huaweiRenderLayerInspection.latestReadOnlyRepeat.gfxinfo.jankyFrames, 27);
  assert.equal(huaweiRenderLayerInspection.latestReadOnlyRepeat.gfxinfo.countersResetForThisCheck, false);
  assert.equal(huaweiRenderLayerInspection.latestReadOnlyRepeat.acceptanceEvidence, false);
  assert.equal(huaweiRenderLayerInspection.acceptanceEvidence, false);
  const r03 = review.openItems.find(x => x.id === 'R03');
  assert.ok(review.sources.includes('docs/sp01-huawei-gfxinfo-automated-swipe-diagnostic-20261102.json'));
  assert.equal(r03.latestAutomatedGfxinfoSwipeDiagnostic.totalHostFramesRendered, 399);
  assert.equal(r03.latestAutomatedGfxinfoSwipeDiagnostic.recentRowsWithInputEventTimestamp, 0);
  assert.equal(r03.latestAutomatedGfxinfoSwipeDiagnostic.separatelyIdentifiableWebViewLayerFound, false);
  assert.equal(r03.latestAutomatedGfxinfoSwipeDiagnostic.acceptanceEvidence, false);
  assert.equal(huaweiAutomatedSwipeDiagnostic.device.foregroundActivity, 'com.tencent.mm/.plugin.appbrand.ui.AppBrandUI00');
  assert.equal(huaweiAutomatedSwipeDiagnostic.method.gestureCount, 10);
  assert.equal(huaweiAutomatedSwipeDiagnostic.observed.totalHostFramesRendered, 399);
  assert.equal(huaweiAutomatedSwipeDiagnostic.observed.recentFrameStatsRows, 10);
  assert.equal(huaweiAutomatedSwipeDiagnostic.observed.recentRowsWithInputEventTimestamp, 0);
  assert.equal(huaweiAutomatedSwipeDiagnostic.observed.rawRecentFrameStatsCsv.length, 10);
  assert.equal(huaweiAutomatedSwipeDiagnostic.surfaceFlinger.separatelyIdentifiableWebViewLayerFound, false);
  assert.equal(huaweiAutomatedSwipeDiagnostic.acceptanceEvidence, false);
  const reviewMarkdown = fs.readFileSync(path.resolve(__dirname, '../docs/sp01-readiness-review-20261030.md'), 'utf8');
  assert.match(reviewMarkdown, /R03 自动滚动方法校准.*最近10条.*没有输入事件时间戳/);
  assert.match(reviewMarkdown, /不能把宿主统计归因到小程序页/);
  assert.match(reviewMarkdown, /R04 当前进度（2026-11-02）/);
  assert.match(reviewMarkdown, /Pakomo v0\.3\.0 debug APK 已构建.*并安装到华为备用机/);
  assert.match(reviewMarkdown, /仍不能证明.*弱网注入.*生效/);
  assert.match(reviewMarkdown, /本轮受控关联采样.*30\/30.*403ms.*622ms/);
  assert.match(reviewMarkdown, /2026-11-02 后续限时关联采样：[\s\S]*?26秒[\s\S]*?30\/30[\s\S]*?405ms[\s\S]*?588ms/);
  assert.match(reviewMarkdown, /R04 历史记录（截至2026-11-01/);
  const platform = require('../docs/sp02-platform-evidence-20261027.json');
  const findGate = value => {
    if (!value || typeof value !== 'object') return undefined;
    if (value.id === 'E06') return value;
    for (const child of Object.values(value)) {
      const found = findGate(child);
      if (found) return found;
    }
  };
  const gate = findGate(platform);
  assert.equal(gate.gatePassed, false);
  assert.equal(gate.currentReview.historicalFieldsRetainedBelow, true);
  assert.equal(gate.currentReview.data, 'docs/sp01-readiness-review-20261030.json');
});

test('R04 keeps the latest Huawei weak-profile sample diagnostic-only when timing and counter evidence are incomplete', () => {
  const r04 = review.openItems.find(item => item.id === 'R04');
  const evidencePath = 'docs/sp01-network-huawei-pakomo-live-weak-diagnostic-20261102.json';
  const evidence = require(`../${evidencePath}`);

  assert.equal(r04.latestLiveWeakProfileDiagnosticEvidence, evidencePath);
  assert.ok(r04.evidence.split('; ').includes(evidencePath));
  assert.ok(review.sources.includes(evidencePath));
  assert.equal(evidence.device.model, 'SEA-AL10');
  assert.equal(evidence.run.profile.name, '轻度弱网');
  assert.deepEqual(evidence.run.profile.parameters, {
    delayMs: 100,
    jitterMs: 30,
    packetLossPercent: 1,
    downlinkKbps: 2048,
    uplinkKbps: 1024
  });
  assert.equal(evidence.run.sample.attempts, 30);
  assert.equal(evidence.run.sample.succeeded, 30);
  assert.equal(evidence.run.sample.failed, 0);
  assert.equal(evidence.run.sample.medianMs, 404);
  assert.equal(evidence.run.sample.p95Ms, 1192);
  assert.equal(evidence.run.sample.maxMs, 2733);
  assert.equal(evidence.run.sample.rawSamplesRetained, false);
  assert.equal(evidence.run.pakomo.exactDurationSecondsRecorded, false);
  assert.equal(evidence.run.pakomo.inRunCountersRecorded, false);
  assert.equal(evidence.run.after.pakomoStopped, true);
  assert.equal(evidence.run.after.wifiValidated, true);
  assert.equal(evidence.run.after.vpnTransportAgentPresent, false);
  assert.equal(evidence.acceptanceEvidence, false);
  assert.equal(evidence.r04Passed, false);
  assert.equal(evidence.sp01Passed, false);
  assert.equal(r04.state, 'pending');
  assert.equal(review.sp01Passed, false);

  const reviewMarkdown = fs.readFileSync(path.resolve(__dirname, '../docs/sp01-readiness-review-20261030.md'), 'utf8');
  assert.match(reviewMarkdown, /2026-11-02 新增弱网诊断样本：.*30次.*404ms.*1192ms.*2733ms/);
  assert.match(reviewMarkdown, /起止时间只有分钟精度.*可能已超时.*R04仍pending/);
});

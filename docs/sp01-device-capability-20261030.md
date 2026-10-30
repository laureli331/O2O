# SP01 device and performance API capability check

This is preparation evidence, not a product or phone-performance pass. The isolated probe at [tools/sp01-device-probe](../tools/sp01-device-probe/README.md) performs local-only reads of system information, the current page's reported renderer, and Performance API capabilities. It does not initialize CloudBase, make network requests, or write storage.

## Reuse and source review

The existing storage diagnostic already reads a whitelisted set of device fields. I left it untouched because it is used for cloud permission investigations. This separate utility reuses that field set and adds `Page.renderer` and `wx.getPerformance()` capability reads. No third-party dependency or copied source package was needed. The installed WeChat-maintained `miniprogram-api-typings@5.2.3` is MIT-licensed and its generated declarations link to WeChat's API documentation. The declarations specify `wx.getPerformance()` from base library 2.11.0, report navigation/render/script entries such as app launch, route, first render, paint, script injection, package and resource timing, and type the page renderer as `webview | skyline`. The list has no FPS or per-frame entry. The official API URLs and exact installed declaration locations are recorded in the [JSON evidence](sp01-device-capability-20261030.json).

The official docs site could not be read by the research browser in this session. I therefore used the WeChat-maintained generated declarations as primary-source evidence, and will treat phone output as the needed runtime confirmation rather than assuming type declarations prove device behavior. The declarations also mark firstPaint and LCP unsupported on iOS, and FCP unsupported below iOS 14.5; `firstRender` is the common candidate if runtime reports it on each device.

## What this establishes

- Existing reports identify four physical devices and their selected refresh settings. The settings remain user-reported choices, not measured physical timing or FPS.
- The user supplied runtime output from four phones on 2026-10-30: OPPO PLJ110 (Android 17), iPhone XR (iOS 17.5.1), HUAWEI BON-AL00 (Android 12), and HUAWEI SEA-AL10 (Android 10). All four reported `webview`, callable `wx.getPerformance()`, a registered observer, and the same six supported types: `interaction`, `loadPackage`, `navigation`, `render`, `resource`, and `script`. None reported an FPS/frame metric. The user also checked the IDE Tools menu and reported no frame-rate tool there.
- The initial outputs showed current entries as “not provided”. Review found the old probe subscribed to only three entry types and copied its initial page snapshot. The revised probe now subscribes to all types reported by each runtime and refreshes the buffer before copying. Keep the initial outputs as first-run evidence; one fresh OPPO run is needed before concluding the runtime buffer remains empty.
- The earlier device report listed the backup Huawei's base library as 3.17.4, while this latest probe output says 3.17.5. Both observations are retained and the discrepancy remains unresolved; neither sets the product support floor. The probe remains configured to 3.17.4 as the lowest earlier report, not as an approved product support floor.
- `wx.getPerformance()` has no documented FPS/per-frame entry in the WeChat-maintained API typings. No FPS, scroll-frame timing, or button-to-visible-feedback timing will be derived from first-render or navigation durations. The observed `interaction` type is recorded only as a capability until a fresh entry is returned and its meaning is verified.
- The installed WeChat CLI help has no dedicated performance-capture command. The user also reports no frame-rate tool in the IDE Tools menu. A validated alternative FPS method is still unknown.

## Validation and next device step

Local unit coverage checks report-field allowlisting, unknown renderer handling, safe metric normalization, fresh-copy behavior, runtime-advertised type observation, and absence of cloud/network/storage APIs. The four phone outputs establish renderer and API capability, not performance pass/fail. Next, import the revised isolated directory in WeChat Developer Tools and on the OPPO tap **重新读取** then **复制结果** once; return that refreshed output. The IDE Tools menu has already been checked by the user and has no frame-rate item. A separate validated FPS method is still needed for the existing 55 FPS / 60 Hz contract. Until then the minimum library, product renderer, FPS sampler, and device groups stay open.

No cloud, user files, money, dependency installation, or formal product code are involved. Rollback is deleting the isolated local probe and reverting its scoped commit.

# SP01 device and performance API capability check

This is preparation evidence, not a product or phone-performance pass. The isolated probe at [tools/sp01-device-probe](../tools/sp01-device-probe/README.md) performs local-only reads of system information, the current page's reported renderer, and documented Performance API capabilities. It does not initialize CloudBase, make network requests, or write storage.

## Reuse and source review

The existing storage diagnostic already reads a whitelisted set of device fields. I left it untouched because it is used for cloud permission investigations. This separate utility reuses that field set and adds `Page.renderer` and `wx.getPerformance()` capability reads. No third-party dependency or copied source package was needed. The installed WeChat-maintained `miniprogram-api-typings@5.2.3` is MIT-licensed and its generated declarations link to WeChat's API documentation. The declarations specify `wx.getPerformance()` from base library 2.11.0, report navigation/render/script entries such as app launch, route, first render, paint, script injection, package and resource timing, and type the page renderer as `webview | skyline`. The list has no FPS or per-frame entry. The official API URLs and exact installed declaration locations are recorded in the [JSON evidence](sp01-device-capability-20261030.json).

The official docs site could not be read by the research browser in this session. I therefore used the WeChat-maintained generated declarations as primary-source evidence, and will treat phone output as the needed runtime confirmation rather than assuming type declarations prove device behavior. The declarations also mark firstPaint and LCP unsupported on iOS, and FCP unsupported below iOS 14.5; `firstRender` is the common candidate if runtime reports it on each device.

## What this establishes

- Existing reports identify four physical devices and their selected refresh settings. The settings remain user-reported choices, not measured physical timing or FPS.
- The probe is configured to base library 3.17.4 because that is the lowest reported version among the four devices. This only makes it the probe's compatibility candidate; it does not approve a product support floor.
- The probe can report whether the device runtime exposes the documented performance API, which entry types/names it reports, and the renderer value returned for the diagnostic page. Those actual phone values are still unknown.
- `wx.getPerformance()` is not an FPS sampler. No FPS, scroll-frame timing, or button-to-visible-feedback timing will be derived from first-render or navigation durations.
- The installed WeChat CLI help contains no dedicated performance-capture command. This does not prove the IDE GUI lacks a profiler; that GUI capability remains to be checked.

## Validation and next device step

Local unit coverage checks report-field allowlisting, unknown renderer handling, safe metric normalization, and absence of cloud/network/storage APIs. After that passes, import this isolated directory in WeChat Developer Tools, launch it on the four listed phones, and return the `device-capability-v1` result from each. Separately inspect the IDE's **Tools** menu for a real-device performance analyzer or FPS panel; that one observation will determine whether the existing 55 FPS / 60 Hz contract can be measured with the current setup. Until then the minimum library, actual renderer, performance sampler, and device groups stay open.

No cloud, user files, money, dependency installation, or formal product code are involved. Rollback is deleting the isolated local probe and reverting its scoped commit.

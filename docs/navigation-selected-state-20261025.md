# 底部导航绿色选中态修复

用户指出底栏选中后仍是普通SVG，状态不清晰。本轮按指定修复，不新增图标造型或导航功能。

- 首页、发现、服务、我的：选中时展示`assets/ui/development-handoff-20261009/icons/`中既有对应`-green.svg`，普通图标隐藏；离开后恢复普通图标。绿色版本身为线框，未擅自改成填充图标。
- 绿色素材逐字复用至`previews/assets/navigation/`，不改历史交付资源。底栏文字使用已有深绿`#365c49`及650字重，加强与未选中的区分，不依赖点击/悬停才显示。
- 首页V01/V02、发布V04、我的V05、统一服务页、交易V07、发现V23共六个底栏同步。V07沿用服务归属；发布保留已有绿色圆形加号，不将加号错误替换为其它绿色图标。
- 共用`navigation-state.css`按实际当前项切换，页面使用内容哈希；V23动态导航将`aria-current`明确设为`page`，切换时移除旧项，图标和可访问状态同步。

验证：`tests/navigation-state.test.cjs`核对四份绿色SVG与原素材一致、六页接入及样式版本；`scripts/verify-navigation-state.cjs`覆盖320/375/414/1280，验证每页唯一当前项、普通/绿色图标互斥、文字选中、发布加号、V23切换后恢复、无溢出与资源错误。实际底栏截图位于`.superpowers/navigation-green/`。本轮不更改真实交易、账号、发布或支付能力。

## 实心版独立候选（未替换产品页）

用户否定仅换颜色的线框选中态，已同意先查看四组轮廓/实心对照。新增`previews/navigation-icon-options.html`及`previews/assets/navigation-candidate/`四份实心SVG；沿用项目的房屋、指南针、服务袋、人物语义，分别保留门洞、指南针留白、提手/孔位和人物头身结构。展示尺寸22px，选中填充项目主绿#496b56，文字恢复正常字重。五栏模拟底栏保留原加号，四个导航可点按切换，不触发真实导航或业务。

参考[Material官方图标说明](https://github.com/material-components/material-web/blob/main/docs/components/icon.md)中使用轮廓/填充表达状态的做法，按本项目既有图形重画实心轮廓，不简单给全部路径填色。`scripts/verify-navigation-icon-options.cjs`验证320/375/414、资源加载、44px触控、唯一选中态、正常字重和无溢出；截图`.superpowers/navigation-filled-sample/comparison.png`。当前六个产品页面保持原样，待用户审阅候选后再决定替换。

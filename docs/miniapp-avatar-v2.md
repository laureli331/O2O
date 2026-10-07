# 小程序头像 v2：湘字融合版

日期：2026-10-07（Asia/Shanghai）

用户要求：小程序名称含“湘”字，希望添加或融合，并保持美观。本版保留房屋轮廓、单片叶、绿色渐变与浅米白底，去掉原拱门，将“湘”字作为留白字形融入房屋主体。仅采用“湘”单字，不推测完整名称。

## 交付

- [上传文件：144×144 PNG](../assets/branding/miniapp-avatar-v2/avatar-144.png)
- [生成原图](../assets/branding/miniapp-avatar-v2/source.png)
- [格式与校验记录](../assets/branding/miniapp-avatar-v2/manifest.json)
- [完整生成提示词](../assets/branding/miniapp-avatar-v2/generation-prompt.txt)
- [保留的无字版](../assets/branding/miniapp-avatar-v1/avatar-144.png)

使用内置image_gen编辑原图，再导出144×144 PNG，不裁切主体。文件21,110字节，约21KB，小于2,000,000字节。SHA-256：`7C106F429C4FB46BCE4993FADB5C985DC0A355F468032ADB338C53842AD2D808`。

## 验证方案

检查实际PNG签名及解码格式、尺寸、大小、内容哈希、原图保留、提示词和文档链接；在144×144原尺寸人工检查“湘”字的氵、木、目清晰度及边缘留白。v1保留，并执行旧版本资源回归。

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\validate-miniapp-avatar.ps1 -Version v2
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\validate-miniapp-avatar.ps1 -Version v1
```

汉字识别和美观性是人工视觉复核，不将文件测试称作自动汉字识别或平台上传验收。

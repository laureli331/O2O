# 小程序头像 v3：邻里湘纹理版

日期：2026-10-07（Asia/Shanghai）

用户指定以三方案中的②邻里湘为基础，增加纹理、加强房屋感觉，并允许为美观省略笔画。生成后用户反馈“这版特别好，试试再削弱一点立体感”；因此保留v3，后续另存减弱立体感的比较版。

## 交付

- [144×144上传PNG](../assets/branding/miniapp-avatar-v3/avatar-144.png)
- [生成原图](../assets/branding/miniapp-avatar-v3/source.png)
- [校验记录](../assets/branding/miniapp-avatar-v3/manifest.json)
- [完整编辑提示词](../assets/branding/miniapp-avatar-v3/generation-prompt.txt)
- [采用的②版原方案](../assets/branding/miniapp-logo-directions-v1/neighbor/avatar-144.png)

保留湘字的水旁与邻里意象，将笔画处理为屋檐、门口和窗格，右侧减少内部分隔。加入哑光细颗粒纹理、浅层次墙面、屋檐暗面和轻微投影。原尺寸人工预览：房屋可辨、门窗负空间开放，纹理与明暗不压住主体。

内置image_gen编辑，导出144×144 PNG并保留原图。上传文件22,683字节，低于2,000,000字节；SHA-256：`BACA515224ADAA6FEEC9992C6C7AF3A53E44F76F82FACD67CB9AA80F24F89CC5`。

## 验证方案

检查实际PNG签名与解码格式、144×144尺寸、文件大小、哈希、原图/提示词保留及文档链接；纹理、房屋感觉和字形取舍在原尺寸人工复核。旧版与三种方向保留。

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\validate-miniapp-avatar.ps1 -Version v3
```

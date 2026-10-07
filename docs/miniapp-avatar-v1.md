# 小程序头像 v1

日期：2026-10-07（Asia/Shanghai）

需求：生成小程序头像，允许png/bmp/jpeg/jpg/gif，文件不可大于2M，推荐PNG及144×144。沿用已确认UI的柔和绿色与浅米白，生成房屋与单片叶组成的头像，无文字，保证小尺寸主体清晰。

## 交付

- [上传文件：144×144 PNG](../assets/branding/miniapp-avatar-v1/avatar-144.png)
- [保留的生成原图](../assets/branding/miniapp-avatar-v1/source.png)
- [尺寸、格式及校验记录](../assets/branding/miniapp-avatar-v1/manifest.json)
- [完整生成提示词](../assets/branding/miniapp-avatar-v1/generation-prompt.txt)

使用内置image_gen生成；按要求尺寸导出PNG，保留完整内容与原图，不覆盖历史资源。上传文件为144×144，22,038字节，约22KB。使用更严格的2,000,000字节上限检查，满足小于2M。SHA-256：`550F3776383D6F52D77BF671223DA715E15C59807D8D88997F33077EFBEE60DB`。

## 验证方案

检查真实PNG签名及解码格式、144×144尺寸、文件大小、内容哈希、原图与提示词保留、记录与相对链接。并在144×144原尺寸预览主体清晰度。本次交付文件；后台上传验收仍由实际平台结果决定。

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\validate-miniapp-avatar.ps1
```

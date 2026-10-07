# 小程序头像 v4：轻立体对照版

2026-10-07。用户评价 v3「这版特别好」，要求「试试再削弱一点立体感」。以 v3 为编辑目标，仅调整厚度观感、侧面明暗与投影；保留三滴水、烟囱、中央屋顶与拱门、右侧房屋的两个窗洞，以及哑光微纹理。该版为试作对照，尚未替换已认可的版本。

- [144×144 上传 PNG](../assets/branding/miniapp-avatar-v4/avatar-144.png)
- [生成原图](../assets/branding/miniapp-avatar-v4/source.png)
- [完整生成提示词](../assets/branding/miniapp-avatar-v4/generation-prompt.txt)
- [文件记录](../assets/branding/miniapp-avatar-v4/manifest.json)
- [保留的 v3 对照头像](../assets/branding/miniapp-avatar-v3/avatar-144.png)

PNG：144×144；24100 字节，小于 2,000,000 字节。
SHA256：7A5D06FD6C17751338415F9E45E2F2EE8ACA75E209E6A0D5B775462C5670AD64。

视觉检查：字形构图及房屋细节保持，屋檐与侧面的深色明暗减弱，纹理可见。提示词中的减弱幅度仅是视觉目标，并非测量结果。

验证命令：`powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate-miniapp-avatar.ps1 -Version v4`。验证 PNG 签名、真实尺寸与格式、大小、哈希、原图保留、提示词与基准存在、文档链接。共享脚本调整后同时验证 v3。原版不覆盖、不删除。

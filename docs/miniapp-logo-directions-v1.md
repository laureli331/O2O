# 湘字Logo：三种趣味方向

日期：2026-10-07（Asia/Shanghai）

用户要求：三版不同方向，都有趣味；图案根据字形变化，形成Logo效果。沿用已确认柔和绿与浅米白；所有方案均基于湘字氵、木、目的结构重新设计笔画。三版是供比较的方案，尚未替用户选定最终Logo。

## 方案与文件

### 1. 水波湘

氵变成跳动水滴，木的笔画弯曲舒展，目下部用弧形留白形成微笑般的视觉细节。

- [144×144上传PNG](../assets/branding/miniapp-logo-directions-v1/water/avatar-144.png)
- [生成原图](../assets/branding/miniapp-logo-directions-v1/water/source.png)
- [完整生成提示词](../assets/branding/miniapp-logo-directions-v1/water/generation-prompt.txt)

文件大小：21,702字节；SHA-256：`0769D10E21C820D1EFBAFDBD1C8CEE2F9B7E3BD4A31D7556C1BA6729EA70969A`。

### 2. 邻里湘

氵变成对话泡，木的笔画形成屋檐与门口，目的留白形成窗格，让湘字本身组成邻里建筑。

- [144×144上传PNG](../assets/branding/miniapp-logo-directions-v1/neighbor/avatar-144.png)
- [生成原图](../assets/branding/miniapp-logo-directions-v1/neighbor/source.png)
- [完整生成提示词](../assets/branding/miniapp-logo-directions-v1/neighbor/generation-prompt.txt)

文件大小：17,664字节；SHA-256：`4F279116771C7B80E42784E6ED158752697CFFF220A0AF648F1E46ED8C8232E5`。

### 3. 软糖湘

湘字用留白镂空形成，外轮廓采用轻微倾斜的圆润形状，笔画像柔软印章，强调集中与轻快。

- [144×144上传PNG](../assets/branding/miniapp-logo-directions-v1/seal/avatar-144.png)
- [生成原图](../assets/branding/miniapp-logo-directions-v1/seal/source.png)
- [完整生成提示词](../assets/branding/miniapp-logo-directions-v1/seal/generation-prompt.txt)

文件大小：24,455字节；SHA-256：`8DE1D8A9B2DEFB0D68D4B557B5B3FE80652C401E101BE08E726DBF55D9CAF2EE`。

[三版交付记录](../assets/branding/miniapp-logo-directions-v1/manifest.json)保存各版格式、尺寸、字节数和哈希。

## 生成与验证

三次分别使用内置image_gen生成，随后按144×144导出PNG，保留完整主体、原图和提示词。三份上传文件均使用严格小于2,000,000字节的上限。

先定义验证方案：逐版检查真实PNG签名、解码格式、144×144尺寸、文件大小、文件与记录哈希、原图/提示词保留、文档链接。原尺寸人工比较字形、负空间和轮廓，确认水波、邻里建筑、圆润印章的方向有区别。

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\validate-miniapp-logo-directions.ps1
```

人工复核：三版在144×144下仍保留湘字的三部分结构；水波版的目有微笑般弧形，邻里版的门窗来自笔画，印章版留白字与圆润外形结合。美观与最终选型由用户判断；当前未替换已确认UI或删除旧头像。

## 后续细化决定（2026-10-07）

用户已明确指定以第②版“邻里湘”为基础，增加纹理，强化房屋感觉，并允许为美观巧妙省略笔画。记录为后续细化基础，不把三版候选中的任何一版误记为最终定稿。

param(
    [string]$DocumentPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'docs\structured-design.md')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$designRepo = Split-Path -Parent $PSScriptRoot
$designChecks = 0

function Assert-Design([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
    $script:designChecks++
    Write-Output "PASS: $Message"
}

Assert-Design (Test-Path -LiteralPath $DocumentPath) 'Structured design document exists'
$designDecoder = New-Object System.Text.UTF8Encoding($false, $true)
$designText = $designDecoder.GetString([IO.File]::ReadAllBytes($DocumentPath))
$designCurrentPrd = $designDecoder.GetString([IO.File]::ReadAllBytes((Join-Path $designRepo 'docs\prd.md')))
# Legacy V/F tables remain a v1.5 artifact; current 2.1 overrides and remapping are explicit.
$designPrd = $designDecoder.GetString([IO.File]::ReadAllBytes((Join-Path $designRepo 'docs\prd-v1.5-archive-20261015.md')))
$designSelection = Get-Content -LiteralPath (Join-Path $designRepo 'assets\ui\approved-selection.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$designTokens = Get-Content -LiteralPath (Join-Path $designRepo 'assets\ui\v2\design-tokens.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$designDocDir = Split-Path -Parent $DocumentPath

Assert-Design ($designText.StartsWith('# 结构化设计说明')) 'Document is valid UTF-8 and identifies the requested deliverable'
Assert-Design ($designCurrentPrd.Contains('版本：2.1') -and $designText.Contains('PRD 2.1') -and $designText.Contains('须按新版重新映射')) 'Current 2.1 precedence and incomplete historical design remapping are explicit'
$designLocalLinks = @([regex]::Matches($designText, '\]\(([^)]+)\)') | Where-Object { $_.Groups[1].Value -notmatch '^(https?://|#)' })
$designMissingLinks = @($designLocalLinks | Where-Object {
    $designTarget = $_.Groups[1].Value.Split('#')[0]
    -not (Test-Path -LiteralPath (Join-Path $designDocDir $designTarget))
})
Assert-Design ($designLocalLinks.Count -ge 6 -and $designMissingLinks.Count -eq 0) 'All source, asset and validation links resolve'

$designImage = Join-Path (Join-Path $designRepo 'assets\ui') $designSelection.image
Assert-Design ($designSelection.status -eq 'approved' -and (Get-FileHash -LiteralPath $designImage -Algorithm SHA256).Hash -eq $designSelection.imageSha256) 'Visual source is the actual approved image'
Assert-Design ($designText.Contains('../assets/ui/' + $designSelection.image) -and $designText.Contains($designSelection.imageSha256)) 'Document identifies the approved image and its fingerprint'
Assert-Design ($designText.Contains('未采用候选') -and $designText.Contains('尚未完成视觉设计')) 'Candidate history and unrendered pages are explicitly distinguished'

foreach ($designPaletteEntry in $designTokens.palette.PSObject.Properties) {
    Assert-Design ($designText.Contains($designPaletteEntry.Value)) "Palette agrees with approved tokens: $($designPaletteEntry.Name)"
}
$designHexColors = @([regex]::Matches($designText, '#[0-9A-Fa-f]{6}\b') | ForEach-Object { $_.Value.ToUpperInvariant() } | Select-Object -Unique)
Assert-Design ($designHexColors.Count -eq 3 -and @($designHexColors | Where-Object { $_ -notin @($designTokens.palette.PSObject.Properties.Value) }).Count -eq 0) 'Document introduces no extra UI source colors'

$designNumericTokens = @{
    '页面标题' = $designTokens.typography.pageTitle
    '区块标题' = $designTokens.typography.sectionTitle
    '正文与按钮' = $designTokens.typography.body
    '辅助信息' = $designTokens.typography.metadata
    '外侧留白' = $designTokens.layout.outerMargin
    '大区块间距' = $designTokens.layout.sectionGap
    '卡片内边距' = $designTokens.layout.cardPadding
    '卡片圆角' = $designTokens.layout.cardRadius
    '控件圆角' = $designTokens.layout.controlRadius
    '最小触控目标' = $designTokens.layout.touchTargetMin
    '毛玻璃表面透明度' = $designTokens.effects.glass.surfaceOpacity
    '背景模糊' = $designTokens.effects.glass.backdropBlur
    '阴影透明度' = $designTokens.effects.shadow.opacity
    '阴影模糊' = $designTokens.effects.shadow.blur
    '阴影纵向偏移' = $designTokens.effects.shadow.offsetY
    '噪点透明度' = $designTokens.effects.noise.opacity
}
foreach ($designTokenLabel in $designNumericTokens.Keys) {
    $designExpectedValue = $designNumericTokens[$designTokenLabel].ToString([Globalization.CultureInfo]::InvariantCulture)
    $designTokenPattern = '(?m)^\| ' + [regex]::Escape($designTokenLabel) + ' \| ' + [regex]::Escape($designExpectedValue) + '(?: \||[^0-9.]|$)'
    Assert-Design ([regex]::IsMatch($designText, $designTokenPattern)) "Design value agrees with source: $designTokenLabel"
}

function Get-ContractRows([string]$Text, [string]$Prefix) {
    $designRows = @{}
    foreach ($designRowMatch in [regex]::Matches($Text, '(?m)^\| (' + $Prefix + '\d{2}) \|[^\r\n]+')) {
        $designRowKey = $designRowMatch.Groups[1].Value
        if ($designRows.ContainsKey($designRowKey)) { throw "Duplicate contract row: $designRowKey" }
        $designRows[$designRowKey] = $designRowMatch.Value.TrimEnd()
    }
    return $designRows
}
$designPageRows = Get-ContractRows $designText 'V'
$designPrdPageRows = Get-ContractRows $designPrd 'V'
Assert-Design ($designPageRows.Count -eq $designPrdPageRows.Count -and $designPageRows.Count -eq 21) 'All twenty-one PRD page groups have one structured entry'
foreach ($designPageId in $designPrdPageRows.Keys) {
    Assert-Design ($designPageRows.ContainsKey($designPageId)) "No omitted page group: $designPageId"
    $designPageCells = @($designPageRows[$designPageId].Split('|') | ForEach-Object { $_.Trim() })
    $designFieldIds = @([regex]::Matches($designPageRows[$designPageId], '\bF\d{2}\b') | ForEach-Object { $_.Value })
    $designTestIds = @([regex]::Matches($designPageRows[$designPageId], '\b(?:AT|DT|RT|T)\d{2}\b') | ForEach-Object { $_.Value })
    Assert-Design ($designPageCells.Count -eq 10 -and $designFieldIds.Count -gt 0 -and $designTestIds.Count -gt 0) "Page has entry, access, structure, actions, fields and acceptance references: $designPageId"
}
$designFieldRows = Get-ContractRows $designText 'F'
$designPrdFieldRows = Get-ContractRows $designPrd 'F'
Assert-Design ($designFieldRows.Count -eq 18) 'All eighteen field contracts are included'
foreach ($designFieldId in $designPrdFieldRows.Keys) {
    Assert-Design ($designFieldRows.ContainsKey($designFieldId) -and $designFieldRows[$designFieldId] -ceq $designPrdFieldRows[$designFieldId]) "Field constraints and visibility match the PRD verbatim: $designFieldId"
}
$designReferencedIds = @([regex]::Matches($designText, '(?<![A-Z0-9])(?:AT|DT|AI|BS|AM|AG|DG|VP|QG|V|F|RT|T|M|R|N|S|E)\d{2}(?![A-Z0-9])') | ForEach-Object { $_.Value } | Select-Object -Unique)
$designSourceIds = @([regex]::Matches(($designPrd + "`n" + $designCurrentPrd), '(?m)^(?:\| |\- )((?:AT|DT|AI|BS|AM|AG|DG|VP|QG|V|F|RT|T|M|R|N|S|E)\d{2})(?: \|| )') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique)
$designUnknownIds = @($designReferencedIds | Where-Object { $_ -notin $designSourceIds })
Assert-Design ($designUnknownIds.Count -eq 0) 'All PRD references name existing requirements'
foreach ($designFamily in @(@('M',12), @('R',8), @('N',9), @('S',4), @('T',18), @('RT',16), @('AT',12), @('DT',10), @('AI',16), @('BS',12), @('AM',8), @('AG',1), @('DG',1), @('E',6))) {
    $designAbsent = @()
    for ($designIndex=1; $designIndex -le $designFamily[1]; $designIndex++) {
        $designRequirementId = '{0}{1:D2}' -f $designFamily[0], $designIndex
        $designRangeCovered = $false
        foreach ($designRange in [regex]::Matches($designText, '(?<![A-Z])' + $designFamily[0] + '(\d{2})—' + $designFamily[0] + '(\d{2})')) {
            if ($designIndex -ge [int]$designRange.Groups[1].Value -and $designIndex -le [int]$designRange.Groups[2].Value) { $designRangeCovered = $true }
        }
        if (-not $designRangeCovered -and -not [regex]::IsMatch($designText, '(?<![A-Z])' + $designRequirementId + '\b')) { $designAbsent += $designRequirementId }
    }
    Assert-Design ($designAbsent.Count -eq 0) "Full requirement and acceptance family covered: $($designFamily[0])"
}

[xml]$designIcons = Get-Content -LiteralPath (Join-Path $designRepo 'assets\ui\v2\icons.svg') -Raw -Encoding UTF8
$designAvailableIcons = @($designIcons.SelectNodes("//*[local-name()='symbol']") | ForEach-Object { $_.GetAttribute('id') })
$designReferencedIcons = @([regex]::Matches($designText, '\bicon-[a-z-]+\b') | ForEach-Object { $_.Value } | Select-Object -Unique)
Assert-Design ($designReferencedIcons.Count -eq 20 -and @($designReferencedIcons | Where-Object { $_ -notin $designAvailableIcons }).Count -eq 0) 'All referenced SVG icons exist; no invented asset IDs'

$designCriticalPhrases = @(
    '三色限制仅针对 UI', '自然彩色', '逻辑像素', '不是位图测量结果',
    '首页 / 服务 / 发布 / 消息 / 我的', '登录不解码', '首次发布不要求完整住址',
    '姓名与身份证信息已核验', '138****0000', '双方直接结算', '同时承接不限量',
    '选中样式仅代表待提交选择', '完成申请', '23小时', '无确认且无异议',
    '审核通过不等于占位', '15分钟', '9.9元', '29.9元', 'App Store',
    '自动完成本身不产生评分资格', '态度', '效率', '沟通', '未预选',
    '图文审核通过后公开', '合法数值', '旧合法图文', '7×24小时',
    '最多1条公开回应', '暂无评价', '维修顾客', '维修服务方', '跑腿发布者',
    '跑腿承接者', '二手买方', '二手卖方', '首次回应', 'QG01',
    '争议处理中不开新评分', '身份变更转人工处理', '不同意进入争议',
    '尚未核实通过', '运营端承载形式', '没有小程序运行或生产接口验收'
)
$designMissingPhrases = @($designCriticalPhrases | Where-Object { -not $designText.Contains($_) })
Assert-Design ($designMissingPhrases.Count -eq 0) ('Critical business and design distinctions retained: ' + ($designMissingPhrases -join ', '))

$designFenceCount = [regex]::Matches($designText, '(?m)^```').Count
Assert-Design ($designFenceCount % 2 -eq 0) 'Markdown code fences are paired'
$designBadTables = @()
$designPreviousColumns = 0
foreach ($designLine in ($designText -split '\r?\n')) {
    if ($designLine.StartsWith('|')) {
        $designColumns = ($designLine.ToCharArray() | Where-Object { $_ -eq '|' } | Measure-Object).Count
        if ($designPreviousColumns -gt 0 -and $designColumns -ne $designPreviousColumns) { $designBadTables += $designLine }
        $designPreviousColumns = $designColumns
    } else { $designPreviousColumns = 0 }
}
Assert-Design ($designBadTables.Count -eq 0) 'Every Markdown table has consistent columns'
Write-Output "Historical structured design and current-baseline notice validation passed: $designChecks checks. Current 2.1 completeness is checked separately."

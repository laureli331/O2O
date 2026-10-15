param(
    [string]$DocumentPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'docs\development-plan-archive-20261015.md')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$planRepo = Split-Path -Parent $PSScriptRoot
$planDocDirectory = Join-Path $planRepo 'docs'
$planChecks = 0

function Assert-Plan([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
    $script:planChecks++
    Write-Output "PASS: $Message"
}

function Get-PlanRows([string]$Text, [string]$IdPattern) {
    $planRows = @{}
    foreach ($planMatch in [regex]::Matches($Text, '(?m)^\| (' + $IdPattern + ') \|[^\r\n]+')) {
        $planId = $planMatch.Groups[1].Value
        if ($planRows.ContainsKey($planId)) { throw "Duplicate row: $planId" }
        $planRows[$planId] = @($planMatch.Value.Trim().Trim('|').Split('|') | ForEach-Object { $_.Trim() })
    }
    return $planRows
}

Assert-Plan (Test-Path -LiteralPath $DocumentPath) 'Development plan exists'
$planDecoder = New-Object System.Text.UTF8Encoding($false, $true)
$planText = $planDecoder.GetString([IO.File]::ReadAllBytes($DocumentPath))
$planCurrentPrd = $planDecoder.GetString([IO.File]::ReadAllBytes((Join-Path $planDocDirectory 'prd.md')))
$planCurrentText = $planDecoder.GetString([IO.File]::ReadAllBytes((Join-Path $planDocDirectory 'development-plan.md')))
# The retained 48-task table is a historical v1.5 plan, explicitly awaiting remapping.
$planPrd = $planDecoder.GetString([IO.File]::ReadAllBytes((Join-Path $planDocDirectory 'prd-v1.5-archive-20261015.md')))
Assert-Plan ($planText.StartsWith('# 永兴乡镇生活服务小程序开发计划')) 'Plan is strict UTF-8 and identifies the deliverable'
Assert-Plan ($planText.Contains('PRD v1.5') -and $planPrd.Contains('版本：1.5')) 'Retained task plan uses its explicit historical PRD v1.5 archive'
Assert-Plan ($planCurrentPrd.Contains('版本：2.1') -and $planCurrentText.Contains('PRD 2.1') -and $planCurrentText.Contains('文档重映射')) 'Current baseline is 2.1; remapped current coverage is validated separately'
Assert-Plan ($planText.Contains('尚未选定，先列技术方案确认任务')) 'Actual user decision on technology is recorded'
Assert-Plan ($planText.IndexOf('## 1. 先确定验证方案') -lt $planText.IndexOf('## 4. 可领取的48项执行任务')) 'Validation is defined before the multi-step task plan'

$planLinks = @([regex]::Matches($planText, '\]\(([^)]+)\)') | Where-Object { $_.Groups[1].Value -notmatch '^(https?://|#)' })
foreach ($planLink in $planLinks) {
    $planLinkTarget = $planLink.Groups[1].Value.Split('#')[0]
    Assert-Plan (Test-Path -LiteralPath (Join-Path $planDocDirectory $planLinkTarget)) "Local source or validation link resolves: $planLinkTarget"
}
Assert-Plan ($planLinks.Count -ge 5) 'Plan links its PRD, design, approval and validation sources'

$planTasks = Get-PlanRows $planText 'DP\d{2}'
Assert-Plan ($planTasks.Count -eq 48) 'Exactly forty-eight unique task rows exist'
$planDependencies = @{}
for ($planIndex = 1; $planIndex -le 48; $planIndex++) {
    $planTaskId = 'DP{0:D2}' -f $planIndex
    Assert-Plan ($planTasks.ContainsKey($planTaskId)) "Task numbering is complete: $planTaskId"
    $planCells = $planTasks[$planTaskId]
    Assert-Plan ($planCells.Count -eq 7 -and @($planCells | Where-Object { [string]::IsNullOrWhiteSpace($_) }).Count -eq 0) "Task includes phase, execution, dependencies, deliverable, checks and conditions: $planTaskId"
    Assert-Plan ($planCells[1] -match '^[A-G]$') "Task phase is valid: $planTaskId"
    $planTaskDeps = @([regex]::Matches($planCells[3], '\bDP\d{2}\b') | ForEach-Object { $_.Value })
    Assert-Plan ($planCells[3] -eq '无' -or $planTaskDeps.Count -gt 0) "Dependency expression is explicit: $planTaskId"
    Assert-Plan (@($planTaskDeps | Where-Object { -not $planTasks.ContainsKey($_) -or $_ -eq $planTaskId }).Count -eq 0) "Dependencies exist and do not reference the task itself: $planTaskId"
    Assert-Plan (@($planTaskDeps | Select-Object -Unique).Count -eq $planTaskDeps.Count) "Dependencies have no duplicate edges: $planTaskId"
    $planDependencies[$planTaskId] = $planTaskDeps
    if ($planCells[1] -notin @('A')) {
        Assert-Plan ([regex]::IsMatch($planCells[5], '\b(?:AT|DT|RT|T)\d{2}\b|检查：')) "Task defines an acceptance or review condition: $planTaskId"
    }
}

# Topological traversal checks the whole graph, including cycles between different tasks.
$planResolved = @{}
do {
    $planProgress = $false
    foreach ($planGraphId in @($planDependencies.Keys)) {
        if ($planResolved.ContainsKey($planGraphId)) { continue }
        $planUnresolvedDeps = @($planDependencies[$planGraphId] | Where-Object { -not $planResolved.ContainsKey($_) })
        if ($planUnresolvedDeps.Count -eq 0) {
            $planResolved[$planGraphId] = $true
            $planProgress = $true
        }
    }
} while ($planProgress)
Assert-Plan ($planResolved.Count -eq 48) 'Task dependency graph has no cycles'

$planRequiredEdges = @{
    'DP07' = @('DP01', 'DP03', 'DP04')
    'DP21' = @('DP20')
    'DP23' = @('DP22')
    'DP26' = @('DP24', 'DP25')
    'DP28' = @('DP27')
    'DP32' = @('DP31')
    'DP36' = @('DP29', 'DP35', 'DP48')
    'DP03' = @('DP02', 'DP41')
    'DP42' = @('DP08', 'DP41')
    'DP43' = @('DP42', 'DP13', 'DP17', 'DP20')
    'DP48' = @('DP44', 'DP47')
    'DP40' = @('DP39')
}
foreach ($planEdgeId in $planRequiredEdges.Keys) {
    Assert-Plan (@($planRequiredEdges[$planEdgeId] | Where-Object { $_ -notin $planDependencies[$planEdgeId] }).Count -eq 0) "Safety-critical prerequisites remain present: $planEdgeId"
}

$planPrdIds = @([regex]::Matches(($planPrd + "`n" + $planCurrentPrd), '(?m)^(?:\| |\- )((?:AT|DT|AI|BS|AM|AG|DG|VP|QG|RT|T|M|R|V|F|N|S|E)\d{2})(?: \|| )') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique)
$planReferences = @([regex]::Matches($planText, '(?<![A-Z0-9])(?:AT|DT|AI|BS|AM|AG|DG|VP|QG|RT|T|M|R|V|F|N|S|E)\d{2}(?![A-Z0-9])') | ForEach-Object { $_.Value } | Select-Object -Unique)
Assert-Plan (@($planReferences | Where-Object { $_ -notin $planPrdIds }).Count -eq 0) 'Plan references only existing PRD identifiers'
$planUnknownTasks = @([regex]::Matches($planText, '\bDP\d{2}\b') | ForEach-Object { $_.Value } | Where-Object { -not $planTasks.ContainsKey($_) })
Assert-Plan ($planUnknownTasks.Count -eq 0) 'All task references resolve'

$planCoverage = Get-PlanRows $planText '(?:M|R)\d{2}'
Assert-Plan ($planCoverage.Count -eq 20) 'All twelve modules and eight extensions have explicit traceability rows'
$planCoverageRefs = ($planCoverage.Values | ForEach-Object { $_ -join ' ' }) -join "`n"
foreach ($planFamily in @(@('M',12), @('R',8), @('F',18), @('V',21), @('N',9), @('S',4))) {
    for ($planIndex = 1; $planIndex -le $planFamily[1]; $planIndex++) {
        $planRequirementId = '{0}{1:D2}' -f $planFamily[0], $planIndex
        Assert-Plan ([regex]::IsMatch($planCoverageRefs, '\b' + $planRequirementId + '\b')) "Traceability covers: $planRequirementId"
    }
}
foreach ($planCoverageId in $planCoverage.Keys) {
    Assert-Plan ($planCoverage[$planCoverageId].Count -eq 3 -and [regex]::IsMatch($planCoverage[$planCoverageId][1], '\bDP\d{2}\b')) "Requirement has an executable task mapping: $planCoverageId"
}

$planAcceptances = Get-PlanRows $planText '(?:AT|DT|RT|T)\d{2}'
Assert-Plan ($planAcceptances.Count -eq 56) 'All fifty-six original and added acceptance scenarios have unique execution rows'
foreach ($planTestFamily in @(@('T',18), @('RT',16), @('AT',12), @('DT',10))) {
    for ($planIndex = 1; $planIndex -le $planTestFamily[1]; $planIndex++) {
        $planTestId = '{0}{1:D2}' -f $planTestFamily[0], $planIndex
        Assert-Plan ($planAcceptances.ContainsKey($planTestId)) "Acceptance scenario is not omitted: $planTestId"
        Assert-Plan ($planAcceptances[$planTestId].Count -eq 3 -and [regex]::IsMatch($planAcceptances[$planTestId][1], '\bDP\d{2}\b') -and $planAcceptances[$planTestId][2].Length -ge 15) "Acceptance has responsible tasks and an observable expected result: $planTestId"
    }
}
Assert-Plan ((Get-PlanRows $planText 'E\d{2}').Count -eq 6 -and $planText.Contains('| QG01 |') -and $planText.Contains('| AG01 |') -and $planText.Contains('| DG01 |')) 'All external gates have explicit evidence and blocked-capability rows'

$planCriticalPhrases = @(
    '登录不解码', '原始完整姓名/身份证', '只有1承接者', '同时多单承接不限量',
    '自动完成后补确认不改原结束/付款事实', '关闭争议不开资格',
    '实际展示成功起算', '支付未知暂不转售', '向下取整到分', 'App Store',
    '合法数值独立', '旧审核不能覆盖新版本', '六角色', '无全站总分',
    '客户端改时钟无效', '未获上线授权不发布', '每次改动', 'Git commit',
    '备份恢复', '不以模拟成功代替', '不能给可信的具体工期'
)
foreach ($planCriticalPhrase in $planCriticalPhrases) {
    Assert-Plan ($planText.Contains($planCriticalPhrase)) "Critical execution boundary remains explicit: $planCriticalPhrase"
}
Assert-Plan ($planText.Contains('overview.png') -and $planText.Contains('已采用v2')) 'Approved visual baseline and non-selected candidate are distinguished'
Assert-Plan ([regex]::Matches($planText, '(?m)^```').Count % 2 -eq 0) 'Markdown code fences are paired'
$planPreviousColumns = 0
foreach ($planLine in ($planText -split '\r?\n')) {
    if ($planLine.StartsWith('|')) {
        $planColumns = [regex]::Matches($planLine, '\|').Count
        if ($planPreviousColumns -gt 0) {
            if ($planColumns -ne $planPreviousColumns) { throw "Inconsistent Markdown table: $planLine" }
        }
        $planPreviousColumns = $planColumns
    } else { $planPreviousColumns = 0 }
}
Assert-Plan ($true) 'Every Markdown table has consistent columns'
Write-Output "Development plan validation passed: $planChecks checks. This checks the retained historical task graph and current-baseline notice, not PRD 2.1 task remapping or product execution."

$ErrorActionPreference = 'Stop'
$fatherText = Get-Content -LiteralPath (Join-Path $PSScriptRoot '..\docs\registration-handoff-to-father.md') -Raw -Encoding utf8
$fatherRequired = @('个人经营','不填爸爸或爷爷','无字号','湘邻湘友','不换成爷爷门面的地址','无偿使用','不编造门牌号','面积口径','万元','协作运营人员','联络员','大学生','是否通过互联网开展经营活动','仅通过网络开展经营活动','尚未得到明确结论','广告发布','我确认后再提交','本人实名','费用','cloud1','registration-preparation.md')
foreach ($fatherItem in $fatherRequired) { if (-not $fatherText.Contains($fatherItem)) { throw "Missing handoff coverage: $fatherItem" } }
if ($fatherText -match '(?<!\d)\d{17}[\dXx](?!\d)') { throw 'Identity number detected' }
Write-Output "PASS: $($fatherRequired.Count) handoff coverage checks and identity-data check; document validation only."
$ErrorActionPreference = 'Stop'
$registrationText = Get-Content -LiteralPath (Join-Path $PSScriptRoot '..\docs\registration-preparation.md') -Raw -Encoding utf8
$registrationRequired = @('已满18周岁','父亲名下','不接待客户','不存放货物','无偿使用','经营者有效身份证','房产证或不动产权证','房屋无偿使用证明','父亲身份证明','实际办公面积','实际资金数额','住宅用途证明','自建房安全相关材料','共有产权材料','地址不一致材料','许可或批准文件','委托材料','经营范围草稿','尚未确认','主表“是否通过互联网开展经营活动”','无字号','邮政编码','受理机关','营业执照副本数量','党建信息','不得代签','当前没有最终提交授权','获照不等于','2026年版','https://www.samr.gov.cn/')
foreach ($registrationItem in $registrationRequired) { if (-not $registrationText.Contains($registrationItem)) { throw "Missing coverage: $registrationItem" } }
if ($registrationText -match '身份证号码：\d{15,18}') { throw 'Personal identity data must not be recorded' }
Write-Output "PASS: $($registrationRequired.Count) coverage checks and identity-data check; document validation only."

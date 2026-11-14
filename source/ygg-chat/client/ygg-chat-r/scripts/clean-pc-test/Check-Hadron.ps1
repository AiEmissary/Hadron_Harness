param([string]$HadronExe)
$ErrorActionPreference = 'Stop'
if (-not $HadronExe) {
  $link = Join-Path ([Environment]::GetFolderPath('Desktop')) 'The Hadron Harness.lnk'
  if (Test-Path -LiteralPath $link) { $HadronExe = (New-Object -ComObject WScript.Shell).CreateShortcut($link).TargetPath }
}
if (-not $HadronExe -or -not (Test-Path -LiteralPath $HadronExe -PathType Leaf)) {
  throw 'Run again with -HadronExe followed by the full installed The Hadron Harness.exe path.'
}
$reportDir = Join-Path ([IO.Path]::GetTempPath()) ('hadron-release-check-' + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $reportDir | Out-Null
$hadronProcess = Start-Process -FilePath $HadronExe -ArgumentList ('--hadron-diagnose="' + $reportDir + '"') -PassThru -WindowStyle Hidden
if (-not $hadronProcess.WaitForExit(60000)) { throw "Diagnostic still running. Close its test window and retain $reportDir" }
$reportFile = Join-Path $reportDir 'release-check.json'
if (-not (Test-Path -LiteralPath $reportFile)) { throw "No diagnostic report. Retain $reportDir" }
$report = Get-Content -LiteralPath $reportFile -Raw | ConvertFrom-Json
Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, OSArchitecture | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $reportDir 'windows.json')
Write-Host "Results: $reportDir"
$report | ConvertTo-Json -Depth 12
if (-not $report.success -or $hadronProcess.ExitCode -ne 0) { throw 'Diagnostic failed; retain the report folder.' }
Write-Host 'Bundled startup diagnostic passed. Continue with the manual checklist.'

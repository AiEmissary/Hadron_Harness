$ErrorActionPreference = 'Stop'
$hadronRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$hadronApp = Join-Path $hadronRoot 'source\ygg-chat\client\ygg-chat-r'
$hadronElectron = @(
    (Join-Path $hadronApp 'node_modules\electron\dist\electron.exe'),
    (Join-Path $hadronRoot 'source\ygg-chat\node_modules\electron\dist\electron.exe')
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
$hadronInstalled = Join-Path $env:LOCALAPPDATA 'Programs\Hadron-Harness\The Hadron Harness.exe'
$hadronProfile = Join-Path $env:APPDATA 'Hadron-Harness'
try {
    if (-not $hadronElectron -or -not (Test-Path -LiteralPath (Join-Path $hadronApp 'dist-electron\index.html'))) {
        throw 'The local test build is not ready. Return to the Hadron build chat.'
    }
    $hadronRunning = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $hadronInstalled -or $_.Path -eq $hadronElectron }
    if ($hadronRunning) {
        throw 'Close Hadron first, after saving any unsent message, then open Test Hadron again. This launcher will not close your window for you.'
    }
    $hadronBackup = Join-Path $hadronRoot ('local-test-backups\' + (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss-fff'))
    New-Item -ItemType Directory -Path $hadronBackup -Force | Out-Null
    if (Test-Path -LiteralPath $hadronProfile) {
        foreach ($hadronFile in Get-ChildItem -LiteralPath $hadronProfile -File) {
            if ($hadronFile.Name -match '\.db($|-wal$|-shm$)' -or $hadronFile.Name -eq 'config.json') {
                Copy-Item -LiteralPath $hadronFile.FullName -Destination (Join-Path $hadronBackup $hadronFile.Name)
            }
        }
    }
    @{ build = 'Hadron two-pane local acceptance'; profile = $hadronProfile; createdUtc = [DateTime]::UtcNow.ToString('o'); installerChanged = $false } |
        ConvertTo-Json | Set-Content -LiteralPath (Join-Path $hadronBackup 'backup-info.json') -Encoding UTF8
    $env:HADRON_USE_BUILT_RENDERER = '1'
    Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
    Start-Process -FilePath $hadronElectron -ArgumentList '.', '--hadron-local-test' -WorkingDirectory $hadronApp -WindowStyle Hidden
    Write-Host 'Hadron local test is opening with your existing saved work. The installed shortcut and installer are unchanged.'
} catch {
    Write-Host $_.Exception.Message
    if ($env:HADRON_QUIET_LAUNCH -eq '1') {
        $hadronAlert = New-Object -ComObject WScript.Shell
        $null = $hadronAlert.Popup($_.Exception.Message, 0, 'Hadron could not open', 16)
    }
    exit 1
}

$ErrorActionPreference = 'Stop'
try {
  $appDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\ygg-chat\client\ygg-chat-r'))
  $electron = Join-Path $appDirectory '..\..\node_modules\electron\dist\electron.exe'
  foreach ($required in @($electron, (Join-Path $appDirectory 'electron\main.mjs'), (Join-Path $appDirectory 'dist-electron\index.html'))) {
    if (!(Test-Path -LiteralPath $required)) { throw 'Hadron development build is missing. Rebuild it before launching.' }
  }
  $env:HADRON_USE_BUILT_RENDERER = '1'
  Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
  Start-Process -FilePath $electron -ArgumentList @(('"' + $appDirectory + '"')) -WorkingDirectory $appDirectory -WindowStyle Hidden
} catch {
  Add-Type -AssemblyName PresentationFramework
  [Windows.MessageBox]::Show($_.Exception.Message, 'Hadron Harness could not start') | Out-Null
  exit 1
}

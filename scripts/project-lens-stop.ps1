$ErrorActionPreference = 'SilentlyContinue'
$Root = Split-Path -Parent $PSScriptRoot
$Runtime = Join-Path $Root '.project-lens\launcher'
$StatePath = Join-Path $Runtime 'processes.json'
if (-not (Test-Path $StatePath)) { Write-Host 'Project Lens is already stopped.'; exit 0 }
$state = Get-Content $StatePath -Raw | ConvertFrom-Json
$roots = @($state.daemonPid, $state.frontendPid) | Where-Object { $_ -as [int] }
$all = New-Object System.Collections.Generic.HashSet[int]
foreach ($rootPid in $roots) {
  $queue = New-Object System.Collections.Queue; $queue.Enqueue([int]$rootPid)
  while ($queue.Count) { $pid = $queue.Dequeue(); if (-not $all.Add($pid)) { continue }; Get-CimInstance Win32_Process -Filter "ParentProcessId=$pid" | ForEach-Object { $queue.Enqueue([int]$_.ProcessId) } }
}
foreach ($pid in ($all | Sort-Object -Descending)) { Stop-Process -Id $pid -Force; Write-Host "Stopped Project Lens process $pid." }
Remove-Item $StatePath -Force
Write-Host 'Project Lens stopped.' -ForegroundColor Green

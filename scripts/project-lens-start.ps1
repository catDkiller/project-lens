$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Runtime = Join-Path $Root '.project-lens\launcher'
$StatePath = Join-Path $Runtime 'processes.json'
$DaemonLog = Join-Path $Runtime 'daemon.log'
$WebLog = Join-Path $Runtime 'frontend.log'

function Fail($Message) { Write-Host "START FAILED: $Message" -ForegroundColor Red; Write-Host "Logs: $Runtime"; Write-Host 'Retry: start-project-lens.bat'; exit 1 }
function Wait-Http($Url, $Name, $Seconds = 30) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    try { $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2; if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { return $response } } catch { Start-Sleep -Milliseconds 250 }
  }
  Fail "$Name did not become ready at $Url. Check $Runtime."
}
function PortOwner($Port) {
  try { return Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1 -ExpandProperty OwningProcess } catch { return $null }
}

if (-not (Test-Path (Join-Path $Root 'node_modules'))) { Fail 'Dependencies are not installed. Run setup-project-lens.bat first.' }
New-Item -ItemType Directory -Force -Path $Runtime | Out-Null
$existing = if (Test-Path $StatePath) { try { Get-Content $StatePath -Raw | ConvertFrom-Json } catch { $null } } else { $null }
if ($existing) {
  try { $health = Invoke-WebRequest -Uri 'http://127.0.0.1:8787/api/runtime/health' -UseBasicParsing -TimeoutSec 2; if ($health.StatusCode -eq 200) { Start-Process 'http://127.0.0.1:5173'; Write-Host 'Project Lens is already running; opened the existing instance.' -ForegroundColor Green; exit 0 } } catch { }
}
$daemonOwner = PortOwner 8787; if ($daemonOwner) { Fail "daemon port 8787 is occupied by process $daemonOwner. Stop that application safely, then retry." }
$webOwner = PortOwner 5173; if ($webOwner) { Fail "frontend port 5173 is occupied by process $webOwner. Stop that application safely, then retry." }
Remove-Item $DaemonLog,$WebLog -Force -ErrorAction SilentlyContinue
$daemon = Start-Process -FilePath 'cmd.exe' -ArgumentList '/d','/c',"npm run daemon > `"$DaemonLog`" 2>&1" -WorkingDirectory $Root -PassThru -WindowStyle Hidden
$health = Wait-Http 'http://127.0.0.1:8787/api/runtime/health' 'daemon'
$web = Start-Process -FilePath 'cmd.exe' -ArgumentList '/d','/c',"npm run dev:web -- --host 127.0.0.1 > `"$WebLog`" 2>&1" -WorkingDirectory $Root -PassThru -WindowStyle Hidden
Wait-Http 'http://127.0.0.1:5173/' 'frontend'
@{ daemonPid = $daemon.Id; frontendPid = $web.Id; root = $Root; startedAt = (Get-Date).ToUniversalTime().ToString('o') } | ConvertTo-Json | Set-Content $StatePath
Start-Process 'http://127.0.0.1:5173'
Write-Host 'Project Lens is ready at http://127.0.0.1:5173/' -ForegroundColor Green
Write-Host 'Stop with stop-project-lens.bat' -ForegroundColor Green

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
  $line = netstat -ano | Select-String -Pattern "LISTENING\s+\d+$" | Where-Object { $_.Line -match ":$Port\s" } | Select-Object -First 1
  if ($line -and $line.Line -match '(\d+)$') { return [int]$Matches[1] }
  return $null
}
function RepositoryIdentity($Path) {
  $bytes = [Text.Encoding]::UTF8.GetBytes($Path.ToLowerInvariant())
  $hash = [Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
  return (($hash | ForEach-Object { $_.ToString('x2') }) -join '').Substring(0, 16)
}
try { $expectedCommit = (& git -C $Root rev-parse --short HEAD).Trim() } catch { Fail 'Git could not identify this Project Lens build.' }
$expectedRepositoryIdentity = RepositoryIdentity $Root

if (-not (Test-Path (Join-Path $Root 'node_modules'))) { Fail 'Dependencies are not installed. Run setup-project-lens.bat first.' }
New-Item -ItemType Directory -Force -Path $Runtime | Out-Null
try {
  $health = Invoke-WebRequest -Uri 'http://127.0.0.1:8787/api/runtime/health' -UseBasicParsing -TimeoutSec 2
  if ($health.StatusCode -eq 200) {
    $meta = Invoke-RestMethod -Uri 'http://127.0.0.1:8787/api/meta' -TimeoutSec 2
    if ($meta.app -ne 'project-lens' -or $meta.gitCommit -ne $expectedCommit -or $meta.repositoryIdentity -ne $expectedRepositoryIdentity) { Fail "daemon port 8787 is occupied by an incompatible Project Lens process (build $($meta.gitCommit), repository identity $($meta.repositoryIdentity)). Stop that clone explicitly, then retry." }
    try {
      $frontend = Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -UseBasicParsing -TimeoutSec 2
      if ($frontend.StatusCode -ge 200 -and $frontend.StatusCode -lt 500) {
        Start-Process 'http://127.0.0.1:5173'
        Write-Host 'Project Lens is already running; opened the existing instance.' -ForegroundColor Green
        exit 0
      }
    } catch { }
  }
} catch { }
$daemonOwner = PortOwner 8787; if ($daemonOwner) { Fail "daemon port 8787 is occupied by process $daemonOwner. Stop that application safely, then retry." }
$webOwner = PortOwner 5173; if ($webOwner) { Fail "frontend port 5173 is occupied by process $webOwner. Stop that application safely, then retry." }
Remove-Item $DaemonLog,$WebLog -Force -ErrorAction SilentlyContinue
$daemon = Start-Process -FilePath 'cmd.exe' -ArgumentList '/d','/c',"npm run daemon > `"$DaemonLog`" 2>&1" -WorkingDirectory $Root -PassThru -WindowStyle Hidden
$health = Wait-Http 'http://127.0.0.1:8787/api/runtime/health' 'daemon'
$meta = Invoke-RestMethod -Uri 'http://127.0.0.1:8787/api/meta' -TimeoutSec 2
if ($meta.app -ne 'project-lens' -or $meta.gitCommit -ne $expectedCommit -or $meta.repositoryIdentity -ne $expectedRepositoryIdentity) { Fail 'The daemon started, but its identity does not match this repository. Check the daemon log and stop the incompatible process.' }
$web = Start-Process -FilePath 'cmd.exe' -ArgumentList '/d','/c',"npm run dev:web -- --host 127.0.0.1 > `"$WebLog`" 2>&1" -WorkingDirectory $Root -PassThru -WindowStyle Hidden
Wait-Http 'http://127.0.0.1:5173/' 'frontend'
$daemonProcessPid = (Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)
$frontendProcessPid = (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)
@{ daemonPid = $daemon.Id; frontendPid = $web.Id; daemonProcessPid = $daemonProcessPid; frontendProcessPid = $frontendProcessPid; root = $Root; startedAt = (Get-Date).ToUniversalTime().ToString('o') } | ConvertTo-Json | Set-Content $StatePath
Start-Process 'http://127.0.0.1:5173'
Write-Host 'Project Lens is ready at http://127.0.0.1:5173/' -ForegroundColor Green
Write-Host 'Stop with stop-project-lens.bat' -ForegroundColor Green

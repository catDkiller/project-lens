$ErrorActionPreference = 'SilentlyContinue'
$Root = Split-Path -Parent $PSScriptRoot
$Runtime = Join-Path $Root '.project-lens\launcher'
$failures = @()
function Check($Label, $Ok, $Fix) {
  if ($Ok) { Write-Host "PASS  $Label" -ForegroundColor Green }
  else { Write-Host "FAIL  $Label - $Fix" -ForegroundColor Red; $script:failures += $Label }
}
$node = Get-Command node -ErrorAction SilentlyContinue
$nodeVersion = ''; if ($node) { $nodeVersion = (& $node.Source --version).Trim().TrimStart('v') }
$validNode = $false; try { $v = [version]$nodeVersion; $validNode = (($v.Major -eq 20 -and $v -ge [version]'20.19.0') -or ($v.Major -ge 22 -and $v -ge [version]'22.12.0')) } catch { }
Check 'Windows' ($env:OS -eq 'Windows_NT') 'Use the supported Windows launcher.'
Check "Node.js $nodeVersion" $validNode 'Install Node.js 20.19+ LTS or 22.12+.'
Check 'npm' ([bool](Get-Command npm -ErrorAction SilentlyContinue)) 'Install Node.js LTS.'
Check 'Git' ([bool](Get-Command git -ErrorAction SilentlyContinue)) 'Install Git.'
$codexCandidates = @(Get-ChildItem (Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\bin') -Filter codex.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)
$pathCodex = Get-Command codex -ErrorAction SilentlyContinue; if ($pathCodex) { $codexCandidates += $pathCodex.Source }
$codex = $null
foreach ($candidate in ($codexCandidates | Select-Object -Unique)) { try { & $candidate --version *> $null; if ($LASTEXITCODE -eq 0) { $codex = $candidate; break } } catch { } }
Check 'OpenAI Codex CLI' ([bool]$codex) 'Install Codex, authenticate it, and rerun setup.'
$loggedIn = $false; if ($codex) { & $codex login status *> $null; $loggedIn = $LASTEXITCODE -eq 0 }
Check 'Codex authentication' $loggedIn 'Run codex login, then rerun doctor-project-lens.bat.'
Check 'Root dependencies' (Test-Path (Join-Path $Root 'node_modules')) 'Run setup-project-lens.bat.'
Check 'Website dependencies' (Test-Path (Join-Path $Root 'website\node_modules')) 'Run setup-project-lens.bat.'
$runtimeReady = [bool](New-Item -ItemType Directory -Force -Path $Runtime -ErrorAction SilentlyContinue)
Check 'Runtime directory writable' ($runtimeReady -and (Test-Path $Runtime)) 'Allow the repository to write .project-lens runtime data.'
foreach ($port in 5173,8787) {
  $owner = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  $free = -not $owner
  $statePath = Join-Path $Runtime 'processes.json'
  if (Test-Path $statePath) { try { $state = Get-Content $statePath -Raw | ConvertFrom-Json; $free = $free -or ($owner.OwningProcess -in @($state.daemonPid,$state.frontendPid)) } catch { } }
  Check "Port $port" $free 'Stop the owning Project Lens process or close the unrelated process safely.'
}
git -C $Root diff --quiet; Check 'Repository integrity' ($LASTEXITCODE -eq 0) 'Review local changes before a shared installation.'
Check 'Launcher scripts' ((Test-Path (Join-Path $Root 'setup-project-lens.bat')) -and (Test-Path (Join-Path $Root 'start-project-lens.bat')) -and (Test-Path (Join-Path $Root 'stop-project-lens.bat'))) 'Restore the launcher files from Git.'
if ($failures.Count) { Write-Host "NOT READY - $($failures.Count) check(s) need attention." -ForegroundColor Red; exit 1 }
Write-Host 'READY - Project Lens can be started with start-project-lens.bat.' -ForegroundColor Green

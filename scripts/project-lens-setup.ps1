$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Runtime = Join-Path $Root '.project-lens\launcher'

function Fail($Message) {
  Write-Host "SETUP FAILED: $Message" -ForegroundColor Red
  Write-Host "Fix the issue and run setup-project-lens.bat again."
  exit 1
}
function CommandPath($Name) {
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  return $null
}

Write-Host 'Project Lens setup' -ForegroundColor Cyan
$node = CommandPath 'node'; if (-not $node) { Fail 'Node.js was not found. Install Node.js LTS (20.19+ or 22.12+) and retry.' }
$nodeVersion = (& $node --version).Trim().TrimStart('v')
try { $nodeParts = [version]$nodeVersion } catch { Fail "Could not read the Node.js version ($nodeVersion)." }
if (($nodeParts.Major -eq 20 -and $nodeParts -lt [version]'20.19.0') -or ($nodeParts.Major -eq 21) -or ($nodeParts.Major -lt 20)) { Fail "Node.js $nodeVersion is unsupported. Use Node.js 20.19+ LTS or 22.12+." }
$npm = CommandPath 'npm'; if (-not $npm) { Fail 'npm was not found. Reinstall Node.js LTS and retry.' }
if (-not (CommandPath 'git')) { Fail 'Git was not found. Install Git and retry.' }
$codexCandidates = @()
$known = Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\bin'
$codexCandidates += @(Get-ChildItem $known -Filter codex.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)
$pathCodex = CommandPath 'codex'; if ($pathCodex) { $codexCandidates += $pathCodex }
$codex = $null; $codexVersion = $null
foreach ($candidate in ($codexCandidates | Select-Object -Unique)) { try { $candidateVersion = (& $candidate --version 2>&1 | Out-String).Trim(); if ($LASTEXITCODE -eq 0 -and $candidateVersion) { $codex = $candidate; $codexVersion = $candidateVersion; break } } catch { } }
if (-not $codex) { Fail 'OpenAI Codex CLI was not found. Install Codex, authenticate it, and run this setup again.' }
$login = & $codex login status 2>&1; if ($LASTEXITCODE -ne 0) { Fail 'Codex authentication could not be confirmed. Run: codex login, then run setup-project-lens.bat again.' }

Write-Host "Node.js $nodeVersion, npm available, Git available, Codex available ($codexVersion)." -ForegroundColor Green
Write-Host 'Installing root dependencies...' -ForegroundColor Cyan
Push-Location $Root
try { & $npm ci; if ($LASTEXITCODE -ne 0) { Fail 'npm ci failed. Review the npm output above.' } } finally { Pop-Location }
$websiteLock = Join-Path $Root 'website\package-lock.json'
if (Test-Path $websiteLock) {
  Write-Host 'Installing website dependencies...' -ForegroundColor Cyan
  Push-Location (Join-Path $Root 'website')
  try { & $npm ci; if ($LASTEXITCODE -ne 0) { Fail 'website npm ci failed. Review the npm output above.' } } finally { Pop-Location }
}
New-Item -ItemType Directory -Force -Path $Runtime | Out-Null
Write-Host "Setup complete. Runtime logs will be stored under .project-lens\launcher." -ForegroundColor Green
Write-Host 'Next: run start-project-lens.bat' -ForegroundColor Green
exit 0

# Installing and Using Project Lens

## What Project Lens does

Project Lens analyses a selected software project locally and uses the
authenticated OpenAI Codex CLI to explain it. It creates a bounded isolated
snapshot, never modifies the original selected project, and validates an
Overview and Complete Guide before showing them. Generated runs are stored
under `.project-lens/`. The public website is a separate showcase; the local
application is the analyser.

## Supported environment

The verified support target is Windows 10 or Windows 11, Node
`^20.19.0 || >=22.12.0`, npm, Git, an authenticated OpenAI Codex CLI, and a
modern Chromium-based browser. macOS and Linux are not claimed as supported.

## Before installation

Check the prerequisites:

```text
git --version
node --version
npm --version
codex --version
```

Authenticate Codex through its normal CLI flow when needed (for example,
`codex login`). Do not paste an API key into this repository or a source file.

## Installation — easiest Windows method

1. Clone the repository.
2. Open the cloned folder.
3. Run `setup-project-lens.bat`.
4. Run `doctor-project-lens.bat` and confirm `READY`.
5. Run `start-project-lens.bat`.
6. Confirm or select an available Codex model.
7. Select a project folder or use the prepared sample.
8. Begin analysis.

```powershell
git clone https://github.com/catDkiller/project-lens.git
cd project-lens
setup-project-lens.bat
doctor-project-lens.bat
start-project-lens.bat
```

## Installation through Command Prompt

```bat
git clone https://github.com/catDkiller/project-lens.git
cd project-lens
setup-project-lens.bat
doctor-project-lens.bat
start-project-lens.bat
```

## Installation through PowerShell

```powershell
git clone https://github.com/catDkiller/project-lens.git
Set-Location project-lens
cmd /c setup-project-lens.bat
cmd /c doctor-project-lens.bat
cmd /c start-project-lens.bat
```

## Starting Project Lens

Run `start-project-lens.bat`. It starts the loopback daemon and Vite frontend,
waits for health checks, opens the browser, verifies that an existing instance
belongs to this repository, and prevents duplicate Project Lens processes.
The frontend is at `http://127.0.0.1:5173/`; the daemon is at
`http://127.0.0.1:8787/`.

## Stopping Project Lens

Run `stop-project-lens.bat`. It stops only processes recorded by the Project
Lens launcher, not unrelated Node processes or applications.

## Diagnosing Project Lens

Run `doctor-project-lens.bat`. It reports the Codex executable and
authentication, account-compatible model discovery, browser-local selected
model, dependencies, writable runtime storage, ports, launcher scripts, and
daemon/frontend identity (commit and clone identity). Run it again after each
fix. Logs are stored in `.project-lens/launcher/daemon.log` and
`.project-lens/launcher/frontend.log`.

## Using Project Lens

1. Start Project Lens and check Codex readiness.
2. Confirm the visible selected model.
3. Choose a project folder and review its name and file summary.
4. Start analysis and watch the factual progress events.
5. Open Overview, then Complete Guide.
6. Restart Project Lens later to reopen preserved reports.

Progress stages are Preparing, Discovering project files, Selecting relevant
files, Creating local analysis snapshot, Preparing Codex analysis, Analysing
with Codex, Validating generated artifacts, and Opening the report.

The launcher never submits an implicit `automatic` model. It passes an exact
model reported by the signed-in Codex account. If a saved model disappears,
select another discovered model.

## Generated outputs

Reports can include Overview, Complete Guide, a project map, important files,
file walkthroughs, execution flow, learning order, commands, evidence, and
limitations. Claims are labelled confirmed, detected, inferred, or unsupported
where appropriate.

## Local data and privacy

The original project is not modified. Project Lens uses a bounded snapshot and
an isolated Codex run. Generated runs live under `.project-lens/`, which is
ignored by Git. Source code is not uploaded to the public showcase website;
Codex access follows the user's own account and provider settings.

To remove local runs, stop Project Lens and remove only `.project-lens/` in the
repository. Do not delete the original project, repository, or unrelated
folders.

## Updating Project Lens

```powershell
stop-project-lens.bat
git pull
setup-project-lens.bat
doctor-project-lens.bat
start-project-lens.bat
```

Setup is safely rerunnable.

## Common problems

| Symptom | Safe action |
| --- | --- |
| Codex not found | Install Codex, sign in normally, then rerun setup and doctor. |
| Codex not authenticated | Run `codex login`, finish the interactive flow, and rerun doctor. |
| No compatible model | Confirm authentication, rerun doctor, and select a discovered model. |
| Saved model unavailable | Select a currently discovered model; no silent substitution occurs. |
| `automatic` model error | Refresh and select an explicit discovered model. |
| Unsupported Node | Install Node `20.19+` or `22.12+`, then rerun setup. |
| Port already in use | Run doctor, identify the owner, and stop only that application if it is yours. |
| Stale frontend or daemon | Stop the matching clone and start from this repository. Never kill all Node processes. |
| Stuck in Preparing | Stop and restart, rerun doctor, and inspect `.project-lens/launcher/daemon.log`. |
| Browser does not open | Visit `http://127.0.0.1:5173/` after start reports ready. |
| Folder inaccessible | Choose a readable folder and review skipped files. |
| Codex or artifact failure | Read the factual UI error and daemon log; do not retry blindly. |
| Path contains spaces | Keep using the launcher; paths are passed safely as arguments. |
| Permission or antivirus block | Review the alert and allow only the requested local process if appropriate. |
| npm installation failure | Fix the npm-reported prerequisite or network issue, then rerun setup and doctor. |

After every fix, rerun `doctor-project-lens.bat`. Do not paste credentials or
secrets from logs into public issues.

## Known limitations

Windows is the currently verified platform. Codex account access and models
vary. Larger repositories take longer and use bounded file selection. Image
and binary assets are not deeply understood, and unsupported frameworks may
produce less detailed reports. Local Codex authentication is required.

## Public links

- Website: <https://website-seven-beryl-14.vercel.app/>
- Generated report: <https://website-seven-beryl-14.vercel.app/report/>
- GitHub: <https://github.com/catDkiller/project-lens>
- Demo: <https://youtu.be/lNfbdZfcho0>

## Quick reference

```text
Install: git clone https://github.com/catDkiller/project-lens.git
         cd project-lens
         setup-project-lens.bat
Check:   doctor-project-lens.bat
Start:   start-project-lens.bat
Stop:    stop-project-lens.bat
Update:  stop-project-lens.bat
         git pull
         setup-project-lens.bat
         doctor-project-lens.bat
         start-project-lens.bat
```


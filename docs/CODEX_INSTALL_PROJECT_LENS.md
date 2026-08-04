# Install Project Lens for Me Using Codex

## Short copy-paste prompt

Install Project Lens from `https://github.com/catDkiller/project-lens.git` on
this Windows 10 or Windows 11 computer. Check prerequisites, use a safe folder,
run setup and doctor, start the local app, inspect it in the browser, run one
prepared-sample analysis, verify Overview and Complete Guide, confirm the
original sample is unchanged, and do not report success until the checklist
passes. Do not ask me to paste credentials or API keys into files, modify
unrelated folders, push, or deploy. Pause only for authentication or a
meaningful permission decision.

## Full prompt

You are installing Project Lens for me on Windows 10 or Windows 11. I may not
understand Node.js, Git, npm, ports, or daemons. Install only from:

`https://github.com/catDkiller/project-lens.git`

Work carefully and explain each result in plain language.

### Prerequisites

1. Check the Windows version.
2. Check `git --version`.
3. Check `node --version` and `npm --version`.
4. Accept only Node `^20.19.0 || >=22.12.0`.
5. Check `codex --version` and locate the installed Codex CLI.
6. Check Codex authentication with its normal token-free status command.
7. If authentication requires interaction, pause and ask me to complete the
   official Codex flow. Never ask me to paste an API key into Project Lens or a
   source file.

### Clone and install

Choose a safe installation folder and support paths containing spaces, such as
`D:\\Project Lens Final Installation Test\\project-lens`. Do not overwrite an
existing folder without asking first.

```powershell
git clone https://github.com/catDkiller/project-lens.git
Set-Location project-lens
```

Confirm that the clone's commit matches the public `main` commit. Run
`setup-project-lens.bat`, then `doctor-project-lens.bat`. Resolve failed
readiness checks with documented safe actions and rerun the doctor until it
reports `READY`.

### Start and verify

Run `start-project-lens.bat`. Verify that the frontend and daemon belong to
this clone by checking their displayed commit and repository identity. Confirm
that the browser opens `http://127.0.0.1:5173/`.

In the visible UI:

1. Confirm an account-compatible Codex model is selected.
2. Confirm the selected model is explicit; never use or invent `automatic`.
3. Confirm Begin analysis is available after selecting a project.
4. Use the prepared sample, not a large unrelated repository.
5. Start one prepared-sample analysis only.
6. Watch the real progress events.
7. Confirm discovery, snapshot preparation, Codex startup, and artifact
   validation complete.
8. Confirm Overview opens.
9. Confirm Complete Guide opens.
10. Confirm the report is genuine, not a placeholder.

Do not retry automatically, switch models silently, or use the public showcase
website as the local analyser.

### Restart and integrity checks

1. Stop Project Lens with `stop-project-lens.bat`.
2. Start it again with `start-project-lens.bat`.
3. Confirm the preserved report reopens.
4. Confirm the original prepared sample is unchanged.
5. Run the doctor again.
6. Stop Project Lens.
7. Start it once more and leave it ready.

### Safety rules

- Do not modify unrelated folders.
- Do not install global packages unnecessarily.
- Do not commit credentials or expose authentication tokens.
- Do not hardcode absolute user paths.
- Do not push changes or deploy anything.
- Do not pretend setup passed when the browser flow was not tested.
- Pause if Codex or Git credentials require interaction.
- Pause if Windows requests meaningful permission.
- Pause if an unrelated process owns a required port.
- Pause if Node is unsupported and must be changed.
- Pause before overwriting an existing installation.
- Do not ask questions that can be answered safely from the system or scripts.
- Do not delete existing projects, kill all Node processes, or disable security
  software.

## Installation verification checklist

Environment:

- [ ] Windows version supported
- [ ] Git available
- [ ] Node version supported
- [ ] npm available
- [ ] Codex CLI available
- [ ] Codex authentication ready
- [ ] Compatible model selected

Repository:

- [ ] Cloned from the correct GitHub repository
- [ ] Correct `main` commit checked out
- [ ] No private files present
- [ ] Repository path works with spaces
- [ ] Dependencies installed

Runtime:

- [ ] Doctor reports `READY`
- [ ] Daemon becomes healthy
- [ ] Frontend becomes healthy
- [ ] Frontend and daemon belong to the same clone
- [ ] No incompatible stale daemon reused
- [ ] No unrelated process killed
- [ ] Browser opens the local analyser

Application:

- [ ] Model is visible
- [ ] Selected folder works
- [ ] Analysis starts
- [ ] Activity appears
- [ ] Discovery completes
- [ ] Snapshot completes
- [ ] Codex starts
- [ ] Artifacts validate
- [ ] Overview opens
- [ ] Complete Guide opens
- [ ] Report reopens after restart
- [ ] Original source remains unchanged

Cleanup:

- [ ] Stop command works
- [ ] Repeated stop is safe
- [ ] Repeated setup is safe
- [ ] Repeated start does not create duplicates
- [ ] No temporary test files remain in Git
- [ ] No credentials are printed
- [ ] Final user instructions are clear

Do not report success until every required item is checked or an honest
limitation is recorded.


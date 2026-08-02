# Project Lens runtime architecture

Project Lens uses one local authority: the loopback daemon. The browser sends
user actions to that daemon; it never reads a selected folder or starts Codex.

```text
Browser → loopback daemon → isolated run directory → Codex CLI
                         ↘ persisted run/events/report/artifacts
```

The daemon owns source snapshots, run IDs, process lifetime, event persistence,
artifact validation, report reconstruction, cancellation, and recovery. The
browser owns selection UI, activity presentation, artifact rendering, and
navigation.

Each run is persisted under `.project-lens/runs/<run-id>/`:

```text
run.json                 lifecycle and identity facts
source-manifest.json     bounded source inventory and fingerprint
events.jsonl             append-only normalized activity
diagnostics.json         bounded redacted runtime diagnostics
report.json              reconstructed presentation metadata
source/                  immutable selected-source snapshot
skill/SKILL.md           Project Lens-owned analysis instructions
artifacts/overview.md
artifacts/complete-guide.md
artifacts/analysis-notes.md  optional
```

Codex is resolved once through the local runtime adapter. The resolved binary
is used for version, sign-in status, model discovery, and execution. Prompts
are written to stdin, never argv. An explicit model ID is passed unchanged;
Automatic omits `--model`.

The state lifecycle is monotonic: `created`, `snapshotting`, `source_ready`,
`starting_runtime`, `running`, `artifacts_detected`, `validating`,
`artifact_ready`, `completed`. Terminal alternatives are `cancelled`,
`failed_snapshot`, `failed_runtime`, and `failed_validation`. Artifact delivery
and process exit are separate facts: valid required artifacts can complete a
run after a non-zero runtime exit.

Events are append-only, normalized JSONL and replayed through the daemon SSE
endpoint. A browser reconnect reads persisted status and replays only missed
event IDs. Recovery reads persisted metadata, snapshot and validated artifacts;
it never starts Codex.

Security boundaries: the daemon binds to loopback, requires its per-launch
token for state-changing actions, checks browser Origins, filters selected
source, keeps secrets and agent stores out of snapshots, uses shell-free child
spawning, and only exposes verified project-relative file identities.

Deferred after the demo: ACP/app-server, multi-agent runs, provider plugins,
cloud execution, remote control, containers/VMs, SQLite migration, vector
search, plugin marketplace, chat, and model-authored source edits.

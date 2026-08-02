# Runtime adapters

`src/local-api/codexCli.ts` is the Codex adapter. It resolves the native CLI,
probes its version/sign-in/models, builds argv, streams prompt input, translates
JSONL, and terminates the owned child process. Its contract is intentionally
small so the daemon remains the product authority.

| Responsibility | Existing location | Change in this pass | Pattern | Risk |
| --- | --- | --- | --- | --- |
| Daemon/API/run ownership | `src/local-api/server.ts` | persist authoritative artifacts and states | Open Design/OpenHands | high |
| Codex resolution/invocation | `src/local-api/codexCli.ts` | shared decoder, bounded diagnostics | Open Design/Polpo | high |
| Snapshot/fingerprint | `server.ts`, `analysisWorkspace.ts` | persisted manifest and exclusions | Aider | high |
| Artifact reader/references | `codexCli.ts` | one strict reader and reference metadata | Continue | high |
| Event display | `AnalysisProgress.tsx` | project concise activity only | Goose/Cline | medium |
| Recovery/audit | `server.ts`, `artifactAudit.ts` | reuse the same validation path | OpenHands/SWE-ReX | medium |
| Browser workspace | `KnowledgeWorkspace.tsx` | safe rich Markdown rendering | Project Lens | medium |

These are independently implemented adaptations of public architectural
patterns, not copied frameworks. Open Design's Apache-2.0 attribution remains
in `THIRD_PARTY_NOTICES.md`; OpenHands SDK is MIT. No other repository code is
copied in this pass.

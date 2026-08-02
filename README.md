# Project Lens

Project Lens helps developers understand unfamiliar software projects, especially projects created with coding agents. It combines deterministic project inspection with an optional Codex analysis, runs against a disposable read-only copy, validates generated artifacts, and presents an Overview, Complete Guide, Explore, and Review workspace.

## Theme 2: UX for Agentic Applications

The interface makes a local coding agent understandable: the user chooses a project, sees factual progress, and browses evidence-backed output instead of a chat transcript.

## Locked MVP

- Prepared React/Vite sample and safe local project-folder import
- Deterministic inventory, imports, and project-part detection
- Codex CLI with an existing ChatGPT sign-in (GPT-5.4 mini is preferred when discovered)
- Disposable read-only workspace, control-file quarantine, output validation, cancellation, and cleanup

## Postponed

GitHub import, multiple agents, runtime AI providers other than Codex, automatic refactoring, and databases. The prepared sample remains the most reliable demo path.

## Prerequisites

- Node.js 20 or newer
- Codex CLI installed and signed in for AI-assisted analysis

## Start the application

```powershell
npm install
npm run dev
```

The Vite frontend opens at `http://localhost:5173`. The local daemon listens on loopback at `http://127.0.0.1:8787`.

Choose the prepared sample or select a local project folder. Project Lens filters dependencies, generated output, secrets, unsupported binaries, and oversized files before analysis. Codex authentication is required for an AI-assisted run; deterministic inspection remains local.

## Runtime data and privacy

Temporary run data is stored under `.project-lens/` and is ignored by Git. Files are prepared locally. Relevant project text may be sent by Codex to the selected model provider. Sensitive and ignored files are excluded. Do not commit `.env` files, tokens, provider credentials, generated reports, or runtime logs.

## Architecture and limitations

The browser talks to a loopback TypeScript daemon. Project-source adapters normalize prepared and local files; deterministic modules inventory files, extract imports, and detect project parts. Codex writes bounded Markdown artifacts into an isolated workspace; the daemon validates and serves them to the report workspace. GitHub import, many frameworks, automatic refactoring, persistent accounts, and database-backed history are not implemented.

See [runtime architecture](docs/runtime-architecture.md) and [runtime adapters](docs/runtime-adapters.md) for implementation details.

## License and attribution

Project Lens is released under the MIT License. The Codex CLI adapter contains an Apache-2.0-attributed adaptation of process and JSONL event-stream ideas from Open Design; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Local development

```powershell
npm install
npm run dev
npm run test
npm run lint
npm run build
```

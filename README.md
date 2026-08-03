# Project Lens

Project Lens is a local-first, Codex-powered workspace for understanding
unfamiliar software repositories. It turns deterministic project evidence and
bounded agent analysis into an evidence-backed Overview and Complete Guide.

**Live website:** <https://website-seven-beryl-14.vercel.app/>

**GitHub:** <https://github.com/catDkiller/project-lens>

**Demo video:** coming before final submission.

## Public links

- [Live website](https://website-seven-beryl-14.vercel.app/)
- [GitHub repository](https://github.com/catDkiller/project-lens)
- Demo video — coming before final submission

## The problem

AI-generated projects can run before their creators understand the structure,
dependencies, or complexity they contain. Project Lens helps developers build a
reliable mental model before changing or copying a project.

## The solution

The local application inventories a project, maps static imports, detects
project parts, and—when Codex is connected—produces a validated report. The
workspace presents an Overview, Complete Guide, Explore view, Review cautions,
project map, file evidence, and uncertainty instead of a chat transcript.

## Key features

- Prepared React/Vite sample and safe local-folder analysis
- Deterministic inventory, imports, relationships, and project-part detection
- Codex analysis in a disposable, read-only, quarantined workspace
- Validated Markdown artifacts and structured report views
- Evidence, uncertainty, learning order, and review-before-copy guidance
- Public prototype-based website with an interactive terrain presentation

## How the local analyser works

1. A ProjectSource normalizes approved project files.
2. Deterministic analysis inventories files and extracts static imports.
3. Project parts are selected from replaceable evidence-based definitions.
4. Codex receives only a bounded request and isolated read-only project copy.
5. Generated Overview and Complete Guide artifacts are validated before display.

The hosted website demonstrates the product story. It cannot inspect a visitor's
computer or run the local analyser. New local-folder analysis runs through the
local application. Large repositories use bounded analysis and may require
additional preprocessing.

## Local-first privacy model

Files are prepared locally. Relevant project text may be sent by Codex to the
selected model provider. Sensitive, ignored, generated, binary, and oversized
files are excluded. Temporary run data lives under `.project-lens/`, which is
ignored by Git. Do not commit credentials, `.env` files, reports, or runtime
logs.

## Architecture and stack

- React, TypeScript, and Vite frontend
- TypeScript loopback daemon for local orchestration
- Small ProjectSource contracts for prepared and local projects
- Deterministic TypeScript analysis modules
- Codex CLI adapter with disposable workspace, permission isolation, and output validation
- Vitest tests and plain CSS; no database, router, or global state library

## Setup and local development

Requirements: Node.js 20+ and Codex CLI signed in for AI-assisted analysis.

```powershell
npm install
npm run dev
npm run test
npm run lint
npm run build
```

The application uses Vite on `http://localhost:5173` and a loopback daemon on
`http://127.0.0.1:8787`.

### Public website development

```powershell
npm run website:dev
npm run website:test
npm run website:lint
npm run website:build
```

The independent public website runs on port `4174`. It uses the approved
interactive landscape language and does not deploy the local daemon.

## Demo video

The public website includes a truthful placeholder: demo video coming before
final submission. To replace it without editing page code, add
`website/public/media/project-lens-demo.mp4` (optionally a poster at
`website/public/media/project-lens-demo-poster.webp`) or set
`VITE_DEMO_VIDEO_URL` before building.

## Known limitations

GitHub import, additional agents, many frameworks, automatic refactoring,
accounts, databases, and persistent curriculum tracking are not implemented.
The prepared sample remains the most reliable demonstration path.

## Codex usage and hackathon track

Codex supported planning, multi-step implementation, testing, and self-review.
The project is submitted under **Theme 2: UX for Agentic Applications**.

Primary track: **Agentic Coding**

## Author

Garvit Arya

## License

MIT. The Codex CLI adapter contains an Apache-2.0-attributed adaptation of
process and JSONL event-stream ideas from Open Design; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

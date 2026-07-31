# Project Lens

## Problem

Coding agents can produce working software faster than their creators can understand it. Project Lens helps people inspect an AI-built React/Vite project, identify the files behind a feature, and learn what is worth carrying forward.

## Theme 2 — UX for Agentic Applications

The product makes agent-created project structure legible: it starts from a project source, shows analysis progress, and will guide a learner through feature-level evidence rather than an opaque generated answer.

## Current MVP

- OpenCode detection and real configured-model discovery through a loopback-only local runtime.
- Analyse the prepared React/Vite sample with a selected OpenCode model, then validate its structured result before opening the existing workspace.
- Use the committed prepared presentation as a clearly separate no-AI fallback.
- Run deterministic inventory, static-import, relationship, and project-part analysis.
- Transform the result into one reusable project knowledge base used by Overview, Complete Guide, Project parts, Technologies, Files, and Decisions views.
- Switch between accessible light/dark themes and accent tokens.
- Deploy a public, no-login static site.

The prepared sample is the guaranteed demo. Sources normalize into the same project shape so local-folder and GitHub adapters can be added later without changing the learning workspace.

## Postponed features

- Local-folder access and GitHub URL fetching.
- GitHub URL fetching.
- Other CLI adapters, Codex API calls, authentication, persistence, database, routing, and automatic refactoring.
- Frameworks beyond React/Vite.

## Local development

```bash
npm install
npm run dev
npm run test
npm run build
```

## Architecture

The stable deterministic analyser lives in `src/analysis/`. `src/local-api/` is a small Node runtime bound to `127.0.0.1`; it discovers OpenCode with the documented CLI, runs only the materialized `prepared-sample-project/`, validates output, and caches valid results by sample fingerprint and selected model. The approved Open Design reference remains read-only in `open-design-ui-prototype/`.

See [CODEX_HANDOFF.md](CODEX_HANDOFF.md) for the component map, current limits, and deployment notes.

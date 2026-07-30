# Project Lens

## Problem

Coding agents can produce working software faster than their creators can understand it. Project Lens helps people inspect an AI-built React/Vite project, identify the files behind a feature, and learn what is worth carrying forward.

## Theme 2 — UX for Agentic Applications

The product makes agent-created project structure legible: it starts from a project source, shows analysis progress, and will guide a learner through feature-level evidence rather than an opaque generated answer.

## Current MVP

- Open one prepared React/Vite sample project from the Project Lens launcher.
- Run deterministic inventory, static-import, relationship, and project-part analysis.
- Transform the result into one reusable project knowledge base used by Overview, Complete Guide, Project parts, Technologies, Files, and Decisions views.
- Switch between accessible light/dark themes and accent tokens.
- Deploy a public, no-login static site.

The prepared sample is the guaranteed demo. Sources normalize into the same project shape so local-folder and GitHub adapters can be added later without changing the learning workspace.

## Postponed features

- Local-folder access and installed CLI detection. The launcher configuration is clearly marked as sample-only.
- GitHub URL fetching.
- OpenCode and other CLI adapters.
- Runtime AI/Codex API calls, authentication, persistence, database, routing, and automatic refactoring.
- Frameworks beyond React/Vite.

## Local development

```bash
npm install
npm run dev
npm run test
npm run build
```

## Architecture

The stable deterministic analyser lives in `src/analysis/`. `src/knowledge/adapter.ts` transforms its `ProjectAnalysis` result and reviewed learning packs into the optional `ProjectKnowledgeBase` contract used by all UI views. The approved Open Design reference remains read-only in `open-design-ui-prototype/`.

See [CODEX_HANDOFF.md](CODEX_HANDOFF.md) for the component map, current limits, and deployment notes.

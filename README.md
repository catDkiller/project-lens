# Project Lens

## Problem

Coding agents can produce working software faster than their creators can understand it. Project Lens helps people inspect an AI-built React/Vite project, identify the files behind a feature, and learn what is worth carrying forward.

## Theme 2 — UX for Agentic Applications

The product makes agent-created project structure legible: it starts from a project source, shows analysis progress, and will guide a learner through feature-level evidence rather than an opaque generated answer.

## Locked MVP

- Open one prepared React/Vite sample project.
- Analyze project structure and select Navigation, Login, or Dashboard.
- Show relevant files, concepts, essential complexity, review-before-copy complexity, a short learning path, and a future build brief.
- Deploy a public, no-login static site.

The prepared sample is the guaranteed demo. Sources normalize into the same project shape so local-folder and GitHub adapters can be added later without changing the learning workspace.

## Postponed features

- Local-folder access and installed CLI detection.
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

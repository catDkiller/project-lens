# Project Lens handoff

## Architecture

`ProjectSource` returns a normalized project. The deterministic analyser creates an inventory, static import graph, and data-driven project-part detections. `createProjectKnowledgeBase()` in `src/knowledge/adapter.ts` converts that result plus reviewed learning packs into one `ProjectKnowledgeBase`. All visible workspace views consume that object; analysis logic is not embedded in React.

## Component map

- `src/app/App.tsx` — mutually exclusive launcher, analysing, and workspace states.
- `src/app/Launcher.tsx` — approved launcher pattern and sample-only configuration.
- `src/app/KnowledgeWorkspace.tsx` — approved top bar, navigation, Overview, Complete Guide, project-part, technology, file, command, and decision views.
- `src/app/ThemeMenu.tsx` — full-surface appearance and accent controls.
- `src/styles/tokens.css` — imported light/dark and accent token system.

## Data and sample locations

- Knowledge contract: `src/knowledge/types.ts`.
- Analyser-to-UI adapter: `src/knowledge/adapter.ts`.
- Prepared sample project: `src/fixtures/preparedViteSample.ts`.
- Sample project-part definitions and learning packs: `src/fixtures/`.
- Sample-only launcher configuration: `src/fixtures/launcherDemo.ts`.
- Read-only Open Design reference: `open-design-ui-prototype/60767765-d13c-452f-b4eb-cad9aa3ab71b/`.

## Real versus mocked

The prepared-sample pipeline is real and deterministic. Local folder selection, installed-agent detection, model discovery, GitHub import, and runtime AI are postponed. The launcher marks its agent/model configuration as sample-only and does not claim local detection.

## Analysis limits

The current analyser is limited to prepared React/Vite-shaped projects and static JavaScript/JSX/TypeScript/TSX imports. It does not inspect dynamic imports, aliases, package internals, binaries, media contents, notebooks, datasets, or generated output. The knowledge contract can display partial, detected, unsupported, skipped, generated, and uncertain statuses without claiming unsupported understanding.

## Application states

Only one major state is rendered at a time: Launcher, Analysing, or Workspace. The workspace opens to Overview and all navigation views read the same knowledge base.

## Development and deployment

```bash
npm install
npm run dev
npm run test
npm run lint
npm run build
```

Deploy the generated `dist/` directory to the selected static host.

## Postponed features

Local import, GitHub import, CLI/model detection, runtime AI, accounts, persistence, automatic refactoring, Git rollback, and broader framework analysis remain outside the MVP.

import type { PresentationKnowledgeBase } from '../knowledge/presentationTypes'

const preview = `import { createUser } from './services/userService'
import { UserRepository } from './repositories/UserRepository'

const repository = new UserRepository(process.env.DATABASE_URL)

export async function createAccount(userId: string) {
  const user = await createUser(userId)
  await repository.save(user)
  return user
}

export function start() {
  return createAccount('demo-user')
}

// Additional source lines are intentionally omitted from this bounded preview.
// The real file continues beyond the first 16 rendered lines.`

export const deepGuideDemoPresentationKnowledge: PresentationKnowledgeBase = {
  version: '1.0',
  projectName: 'Project Lens formatting demo',
  projectTypeLabel: 'Test/demo report fixture',
  shortSummary: 'A deterministic fixture used to verify that the real report viewer exposes technical formatting and bounded code evidence.',
  overview: { whatItIs: 'A small TypeScript service fixture that demonstrates how Project Lens presents code-learning evidence.' },
  files: [
    { path: 'src/services/', title: 'Service folder', itemType: 'other', analysisStatus: 'analysed', explanation: 'Folder containing the user creation service.' },
    { path: 'src/services/userService.ts', title: 'User service', itemType: 'source', analysisStatus: 'analysed', explanation: 'Creates a user record from an incoming identifier.', preview },
    { path: 'src/repositories/UserRepository.ts', title: 'User repository', itemType: 'source', analysisStatus: 'analysed', explanation: 'Persists the created user through a repository abstraction.', preview: 'export class UserRepository {\n  constructor(private readonly url: string) {}\n\n  async save(user: unknown) {\n    return { url: this.url, user }\n  }\n}' },
  ],
  projectParts: [{ id: 'services', title: 'Service logic', shortExplanation: 'Application code that turns an identifier into a user record before persistence.', relatedFiles: ['src/services/userService.ts'] }, { id: 'repositories', title: 'Persistence boundary', shortExplanation: 'A repository class separates storage details from the service.', relatedFiles: ['src/repositories/UserRepository.ts'] }],
  relationships: [{ fromPath: 'src/services/userService.ts', toPath: 'src/repositories/UserRepository.ts', type: 'imports', status: 'analysed' }],
  symbols: [{ name: 'createUser', kind: 'function', signature: 'createUser(userId: string)', path: 'src/services/userService.ts', line: 7, analysisStatus: 'analysed' }, { name: 'UserRepository', kind: 'class', signature: 'class UserRepository', path: 'src/repositories/UserRepository.ts', line: 1, analysisStatus: 'analysed' }],
  sections: [
    { id: 'commands', title: 'Commands', items: [{ id: 'dev', title: 'npm run dev', explanation: 'Starts the development script recorded in the project manifest.', analysisStatus: 'analysed' }] },
    { id: 'concepts', title: 'Technical concepts', items: [{ id: 'entrypoint', title: 'entrypoint', technicalName: 'entrypoint', explanation: 'The first module or command that starts a project flow.', analysisStatus: 'analysed' }, { id: 'async', title: 'asynchronous function', technicalName: 'asynchronous function', explanation: 'A function that can pause while awaiting work that completes later.', analysisStatus: 'analysed' }, { id: 'middleware', title: 'middleware', technicalName: 'middleware', explanation: 'Code that runs while a request is moving toward its final route handler.', analysisStatus: 'inferred' }, { id: 'side-effect', title: 'side effect', technicalName: 'side effect', explanation: 'An observable change outside a function’s local calculation, such as saving a record.', analysisStatus: 'analysed' }] },
  ],
  limitations: { id: 'limitations', title: 'Evidence limits', shortExplanation: 'This fixture demonstrates presentation only; it does not claim runtime execution or a parser-backed call graph.' },
  overviewMarkdown: '<!-- project-lens:overview:v2 -->\n# Project Lens formatting demo\n\n> A deterministic fixture for the production report renderer.\n\n## At a glance\n\nThis demo shows how **technical evidence** is formatted for learning.\n\n## What it does\n\nIt presents a service, a repository boundary, and a verified static import.\n\n## How it works\n\n1. The **entrypoint** starts the service.\n2. The service calls a repository boundary.\n\n## Start here\n\nRead `src/services/userService.ts` first.\n\n## Project areas\n\nThe service and repository are separate responsibilities.',
  completeGuideMarkdown: '<!-- project-lens:complete-guide:v2 -->\n# Project Lens formatting demo — Complete Guide\n\n> A deterministic fixture for checking technical presentation.\n\n## Mental model\n\nAn **asynchronous function** receives an identifier, creates a record, and crosses a persistence boundary. A **side effect** occurs when the repository saves that record.\n\n## Architecture and execution flow\n\n`npm run dev` starts the development workflow. The **entrypoint** reaches `createUser()` and the service imports `UserRepository`.\n\n## Important folders\n\nThe service lives in **`src/services/`**.\n\n## Important files\n\n`src/services/userService.ts` creates the user record. `src/repositories/UserRepository.ts` owns the repository class.\n\n## Important symbols\n\n`createUser()` is the service function. `UserRepository` is the persistence class.\n\n## Commands\n\nRun `npm run dev` to start the configured development script.\n\n## Technical concepts\n\n**Middleware** is code that runs while a request is moving toward its final route handler. This fixture labels it as inferred because no middleware implementation is present.\n\n## Code walkthrough\n\nThe bounded excerpt below is the source evidence for the service flow.\n\n## Glossary\n\nThe technical concepts above are available in the project glossary.\n\n## Evidence and uncertainty\n\nStatic imports are verified. Runtime calls, execution order, and storage behaviour are not verified by this fixture.',
}

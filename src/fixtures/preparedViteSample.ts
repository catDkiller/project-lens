import type { NormalizedProject } from '../project-sources/types'

export const preparedViteSample: NormalizedProject = {
  id: 'prepared-vite-sample',
  name: 'Prepared Vite sample',
  framework: 'react-vite',
  files: [
    { path: 'src/main.tsx', content: "import { createRoot } from 'react-dom/client'\nimport App from './App'\n" },
    { path: 'src/App.tsx', content: 'export default function App() { return <main>Sample workspace</main> }\n' },
  ],
}

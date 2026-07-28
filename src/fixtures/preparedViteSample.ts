import type { NormalizedProject } from '../project-sources/types'

export const preparedViteSample: NormalizedProject = {
  id: 'prepared-vite-sample',
  name: 'Prepared Vite sample',
  framework: 'react-vite',
  files: [
    { path: 'src/main.tsx', content: "import { createRoot } from 'react-dom/client'\nimport App from './App'\n" },
    {
      path: 'src/App.tsx',
      content: "import { Routes, Route } from 'react-router-dom'\nimport { AppHeader } from './components/AppHeader'\nimport { LoginPage } from './pages/LoginPage'\nimport { DashboardPage } from './pages/DashboardPage'\nexport default function App() { return <Routes><Route path=\"/login\" element={<LoginPage />} /><Route path=\"/dashboard\" element={<DashboardPage />} /></Routes> }\n",
    },
    {
      path: 'src/components/AppHeader.tsx',
      content: "import { NavLink } from 'react-router-dom'\nexport function AppHeader() { return <header><nav><NavLink to=\"/dashboard\">Dashboard</NavLink></nav></header> }\n",
    },
    {
      path: 'src/pages/LoginPage.tsx',
      content: "import { LoginForm } from '../components/LoginForm'\nexport function LoginPage() { return <LoginForm /> }\n",
    },
    {
      path: 'src/components/LoginForm.tsx',
      content: "import { signIn } from '../services/authService'\nexport function LoginForm() { return <form><input type=\"email\" /><input type=\"password\" /></form> }\n",
    },
    {
      path: 'src/services/authService.ts',
      content: 'export function signIn() { return Promise.resolve() }\n',
    },
    {
      path: 'src/pages/DashboardPage.tsx',
      content: "import { MetricCard } from '../components/MetricCard'\nexport function DashboardPage() { return <MetricCard /> }\n",
    },
    {
      path: 'src/components/MetricCard.tsx',
      content: 'export function MetricCard() { return <section>Metrics</section> }\n',
    },
    {
      path: 'src/utils/formatDate.ts',
      content: 'export function formatDate(value: Date) { return value.toISOString() }\n',
    },
  ],
}

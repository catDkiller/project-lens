import type { FeatureDefinition } from '../analysis'

export const preparedSampleFeatureDefinitions: FeatureDefinition[] = [
  {
    id: 'navigation',
    label: 'Navigation',
    filenameTokens: ['navigation', 'nav', 'navbar', 'header', 'sidebar', 'router', 'routes'],
    routeRules: [{ pattern: /<(Routes|Route)\b|createBrowserRouter\b/, fact: 'Contains a navigation route declaration.', weight: 5 }],
    contentRules: [
      { pattern: /<(NavLink|Link)\b/, fact: 'Contains navigation link JSX.', weight: 3 },
      { pattern: /export\s+(?:default\s+)?(?:function|const|class)\s+[A-Za-z_$]*?(Navigation|NavBar|Header|Sidebar|Router|Routes)\b/, fact: 'Exports a navigation-matching component.', weight: 2 },
    ],
    importRules: [{ pattern: /^react-router-dom$/, fact: 'Imports React Router.', weight: 3 }],
  },
  {
    id: 'login',
    label: 'Login',
    filenameTokens: ['login', 'signin', 'auth'],
    routeRules: [{ pattern: /path\s*=\s*["'][^"']*\/(login|sign-in|signin|auth)[^"']*["']/i, fact: 'Contains a login route declaration.', weight: 5 }],
    contentRules: [
      { pattern: /(?=[\s\S]*type\s*=\s*["']email["'])(?=[\s\S]*type\s*=\s*["']password["'])/, fact: 'Contains both email and password form inputs.', weight: 4 },
      { pattern: /export\s+(?:default\s+)?(?:function|const|class)\s+[A-Za-z_$]*?(Login|SignIn|Auth)\b/, fact: 'Exports a login-matching component.', weight: 2 },
    ],
    importRules: [{ pattern: /auth|session|token/i, fact: 'Imports an authentication-related module.', weight: 3 }],
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    filenameTokens: ['dashboard'],
    routeRules: [{ pattern: /path\s*=\s*["'][^"']*\/dashboard[^"']*["']/i, fact: 'Contains a dashboard route declaration.', weight: 5 }],
    contentRules: [{ pattern: /export\s+(?:default\s+)?(?:function|const|class)\s+[A-Za-z_$]*?Dashboard\b/, fact: 'Exports a dashboard-matching component.', weight: 2 }],
  },
]

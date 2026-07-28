import type { FeatureLearningPack } from '../learning'

export const preparedSampleLearningPacks: FeatureLearningPack[] = [
  {
    featureId: 'navigation',
    summary: 'This feature gives the sample predictable links between its login and dashboard pages.',
    concepts: [
      {
        canonicalName: 'React Router',
        plainExplanation: 'React Router maps a browser URL to a React component.',
        whyItExists: 'It lets each page have an address users can open or share.',
        evidenceFiles: ['src/App.tsx'],
      },
      {
        canonicalName: 'NavLink',
        plainExplanation: 'NavLink is a link component designed for in-app navigation.',
        whyItExists: 'It connects the header to the dashboard route without a full page reload.',
        evidenceFiles: ['src/components/AppHeader.tsx'],
      },
    ],
    complexityItems: [
      {
        title: 'Route declarations',
        classification: 'essential',
        explanation: 'The Routes and Route elements in the app shell map the sample URLs to its page components.',
        evidenceFiles: ['src/App.tsx'],
      },
      {
        title: 'Router setup for a small project',
        classification: 'review-before-copy',
        explanation: 'URL-based navigation is useful for multiple pages; decide whether this setup fits the number of screens in your project.',
        evidenceFiles: ['src/App.tsx', 'src/components/AppHeader.tsx'],
      },
    ],
    learningSteps: [
      { order: 1, topic: 'URLs and routes', reason: 'Learn how the app shell maps /login and /dashboard to page components.' },
      { order: 2, topic: 'Navigation links', reason: 'See how AppHeader uses NavLink to point to a route.' },
    ],
  },
  {
    featureId: 'login',
    summary: 'This feature provides a login page and a form shape with email and password inputs.',
    concepts: [
      {
        canonicalName: 'Semantic form inputs',
        plainExplanation: 'Input types tell the browser what kind of value a form field expects.',
        whyItExists: 'Email and password inputs describe the credentials this form is designed to collect.',
        evidenceFiles: ['src/components/LoginForm.tsx'],
      },
      {
        canonicalName: 'Component composition',
        plainExplanation: 'One component can render another component as part of its UI.',
        whyItExists: 'LoginPage keeps the route-level page separate from the LoginForm UI.',
        evidenceFiles: ['src/pages/LoginPage.tsx', 'src/components/LoginForm.tsx'],
      },
    ],
    complexityItems: [
      {
        title: 'Credential input fields',
        classification: 'essential',
        explanation: 'A password login form needs a way to collect the email and password values shown in this fixture.',
        evidenceFiles: ['src/components/LoginForm.tsx'],
      },
      {
        title: 'Authentication helper boundary',
        classification: 'review-before-copy',
        explanation: 'The form imports signIn, but this fixture does not call it. Review error handling, session storage, and server-side credential handling before copying an authentication flow.',
        evidenceFiles: ['src/components/LoginForm.tsx', 'src/services/authService.ts'],
      },
    ],
    learningSteps: [
      { order: 1, topic: 'HTML form inputs', reason: 'Understand what email and password input types communicate.' },
      { order: 2, topic: 'Page and form components', reason: 'Follow the import from LoginPage to LoginForm.' },
      { order: 3, topic: 'Authentication boundaries', reason: 'Learn why a client-side form needs a reviewed server-side sign-in design.' },
    ],
  },
  {
    featureId: 'dashboard',
    summary: 'This feature renders a dashboard page that composes a small metrics card.',
    concepts: [
      {
        canonicalName: 'Route component',
        plainExplanation: 'A route component is the page React renders for a matching URL.',
        whyItExists: 'DashboardPage is connected to the /dashboard route in the app shell.',
        evidenceFiles: ['src/App.tsx', 'src/pages/DashboardPage.tsx'],
      },
      {
        canonicalName: 'Component composition',
        plainExplanation: 'A page can render smaller components that each own part of the interface.',
        whyItExists: 'DashboardPage renders MetricCard rather than putting that markup directly in the page.',
        evidenceFiles: ['src/pages/DashboardPage.tsx', 'src/components/MetricCard.tsx'],
      },
    ],
    complexityItems: [
      {
        title: 'Dashboard route entry',
        classification: 'essential',
        explanation: 'The sample needs the /dashboard route to reach its dashboard page from the app shell.',
        evidenceFiles: ['src/App.tsx', 'src/pages/DashboardPage.tsx'],
      },
      {
        title: 'Extracting a tiny metric card',
        classification: 'review-before-copy',
        explanation: 'A separate MetricCard can help when a dashboard grows, but for one small piece of markup decide whether the extra file improves clarity.',
        evidenceFiles: ['src/pages/DashboardPage.tsx', 'src/components/MetricCard.tsx'],
      },
    ],
    learningSteps: [
      { order: 1, topic: 'Route-to-page mapping', reason: 'Trace the /dashboard route to DashboardPage.' },
      { order: 2, topic: 'Importing a child component', reason: 'See how DashboardPage imports and renders MetricCard.' },
    ],
  },
]

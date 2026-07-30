import type { PresentationKnowledgeBase } from '../knowledge'

export const preparedSamplePresentationKnowledge: PresentationKnowledgeBase = {
  version: '1.0',
  projectName: 'Prepared Vite sample',
  projectTypeLabel: 'Web application',
  shortSummary: 'A small web application with a sign-in screen, navigation, and a dashboard.',
  overview: {
    whatItIs: 'A small React application that shows how a few screens can be connected in one project.',
    whatItDoes: [
      { id: 'move', title: 'Move between the main screens', explanation: 'Links connect the sign-in screen and the dashboard.', relatedEvidence: [{ path: 'src/App.tsx' }, { path: 'src/components/AppHeader.tsx' }] },
      { id: 'sign-in', title: 'Collect sign-in details', explanation: 'The sign-in form asks for an email address and password.', relatedEvidence: [{ path: 'src/components/LoginForm.tsx' }] },
      { id: 'dashboard', title: 'Show a simple dashboard', explanation: 'The dashboard displays a small metrics card.', relatedEvidence: [{ path: 'src/pages/DashboardPage.tsx' }, { path: 'src/components/MetricCard.tsx' }] },
    ],
    mainParts: [
      { id: 'navigation', title: 'Moving between screens', explanation: 'Connects the sign-in screen and dashboard.', technicalName: 'Client-side routing', relatedEvidence: [{ path: 'src/App.tsx' }, { path: 'src/components/AppHeader.tsx' }] },
      { id: 'login', title: 'Signing in', explanation: 'Collects the details someone would use to enter the application.', technicalName: 'Sign-in form', relatedEvidence: [{ path: 'src/pages/LoginPage.tsx' }, { path: 'src/components/LoginForm.tsx' }] },
      { id: 'dashboard', title: 'The dashboard', explanation: 'Shows the application’s main information in a reusable card.', technicalName: 'Dashboard page', relatedEvidence: [{ path: 'src/pages/DashboardPage.tsx' }, { path: 'src/components/MetricCard.tsx' }] },
    ],
    whereToStart: [
      { id: 'app', title: 'src/App.tsx', explanation: 'Connects the main screens to their browser addresses.', relatedEvidence: [{ path: 'src/App.tsx' }] },
      { id: 'header', title: 'src/components/AppHeader.tsx', explanation: 'Contains the link used to move to the dashboard.', relatedEvidence: [{ path: 'src/components/AppHeader.tsx' }] },
      { id: 'dashboard-page', title: 'src/pages/DashboardPage.tsx', explanation: 'Builds the main dashboard screen.', relatedEvidence: [{ path: 'src/pages/DashboardPage.tsx' }] },
    ],
    usefulContext: 'Start with the screen connections, then follow one screen into its smaller pieces.',
  },
  projectParts: [
    {
      id: 'navigation', title: 'Moving between screens', technicalName: 'Client-side routing', shortExplanation: 'Links connect the sign-in screen and dashboard without leaving the application.', relatedFiles: ['src/App.tsx', 'src/components/AppHeader.tsx'],
      items: [
        { id: 'router', title: 'Matching an address to a screen', technicalName: 'React Router', explanation: 'The application chooses a screen based on the address in the browser.', whyItMatters: 'This gives each main screen a link someone can open or share.', relatedEvidence: [{ path: 'src/App.tsx' }] },
        { id: 'nav-link', title: 'Links inside the app', technicalName: 'NavLink', explanation: 'The header contains a link that changes screens without a full page reload.', whyItMatters: 'It gives people a clear way to reach the dashboard.', relatedEvidence: [{ path: 'src/components/AppHeader.tsx' }] },
      ],
      learningPath: [
        { id: 'routes', title: 'See how the main screens are connected', explanation: 'Look at how the application associates each browser address with a screen.' },
        { id: 'links', title: 'See how the header moves between screens', explanation: 'Follow the dashboard link in the header.' },
      ],
      essentialComplexity: [{ id: 'route-declarations', title: 'Connecting addresses to screens', explanation: 'The project needs these connections so people can reach each main screen.', relatedEvidence: [{ path: 'src/App.tsx' }] }],
      reviewBeforeCopying: [{ id: 'router-size', title: 'Using browser addresses in a small project', explanation: 'This is useful when an application has several screens. Decide whether it fits the size of your own project.', relatedEvidence: [{ path: 'src/App.tsx' }, { path: 'src/components/AppHeader.tsx' }] }],
      evidenceReferences: [{ path: 'src/App.tsx', fact: 'The app imports Routes and Route from react-router-dom.' }, { path: 'src/components/AppHeader.tsx', fact: 'The header imports NavLink from react-router-dom.' }],
      importRelationships: ['src/App.tsx imports react-router-dom.', 'src/App.tsx imports src/components/AppHeader.tsx.', 'src/components/AppHeader.tsx imports react-router-dom.'],
      codeExamples: [{ label: 'src/App.tsx', code: "import { Routes, Route } from 'react-router-dom'\nimport { LoginPage } from './pages/LoginPage'\nimport { DashboardPage } from './pages/DashboardPage'" }],
    },
    {
      id: 'login', title: 'Signing in', technicalName: 'Sign-in form', shortExplanation: 'A screen where someone enters an email address and password.', relatedFiles: ['src/pages/LoginPage.tsx', 'src/components/LoginForm.tsx', 'src/services/authService.ts'],
      items: [
        { id: 'form-fields', title: 'Collecting sign-in details', technicalName: 'Email and password inputs', explanation: 'The form has one field for an email address and another for a password.', whyItMatters: 'The fields make clear what information the screen is meant to collect.', relatedEvidence: [{ path: 'src/components/LoginForm.tsx' }] },
        { id: 'page-form', title: 'Keeping the screen and form separate', technicalName: 'Component composition', explanation: 'The page shows a separate form rather than placing all of its markup in one file.', whyItMatters: 'This can keep a screen easier to follow as it grows.', relatedEvidence: [{ path: 'src/pages/LoginPage.tsx' }, { path: 'src/components/LoginForm.tsx' }] },
      ],
      learningPath: [{ id: 'inputs', title: 'See what the form asks for', explanation: 'Start with the email and password fields.' }, { id: 'page-form', title: 'See how the screen is assembled', explanation: 'Follow the page’s connection to the form.' }, { id: 'sign-in-boundary', title: 'Review what a real sign-in flow needs', explanation: 'A live application needs carefully designed server-side sign-in handling.' }],
      essentialComplexity: [{ id: 'credentials', title: 'Collecting an email and password', explanation: 'A password sign-in screen needs a way to collect the details it asks for.', relatedEvidence: [{ path: 'src/components/LoginForm.tsx' }] }],
      reviewBeforeCopying: [{ id: 'auth-service', title: 'Connecting a form to sign-in logic', explanation: 'The sample includes a sign-in helper but does not call it. Review errors, sessions, and secure server-side handling before copying this pattern.', relatedEvidence: [{ path: 'src/components/LoginForm.tsx' }, { path: 'src/services/authService.ts' }] }],
      evidenceReferences: [{ path: 'src/components/LoginForm.tsx', fact: 'The form contains email and password input elements.' }, { path: 'src/services/authService.ts', fact: 'The project contains a signIn helper.' }],
      importRelationships: ['src/pages/LoginPage.tsx imports src/components/LoginForm.tsx.', 'src/components/LoginForm.tsx imports src/services/authService.ts.'],
      codeExamples: [{ label: 'src/components/LoginForm.tsx', code: "import { signIn } from '../services/authService'\nexport function LoginForm() { return <form><input type=\"email\" /><input type=\"password\" /></form> }" }],
    },
    {
      id: 'dashboard', title: 'The dashboard', technicalName: 'Dashboard page', shortExplanation: 'The main dashboard shows a small metrics card.', relatedFiles: ['src/pages/DashboardPage.tsx', 'src/components/MetricCard.tsx'],
      items: [
        { id: 'dashboard-page', title: 'Showing the dashboard screen', technicalName: 'Route component', explanation: 'Opening the dashboard address leads to this page.', whyItMatters: 'It gives the dashboard a clear place in the application.', relatedEvidence: [{ path: 'src/App.tsx' }, { path: 'src/pages/DashboardPage.tsx' }] },
        { id: 'metric-card', title: 'Building a screen from smaller pieces', technicalName: 'Component composition', explanation: 'The page uses a separate card for its metrics.', whyItMatters: 'Smaller pieces can make repeated interface elements easier to reuse.', relatedEvidence: [{ path: 'src/pages/DashboardPage.tsx' }, { path: 'src/components/MetricCard.tsx' }] },
      ],
      learningPath: [{ id: 'dashboard-entry', title: 'See how opening the dashboard leads to this screen', explanation: 'Follow the dashboard address to the page shown on screen.' }, { id: 'dashboard-card', title: 'See how the dashboard is assembled', explanation: 'Follow the page’s connection to the metrics card.' }],
      essentialComplexity: [{ id: 'dashboard-entry', title: 'A way to reach the dashboard', explanation: 'The project needs a connection from the application shell to the dashboard page.', relatedEvidence: [{ path: 'src/App.tsx' }, { path: 'src/pages/DashboardPage.tsx' }] }],
      reviewBeforeCopying: [{ id: 'small-card', title: 'Putting a small card in its own file', explanation: 'A separate card can help when a dashboard grows. For a single small piece, decide whether the extra file makes the project clearer.', relatedEvidence: [{ path: 'src/pages/DashboardPage.tsx' }, { path: 'src/components/MetricCard.tsx' }] }],
      evidenceReferences: [{ path: 'src/pages/DashboardPage.tsx', fact: 'The dashboard page imports MetricCard.' }, { path: 'src/components/MetricCard.tsx', fact: 'MetricCard returns a section labelled Metrics.' }],
      importRelationships: ['src/pages/DashboardPage.tsx imports src/components/MetricCard.tsx.'],
      codeExamples: [{ label: 'src/pages/DashboardPage.tsx', code: "import { MetricCard } from '../components/MetricCard'\nexport function DashboardPage() { return <MetricCard /> }" }],
    },
  ],
  files: [
    { path: 'src/main.tsx', explanation: 'Starts the application.', itemType: 'source', evidenceReferences: [{ path: 'src/main.tsx' }] },
    { path: 'src/App.tsx', explanation: 'Connects the main screens to browser addresses.', itemType: 'source', evidenceReferences: [{ path: 'src/App.tsx' }] },
    { path: 'src/components/AppHeader.tsx', explanation: 'Contains the dashboard link in the page header.', itemType: 'source', evidenceReferences: [{ path: 'src/components/AppHeader.tsx' }] },
    { path: 'src/pages/LoginPage.tsx', explanation: 'Shows the sign-in form.', itemType: 'source', evidenceReferences: [{ path: 'src/pages/LoginPage.tsx' }] },
    { path: 'src/components/LoginForm.tsx', explanation: 'Collects an email address and password.', itemType: 'source', evidenceReferences: [{ path: 'src/components/LoginForm.tsx' }] },
    { path: 'src/services/authService.ts', explanation: 'Contains a sign-in helper.', itemType: 'source', evidenceReferences: [{ path: 'src/services/authService.ts' }] },
    { path: 'src/pages/DashboardPage.tsx', explanation: 'Builds the dashboard screen.', itemType: 'source', evidenceReferences: [{ path: 'src/pages/DashboardPage.tsx' }] },
    { path: 'src/components/MetricCard.tsx', explanation: 'Shows the dashboard’s metrics card.', itemType: 'source', evidenceReferences: [{ path: 'src/components/MetricCard.tsx' }] },
    { path: 'src/utils/formatDate.ts', explanation: 'The file was found, but its exact role could not be confirmed.', itemType: 'source', analysisStatus: 'uncertain', evidenceReferences: [{ path: 'src/utils/formatDate.ts' }] },
  ],
  technologies: [
    { name: 'React', explanation: 'Creates the interface from reusable pieces.', technicalName: 'React', evidenceReferences: [{ path: 'src/App.tsx' }] },
    { name: 'Vite', explanation: 'Runs and builds this project.', technicalName: 'Vite' },
    { name: 'React Router', explanation: 'Connects browser addresses to the right screen.', technicalName: 'react-router-dom', evidenceReferences: [{ path: 'src/App.tsx' }] },
  ],
  learningPath: [{ id: 'start', title: 'Start with the screen connections', explanation: 'See how the main screens are linked before looking at their smaller pieces.' }, { id: 'form', title: 'Then look at the sign-in form', explanation: 'See how the form collects information.' }, { id: 'dashboard', title: 'Finish with the dashboard', explanation: 'See how the page and metrics card fit together.' }],
  limitations: { id: 'analysis-notes', title: 'Analysis notes', shortExplanation: 'Some parts of a project cannot be confirmed from this kind of analysis.', items: [{ id: 'dynamic', title: 'Some connections may be missing', explanation: 'Connections created while the application is running may not appear here.', technicalName: 'Dynamic imports, aliases, and package internals are not inspected.' }] },
  technicalReference: [
    { id: 'raw-analysis', title: 'Analysis evidence', shortExplanation: 'These are the technical facts used to support the explanations above.', items: [{ id: 'imports', title: 'Static imports', explanation: 'The analysis checks JavaScript, JSX, TypeScript, and TSX import statements.', technicalName: 'Static import extraction' }], evidenceReferences: [{ path: 'src/App.tsx', fact: 'The app imports React Router and the main page files.' }] },
  ],
}

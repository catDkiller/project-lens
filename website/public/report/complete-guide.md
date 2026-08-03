<!-- project-lens:complete-guide:v2 -->
# Complete Guide

## Mental model
This codebase is a small React app organized around route-to-component composition. The entry point mounts the app once, the router selects a page by URL, and each page delegates almost all visible UI to a single leaf component.

The important mental split is:
- `src/main.tsx` bootstraps React into the document.
- `src/App.tsx` decides what appears for each route.
- `src/components/*` contains the actual UI fragments.
- `src/services/authService.ts` and `src/utils/formatDate.ts` are the only explicit non-UI helpers in the snapshot.

## Architecture or execution flow
Startup flow:
1. `src/main.tsx` calls `createRoot(document.getElementById('root')!)`.
2. The root renders `App`.
3. `App` renders `AppHeader` and a `Routes` switch from `react-router-dom`.
4. The active route loads either `LoginPage` or `DashboardPage`.
5. Each page returns a single component: `LoginForm` or `MetricCard`.

Confirmed communication paths:
- `App` imports `AppHeader`, `LoginPage`, and `DashboardPage`.
- `LoginPage` imports `LoginForm`.
- `DashboardPage` imports `MetricCard`.
- `LoginForm` imports `signIn` from `src/services/authService.ts`.

## Project areas
### App shell and navigation
`src/App.tsx` and `src/components/AppHeader.tsx` define the top-level navigation structure. `AppHeader` renders a `NavLink` to `/dashboard`, so the dashboard route is the only explicitly surfaced destination in the chrome.

### Login surface
`src/pages/LoginPage.tsx` is only a wrapper around `LoginForm`, so the form itself is the actual implementation point. `LoginForm` renders email and password inputs and references `signIn` from the auth service. In the current snapshot, it does not submit data or wire event handlers, so it is a static form shell rather than a completed login flow.

### Dashboard surface
`src/pages/DashboardPage.tsx` delegates to `MetricCard`, which currently returns a simple `section` with the text `Metrics`. That makes the dashboard route a placeholder surface rather than a populated analytics view.

### Shared helpers
`src/services/authService.ts` exports `signIn()`, which currently resolves a promise immediately. `src/utils/formatDate.ts` exports `formatDate(value: Date)`, which returns `value.toISOString()`. Both look like utility seams for future expansion, but only the auth service is referenced by visible UI code.

## File walkthrough
### `src/main.tsx`
Bootstraps the app with `createRoot` from `react-dom/client` and renders `App` into the `root` element. The non-null assertion on `getElementById('root')` means the page must provide that element, or startup will fail immediately.

### `src/App.tsx`
Defines the app composition. It imports `Routes` and `Route` from `react-router-dom`, plus the header and page components. The route table currently exposes `/login` and `/dashboard`; there is no fallback route in the snapshot, so unmatched URLs would render nothing from the router.

### `src/components/AppHeader.tsx`
Renders a `header` containing a `nav` with one `NavLink` to `/dashboard`. This is the only visible navigation control in the snapshot and confirms `react-router-dom` is used for client-side navigation.

### `src/pages/LoginPage.tsx`
A pass-through page component that returns `LoginForm`. Its purpose is structural: it gives the router a page-level target while keeping the form implementation isolated.

### `src/components/LoginForm.tsx`
Imports `signIn` but only references it through `void signIn`, which suppresses unused-import noise without invoking the function. The rendered form contains email and password inputs only. No `onSubmit`, no state, and no validation are visible, so the form does not yet perform authentication work.

### `src/services/authService.ts`
Exports `signIn()` as a promise-returning stub. Since it resolves immediately and accepts no arguments, it currently behaves like a placeholder API rather than a real auth integration.

### `src/pages/DashboardPage.tsx`
Pass-through page component for the dashboard route. It exists to keep routing concerns separate from the displayed content.

### `src/components/MetricCard.tsx`
Renders a `section` labeled `Metrics`. The component name suggests a future data display card, but the current implementation is static text.

### `src/utils/formatDate.ts`
Exports `formatDate(value: Date)`, which returns `toISOString()`. This is a tiny transformation helper that standardizes dates as ISO strings if other code chooses to consume it.

## Suggested learning order
1. `src/main.tsx` to see how the app is mounted.
2. `src/App.tsx` to understand routing and the shared shell.
3. `src/components/AppHeader.tsx` to see the only navigational affordance.
4. `src/pages/LoginPage.tsx` and `src/components/LoginForm.tsx` to inspect the login surface.
5. `src/pages/DashboardPage.tsx` and `src/components/MetricCard.tsx` to inspect the dashboard surface.
6. `src/services/authService.ts` and `src/utils/formatDate.ts` to understand the non-UI helpers currently available.

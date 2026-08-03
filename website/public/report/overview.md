<!-- project-lens:overview:v2 -->
# Overview
> A small React router-driven app with a login view, a dashboard view, and a thin auth service stub.

## At a glance
This snapshot is a minimal single-page React application. `src/main.tsx` mounts `App`, and `src/App.tsx` defines the visible routes and shared header.

## What it does
The app exposes two screens:
- `/login` renders a login form with email and password inputs.
- `/dashboard` renders a simple metrics placeholder.

The shared header always shows a navigation link to the dashboard.

## How it works
Execution starts in `src/main.tsx`, which creates the React root at the DOM element with id `root` and renders `App`.

`src/App.tsx` wires the UI together with `react-router-dom`:
- `AppHeader` is rendered above the route content.
- `LoginPage` is mounted at `/login`.
- `DashboardPage` is mounted at `/dashboard`.

`LoginPage` and `DashboardPage` are thin wrappers around their respective components, so the visible behavior lives mostly in `src/components`.

## Start here
1. `src/main.tsx` for the entry point.
2. `src/App.tsx` for routing and layout composition.
3. `src/components/LoginForm.tsx` and `src/components/MetricCard.tsx` for the actual screen content.
4. `src/services/authService.ts` for the only explicit business-service symbol in the snapshot.

## Project areas
- App shell and routing: `src/main.tsx`, `src/App.tsx`
- Navigation chrome: `src/components/AppHeader.tsx`
- Login surface: `src/pages/LoginPage.tsx`, `src/components/LoginForm.tsx`
- Dashboard surface: `src/pages/DashboardPage.tsx`, `src/components/MetricCard.tsx`
- Shared utilities and service stub: `src/services/authService.ts`, `src/utils/formatDate.ts`

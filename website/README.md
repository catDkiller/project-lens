# Project Lens public website

This independent Vite site is the static public story for Project Lens. It
uses the approved interactive landscape language: quiet terrain, editorial
serif type, section navigation, and keyboard/drag/scroll movement.

It has no daemon, account, upload flow, or environment requirement. The page
does not analyse visitor projects; it explains the evidence-backed Overview and
Complete Guide experience.

## Local development

```bash
npm install
npm run dev
npm run lint
npm run test
npm run build
npm run preview
```

From the repository root, use `npm run website:dev`. The public site uses port
4174 so it cannot conflict with the Project Lens application.

## Static deployment

Set the deployment root directory to `website`, use `npm run build`, and serve
the generated `dist` directory. No environment variables are required.

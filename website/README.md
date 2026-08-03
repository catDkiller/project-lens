# Project Lens public demo website

This independent Vite site is the static public story for Project Lens. It has no daemon, account, or environment requirement.

The report preview is a preserved, static presentation of the product’s
Overview and Complete Guide reading model. It does not claim to analyse the
visitor’s project or provide live uploads. See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)
for the public visual and interaction rules.

## Local development

```bash
npm install
npm run dev
npm run lint
npm run test
npm run build
npm run preview
```

## Static deployment on Vercel

Import the repository in Vercel, then set the project **Root Directory** to `website`.

- Framework preset: `Vite`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

No environment variables are required. The recorded walkthrough is optional: when available, provide a public video URL using `VITE_DEMO_VIDEO_URL`; otherwise the designed placeholder remains visible.

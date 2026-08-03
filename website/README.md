# Project Lens public website

This independent Vite site is the static public story for Project Lens. It
uses the approved interactive landscape language: quiet terrain, editorial
serif type, section navigation, and keyboard/drag/scroll movement.

It has no daemon, account, or project-upload flow. The page does not analyse
visitor projects; it explains the evidence-backed Overview and Complete Guide
experience. The final demo-video stop is a truthful placeholder until a video
source is supplied.

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

## Add the final demo video

Add the final demo video here:

`website/public/media/project-lens-demo.mp4`

Optional poster:

`website/public/media/project-lens-demo-poster.webp`

No source-code changes are required. Run the website build after adding the
file. The placeholder becomes an accessible video player with native controls
only when the local file exists; missing media does not trigger a request or a
404. A public `VITE_DEMO_VIDEO_URL` may also be supplied at build time.

## Static deployment

Set the deployment root directory to `website`, use `npm run build`, and serve
the generated `dist` directory.

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

For the submission video, export an MP4 and place it at
`public/media/project-lens-demo.mp4` (optionally add
`public/media/project-lens-demo-poster.webp`), then run the website build. No
source edit is needed. Alternatively set `VITE_DEMO_VIDEO_URL` to a public
video URL before building. The placeholder becomes an accessible video player
with controls only when one of these sources exists; missing media does not
trigger a request or a 404.

## Static deployment

Set the deployment root directory to `website`, use `npm run build`, and serve
the generated `dist` directory.

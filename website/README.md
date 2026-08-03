# Project Lens public website

This independent Vite site is the static public story for Project Lens. It
uses the approved interactive landscape language: quiet terrain, editorial
serif type, section navigation, and keyboard/drag/scroll movement.

It has no daemon, account, or project-upload flow. The page does not analyse
visitor projects; it explains the evidence-backed Overview and Complete Guide
experience. The final demo is embedded from YouTube.

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

## Final demo video

The public website embeds the final demo directly from YouTube:

- Watch on YouTube: <https://youtu.be/lNfbdZfcho0>
- Privacy-enhanced embed: <https://www.youtube-nocookie.com/embed/lNfbdZfcho0>
- Public preserved report: <https://website-seven-beryl-14.vercel.app/report/>

The website uses a responsive 16:9 iframe with native YouTube controls. No
local video upload or source-code change is required.

## Static deployment

Set the deployment root directory to `website`, use `npm run build`, and serve
the generated `dist` directory.

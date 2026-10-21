# Portfolio

[![Check & Deploy](https://github.com/chimkenchrls/portfolio/actions/workflows/deploy.yml/badge.svg)](https://github.com/chimkenchrls/portfolio/actions/workflows/deploy.yml)

Personal portfolio of Kenneth Charles Valdez, a BS Computer Science student and aspiring DevOps engineer.

Live site: https://kenchrls.vercel.app

GitHub Pages mirror: https://chimkenchrls.github.io/portfolio/

## Overview

A static site written in plain HTML, CSS, and vanilla JavaScript. It has no framework or runtime dependencies. Deployment stages the runtime files and versions the CSS/JS URLs. Vercel deploys from the connected GitHub repository; GitHub Actions tests every push to `main` and publishes a GitHub Pages mirror.

## Features

- Responsive layout: sidebar on desktop, icon rail on tablet, drawer on mobile
- Dark theme by default, with a saved light/dark toggle
- Project showcase with desktop and mobile screenshots
- Live GitHub contribution calendar
- Floating pixel character with a Gemini portfolio chat (optional private Node server)
- Interactive terminal for contact details
- A small endless-runner game, chimken (press Alt + K)
- Motion that respects the reduced-motion setting, and full keyboard navigation

## Project structure

```text
index.html        Page shell
style.css         Styles
script.js         Behaviour
assets/data.js    All editable content
assets/           Images, icons, fonts, resume
tests/            Unit tests (node:test)
tests/e2e/        Browser checks (Playwright, run locally)
server.js         Optional local site + Gemini server (Node.js 22+)
server/chat.js    Portfolio grounding, input validation, and provider requests
worker/           Cloudflare Worker: chat, pokes, contact, and moderated notes
wrangler.toml     Worker configuration (no secrets)
.github/          CI/CD workflow
```

## Running locally

Internal page links update the main content through the History API while keeping
the sidebar and its state mounted. Back/Forward restore the visited page and its
scroll position. Direct URLs and page refreshes still work as ordinary static
pages. Clicking Home replays the hero intro with navigation hidden until scrolling,
while the sidebar stays mounted and retains its state.

```bash
node server.js
```

Then open http://localhost:8787. Use Node 22.13+; the guestbook uses Node's built-in SQLite and needs no API key. See [guestbook setup and moderation](./docs/guestbook.md).

For a static-only preview, `python3 -m http.server 8000` still serves the site at http://localhost:8000, but it cannot load or save local guestbook notes.

For live AI chat, copy `.env.example` to `.env`, add `GEMINI_API_KEY`, and run `node --env-file=.env server.js`. Open http://localhost:8787. The API key stays on the server. See [assistant setup and hosting](./docs/assistant.md).

## Updating content

All content lives in [`assets/data.js`](./assets/data.js). Use `null` for anything that is not ready yet; the page shows a "coming soon" state in its place.

Common edits in that file:

| Change | Where to edit |
| --- | --- |
| Add a tool to Stack | `stack[].items`; put its SVG in `assets/icons/stack/` and use the filename without `.svg` as `icon` |
| Show a project beside a tool on Stack | Add the matching tool name to that project's `tags`; project links are derived automatically |
| Update the short Home project description | The project's `summary` and `kind` |
| Add a blog thumbnail | The post's `thumbnail`, using a relative image path in `assets/blog/` |
| Publish a blog post | Set both `writing[].date` and `writing[].body` |
| Update the resume | Keep `resumePage` and `assets/resume.pdf` in step |

Visitor notes are stored in the database, not in `data.js`. See the [review and moderation commands](./docs/guestbook.md) to approve or remove them.

Home's **Selected projects** list uses each project's optional `summary` and `kind` for its short description and type label, falling back to the full description and first tag. The count is derived from the project list, and every project is visible immediately. Full project cards and case studies keep their detailed descriptions.

On devices with a fine pointer, hovering a Home project shows a small preview below the cursor, flipped inward near viewport edges. A project's `demo` plays silently while hovered; projects with `chat` show the first two nonsystem messages from `chat.previewScene` (matching a scene label, or the first scene by default). Other projects use the desktop screenshot or bot image. Leaving, scrolling, pressing Escape, or hiding the tab stops playback. Reduced motion shows the poster without playback or cursor-following motion; touch screens keep the ordinary project links.

**Links** (`./?view=links`) sits above Blog in the sidebar. `linksPage` defines the heading and the Social/Work groups; each row reads its destination from `profile`. Set `profile.discordUrl`, `profile.tiktok` and `profile.facebook` to HTTPS profile URLs (or `null`). Discord copies `profile.discord` while its URL is missing. LinkedIn, GitHub, email and resume reuse the existing profile fields; missing destinations show a non-clickable "Coming soon" row.

The **More about me** page (`./?view=more`) opens with `more.title`, the centered Outside the IDE photo deck, the profile name and role, and `more.intro`. Full-width Experience and Education rows reuse the same content as Home, followed by the `writing` list and terminal.

**Blog** (`./?view=blog`) sits below Links in the sidebar, with its title and introduction in `blogPage`. Blog and More about me show the full `writing` list; Home has no blog preview. Each entry has a unique lowercase `slug`, `title`, `excerpt`, `date` and `body`, plus an optional `thumbnail` image from `assets/blog/`. Leave `date` and `body` as `null` for an upcoming post; it has no link until both are filled. To publish, set a real `YYYY-MM-DD` date and the finished body text (separate paragraphs with blank lines). The post opens at `./?view=post&p=<slug>` with a back link to Blog. Reading time is estimated from the body at 200 words per minute. Text is rendered literally, without HTML or Markdown. Unknown or unfinished post URLs show Blog.

The photo deck fans out around the active photo, with up to three neighbors on either side and a clickable position dot per photo. Tap/click, swipe, or use Enter/arrow keys to shuffle; holding reveals color. `outsideHint` controls the hint text, and `outside` supplies the photos. The Live Photo plays only when active, on screen and motion is allowed.

Certification entries use `status: "in-progress"` or `"completed"`, with a completion `date` (or `null` while in progress). Put issuer logos (SVG, JPG, PNG, WebP) and certificate photos (JPG, PNG, WebP) in `assets/certifications/`, then set the entry's relative `logo` and `photo` paths. Completed entries with a photo show a **View certificate** button that opens the image viewer. An optional `link` provides issuer verification when there is no photo. Leave missing assets `null`; cards show a neutral certificate icon and only offer an action when a photo or link exists.

Optional `photoCrop: { aspectRatio, positionY }` crops a photograph in the viewer using CSS, preserving the original image file. `aspectRatio` is the visible width divided by height; `positionY` is its vertical object position from 0 to 100 percent. Asset sources and image-edit prompts are recorded in [`assets/certifications/README.md`](./assets/certifications/README.md).

## Testing

```bash
node --test tests/*.test.js
```

The browser checks need Docker and a local server on port 8000:

```bash
tests/e2e/run.sh
```

## Deployment

[`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) runs on every push and pull request:

1. Unit tests
2. JavaScript syntax check
3. HTML validation (`html-validate`)
4. Offline link and asset check (`lychee`)

Vercel deploys pushes to `main` through the connected repository. GitHub Pages deploys after the workflow checks pass. Both publish only the runtime files (`index.html`, `style.css`, `script.js`, `assets/`).

The Cloudflare Worker is deployed separately with `npx wrangler deploy`; pushing the website does not update its API. For guestbook database setup and live moderation, follow [the guestbook guide](./docs/guestbook.md). For chat, contact, and the shared poke counter, see [API setup](./docs/assistant.md).

## Contact

- Email: charleskenneth129@gmail.com
- LinkedIn: https://www.linkedin.com/in/kennethcharlesvaldez
- GitHub: https://github.com/chimkenchrls

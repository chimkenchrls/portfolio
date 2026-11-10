# Portfolio

[![Check & Deploy](https://github.com/chimkenchrls/portfolio/actions/workflows/deploy.yml/badge.svg)](https://github.com/chimkenchrls/portfolio/actions/workflows/deploy.yml)

Personal portfolio of Kenneth Charles Valdez, a BS Computer Science student and aspiring DevOps engineer.

Live site: https://kenchrls.vercel.app

GitHub Pages mirror: https://chimkenchrls.github.io/portfolio/

## Overview

A static site written in plain HTML, CSS, and vanilla JavaScript. It has no framework or runtime dependencies. Deployment stages the runtime files and versions the CSS/JS URLs. Vercel deploys from the connected GitHub repository; GitHub Actions tests every push to `main` and publishes a GitHub Pages mirror.

## Features

- A "poster in a frame" layout: the page sits in a rounded frame whose notch holds the page links and pixel CK, who opens a menu with everything else; Home opens on a studio poster and its sections slide up as ink and paper panels
- Dark theme by default, with a saved light/dark toggle
- Project showcase with desktop and mobile screenshots
- Live GitHub contribution calendar
- Pixel CK in the notch, with a Gemini portfolio chat (optional private Node server)
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
the notch, the footer and their state mounted. Back/Forward restore the visited page
and its scroll position. Direct URLs and page refreshes still work as ordinary static
pages. Clicking Home replays the poster intro (about two seconds; a click or key skips it).

```bash
node server.js
```

Then open http://localhost:8787. Use Node 22.13+; the guestbook uses Node's built-in SQLite and needs no API key. See [guestbook setup and moderation](./docs/guestbook.md).

For a static-only preview, `python3 -m http.server 8000` still serves the site at http://localhost:8000, but it cannot load or save local guestbook notes.

For live AI chat, copy `.env.example` to `.env`, add `GEMINI_API_KEY`, and run `node --env-file=.env server.js`. Open http://localhost:8787. The API key stays on the server. See [assistant setup and hosting](./docs/assistant.md).

## The poster

Home opens on a poster: the portrait lit from behind, "Kenneth Charles Valdez" on one
line in Instrument Serif italic. In black and white the name flips its own colour where
it crosses the portrait (`mix-blend-mode: difference`); while the photo shows colour
(hover on desktop, a tap on touch screens) a copy masked to his silhouette keeps it grey.
The cutouts are `assets/hero-cutout.webp` (desktop) and `assets/hero-mobile.webp`
(phones), made from the transparent PNGs with
`magick in.png -channel A -fx "a<0.12?0:a" +channel -trim +repage -resize x900 -quality 82 -define webp:alpha-quality=90 -define webp:method=6 out.webp`
(`x780` for the desktop one).

## The scroll story

The rounded frame is fixed to the window; the page scrolls under it. In the notch,
CK is the Home link, with Projects · Stack on his left and Resources · More on his
right (they slide out on hover or keyboard focus). On phones and touch screens CK
opens a full-screen menu instead: the five pages, Get in touch, Chat with CK, and the
email with a copy button.

After the poster, About is a statement: `profile.bio` in large type, lighting up word
by word as it scrolls up, three buttons (Chat with CK, View résumé, Explore all
projects) and two facts derived from `data.js` (the degree with `education[].short` and
`year`, and the project count). Projects and Stack share one panel that slides up over
About while About shrinks to 86% and sinks into the frame colour. Projects shows the
three projects named in `featured`, with View all projects under them; pixel CK pops
up on the panel's edge and opens the chat. Stack rows draw their lines in, and the
certifications deal out from a stack as they arrive.

A big footer on every page holds what CK's menu used to: CK to poke with the shared
count, the email with a copy button, GitHub · LinkedIn · Résumé, Chat with me, Play
chimken, the theme toggle, every page (Links and Guestbook included), and the time in
the Philippines. When it fits the window the page slides up off it. Nothing moves
under reduced motion.

## Updating content

All content lives in [`assets/data.js`](./assets/data.js). Use `null` for anything that is not ready yet; the page shows a "coming soon" state in its place.

Common edits in that file:

| Change | Where to edit |
| --- | --- |
| Add a tool to Stack | `stack[].items`; put its SVG in `assets/icons/stack/` and use the filename without `.svg` as `icon` |
| Show a project beside a tool on Stack | Add the matching tool name to that project's `tags`; project links are derived automatically |
| Update the short Home project description | The project's `summary` and `kind` |
| Choose the three projects on Home | `featured`: project names in lower case with dashes, e.g. `"pakisuyo-express"` |
| Change About's degree fact | `education[].short` (e.g. `"BSCS"`) and `year` (e.g. `4`); `null` hides it |
| Add a resource | `resources[].items`: `name`, `note`, `href` (or `null`), and an `icon` from `assets/icons/stack/` (or `null` for none) |
| Update the resume | Keep `resumePage` and `assets/resume.pdf` in step |

Visitor notes are stored in the database, not in `data.js`. See the [review and moderation commands](./docs/guestbook.md) to approve or remove them.

The public resume page and downloadable PDF omit phone numbers. When replacing `assets/resume.pdf`, remove private contact details and embedded document metadata before publishing; keep a separate private copy for direct applications.

Home's featured cards use each project's optional `summary` and `kind` for their short description and type label, falling back to the full description and first tag. Full project cards and case studies keep their detailed descriptions.

**Links** (`./?view=links`) is in the footer. `linksPage` defines the heading and the Social/Work groups; each row reads its destination from `profile`. Set `profile.discordUrl`, `profile.tiktok` and `profile.facebook` to HTTPS profile URLs (or `null`). Discord copies `profile.discord` while its URL is missing. LinkedIn, GitHub, email and resume reuse the existing profile fields; missing destinations show a non-clickable "Coming soon" row.

The **More about me** page (`./?view=more`) opens with `more.title`, the centered Outside the IDE photo deck, the profile name and role, and `more.intro`. Full-width Experience and Education rows reuse the same content as Home, followed by the terminal.

**Resources** (`./?view=resources`) is in the notch and the footer, with its title and introduction in `resourcesPage`. `resources` lists the groups (Tools, Skills, Plugins, and Behind the portfolio), laid out like the Links page. Each item has a `name`, a short `note`, an `href` (opens in a new tab; `null` shows it without a link), and an `icon` from `assets/icons/stack/` with an optional brand `color`. Items without an icon show just the name and note.

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

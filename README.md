# Portfolio

[![Check & Deploy](https://github.com/chimkenchrls/portfolio/actions/workflows/deploy.yml/badge.svg)](https://github.com/chimkenchrls/portfolio/actions/workflows/deploy.yml)

Personal portfolio of Kenneth Charles Valdez, a BS Computer Science student and aspiring DevOps engineer.

Live site: https://chimkenchrls.github.io/portfolio/

## Overview

A static site written in plain HTML, CSS, and vanilla JavaScript. It has no framework, no build step, and no runtime dependencies. Every push to `main` is tested and deployed to GitHub Pages by GitHub Actions.

## Features

- Responsive layout: sidebar on desktop, icon rail on tablet, drawer on mobile
- Light and dark themes that follow the system setting
- Project showcase with desktop and mobile screenshots
- Live GitHub contribution calendar
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
.github/          CI/CD workflow
```

## Running locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Updating content

All content lives in [`assets/data.js`](./assets/data.js). Use `null` for anything that is not ready yet; the page shows a "coming soon" state in its place.

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

Pushes to `main` that pass every check are deployed to GitHub Pages. Only the runtime files (`index.html`, `style.css`, `script.js`, `assets/`) are published.

## Contact

- Email: charleskenneth129@gmail.com
- LinkedIn: https://www.linkedin.com/in/kennethcharlesvaldez
- GitHub: https://github.com/chimkenchrls

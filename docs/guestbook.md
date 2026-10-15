# Now, Guestbook, and project demos

`assets/data.js` holds the editable content. `now` appears only on More about me;
each item is a label and a short update. Use the date you actually edited it.
The initial update describes this portfolio work, without assuming other current
activities. Add learning or personal updates when you have something to share.

The Guestbook is at `./?view=guestbook`. Visitors enter a name or nickname and a
note, without an account or email address. Notes are plain text and stay pending
until the owner approves them. Only approved notes are returned by the public API.
The API limits input size, request bursts, and daily submissions, and ignores a
filled bot-trap field. A submission token prevents a retry from creating a duplicate.

## Run locally

Run `node server.js` and open `http://localhost:8787/?view=guestbook`. No Gemini or
email key is needed for the guestbook. Node 22.5+ provides the built-in SQLite
module; Node 22 may print its experimental-module warning. Notes persist in
`.local/guestbook.sqlite`, which is ignored by Git and never publicly served.
The frontend uses its same-origin API on localhost. A plain Python static server
cannot accept guestbook notes; the page shows its retry state there.

Review and moderate the local notes:

```sh
node scripts/guestbook.js list --local
node scripts/guestbook.js approve 1 --local
node scripts/guestbook.js remove 1 --local
```

Use the actual numeric ID printed by `list`. Approval makes the note visible on
the next load. Removal deletes that one note. There is no public moderation API.

## Publish the API

The static Vercel and GitHub Pages builds do not deploy the Worker. With the
existing Cloudflare account authenticated, run the additive schema update, then
deploy the Worker before publishing the frontend:

```sh
npx wrangler d1 execute portfolio --remote --file=worker/schema.sql
npx wrangler deploy
```

The schema preserves existing poke/chat/contact counters. The existing D1 binding
and `ALLOWED_ORIGINS` are reused. `GUESTBOOK_DAILY_LIMIT` defaults to 50; each
visitor is limited to two submissions per minute on the Worker. In local Node
development, the existing process limiter allows eight per minute per address
and 50 overall per day. The frontend endpoint lives in `guestbook.endpoint` in
`assets/data.js`. Until the API is deployed, it shows a clear unavailable state.

Review live notes with the same owner CLI:

```sh
node scripts/guestbook.js list --remote
node scripts/guestbook.js approve 1 --remote
node scripts/guestbook.js remove 1 --remote
```

Remote commands use Wrangler's account authentication. They are not browser
actions, and no administrative credential is added to the site.

## Demo clips

A project's optional `demo` contains `src`, `poster`, `captions`, `title`, and
`summary`, all in `assets/data.js`. Media stays under `assets/projects/` and is
shown on that project's case-study page with native playback controls. Playback
does not start automatically; the player reads metadata initially so the duration
and native controls are ready before the visitor presses play.
Use `null` for projects without a recording.

The Ambiancy recording is a silent screen capture of the public player at
https://ambiancy.vercel.app/play, captured on 2026-10-15. The WebVTT captions and
summary explain the actual scene, volume, timer, sharing, and pause interactions.
The clip does not demonstrate audio output or a deployment pipeline. Private
projects need an accessible local environment or a recording from the owner.

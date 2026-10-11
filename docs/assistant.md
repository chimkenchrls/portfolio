# Portfolio assistant

The floating character opens a native dialog titled "Chat with me". Pixel CK stands at the lower left and speaks in the first person as Ken; his current answer is a speech bubble that types itself out (click it to skip), and earlier turns scroll up above it. He looks surprised when asked, thinks with his eyes down while a reply loads, grins when it lands, and raises an eyebrow at errors. On phones the chat is a sheet that rises from the bottom edge with a smaller CK beside the bubble. The hero retains its portrait and roaming chimken. Animation respects reduced motion.

## Run with Gemini locally

Use Node.js 22 or newer. No packages or build step are needed.

1. Copy `.env.example` to `.env` in the repository root.
2. Set `GEMINI_API_KEY` in `.env` to your own key. Leave it out of `assets/data.js` and all frontend files. `.env` is ignored by Git.
3. Run:

   ```bash
   node --env-file=.env server.js
   ```

4. Open http://localhost:8787. If port 8000 already has the Python preview running, use 8787 for the version with AI chat.

Without a key, the UI still opens and the server returns a clear unavailable state. It never substitutes scripted answers for Gemini. Messages stay in page memory and clear on reload; successful prior turns accompany follow-up questions. Closing the dialog cancels an outstanding request and leaves a retry action when reopened.

`GEMINI_MODEL` defaults to `gemini-3.5-flash-lite` and can be changed to a model available to your key. The integration uses Google's [generateContent REST API](https://ai.google.dev/api/generate-content), a server-only API-key header, and [environment-based key configuration](https://ai.google.dev/gemini-api/docs/api-key). See the [model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite).

## Content and grounding

Edit the launcher label, greeting, suggested questions, and public chat endpoint in `assets/data.js` → `assistant`. The server reads profile, experience, education, project descriptions, stack, and certification status from the same file. Restart the server after editing these facts. Project screenshots, chat replay transcripts, and endpoint configuration are excluded from the model's portfolio context.

The system instruction has CK speak as Ken himself in the first person (he says he is an AI only if a visitor sincerely asks), preserves in-progress statuses, asks for concise plain text, and directs missing information to Ken's email. The model has no tools, browsing, account access, or ability to send messages. Grounding instructions reduce fabrication; they do not guarantee perfect answers. Responses are rendered as text, never HTML.

## Deploy the API on Cloudflare Workers (free)

GitHub Pages keeps serving the site; a Cloudflare Worker serves the two things a static site cannot: the chat (`POST /api/chat`) and the shared poke counter (`GET` / `POST /api/pokes`). The Worker is `worker/index.mjs`. It imports `server/chat.js` and `assets/data.js`, so prompts, grounding and validation are the same code the Node server runs. Counters live in a D1 database.

One-time setup, from the repository root (Node.js 22+, a free Cloudflare account):

```bash
npx wrangler login                       # opens the browser once
npx wrangler d1 create portfolio         # prints a database_id
```

Paste that `database_id` into `wrangler.toml`, then:

```bash
npx wrangler d1 execute portfolio --remote --file worker/schema.sql
npx wrangler secret put GEMINI_API_KEY   # paste the key when asked; it is never written to a file
npx wrangler deploy                      # prints https://kenchrls-api.<your-subdomain>.workers.dev
```

Then point the site at it in `assets/data.js` and publish as usual:

- `assistant.endpoint`: `https://kenchrls-api.<your-subdomain>.workers.dev/api/chat`
- `pokes.endpoint`: `https://kenchrls-api.<your-subdomain>.workers.dev/api/pokes`

`ALLOWED_ORIGINS` in `wrangler.toml` lists the exact site origins that may call the API (no trailing slash). Add a custom domain there, comma-separated, and run `npx wrangler deploy` again. After editing facts in `assets/data.js`, redeploy the Worker too, since it bundles that file.

Limits: 8 chat requests per visitor per minute, `DAILY_CHAT_LIMIT` (default 100) Gemini requests per day across everyone, stored in D1 so it survives restarts; up to 20 pokes per request and 40 poke requests per visitor per minute. The page batches quick taps into one request. While `pokes.endpoint` is `null`, each visitor only sees their own count ("Your pokes"); once it is set the sidebar shows the shared total ("Pokes").

To try the Worker locally: `npx wrangler d1 execute portfolio --local --file worker/schema.sql`, then `npx wrangler dev`. Local runs read `GEMINI_API_KEY` from `.env` or `.dev.vars` (both ignored by Git).

## Hosting the Node server instead

The Node server (`server.js`) is an alternative to the Worker for the chat only; it has no poke counter.

## Hosting alongside GitHub Pages

GitHub Pages continues to publish only the static portfolio. The Node server must be hosted separately on a service that runs Node.js and provides HTTPS, or it can serve both the site and chat itself.

For a separately hosted backend:

- Set `HOST=0.0.0.0` and the host's `PORT` value on that server.
- Set `GEMINI_API_KEY` as a server secret and configure `GEMINI_MODEL` there.
- Set `ALLOWED_ORIGINS=https://chimkenchrls.github.io` (add your exact custom-domain origin if used). Origins contain no trailing slash or path.
- Set `assistant.endpoint` in `assets/data.js` to the backend's complete HTTPS `/api/chat` URL.
- Deploy the backend and publish the updated static files. The current GitHub Actions workflow does not deploy the backend or publish `.env` / `server/`.

The server limits request size, conversation length, response length, concurrent requests, eight requests per client address per minute, and twenty requests overall per minute. `DAILY_CHAT_LIMIT` defaults to 100 provider attempts per rolling 24-hour window. These counters are in memory, per process, and reset on restart. For public hosting, configure persistent rate limits and spending controls at the host/provider; do not treat these process counters or the Origin allowlist as authentication. Behind a reverse proxy, clients share its address because the server deliberately does not trust incoming forwarding headers.

Only `index.html`, `style.css`, `script.js`, and supported files inside `assets/` are served. Server code, dotfiles, environment files, and symlinks are not served. Error responses omit upstream diagnostics and secrets. Chat messages are not logged by this server; Google receives their contents to generate replies.

## Verification

```bash
node --test tests/*.test.js
```

`tests/worker.test.js` calls the Worker's real handler with a stand-in database: origins, bad requests, the daily budget, and the poke counter. `tests/assistant.test.js` exercises history truncation, endpoint validation, trusted context, provider failures, hidden reasoning filtering, rate limits, CORS, request bounds, and static-file isolation. Route tests invoke the real HTTP handler with streams without opening network sockets. They use mocked Gemini responses and never consume a real key.

For the browser suite on a machine with Docker, serve the site, then run:

```bash
python3 -m http.server 8000 &
tests/e2e/run.sh assistant
```

The browser suite intercepts chat requests, so it needs neither the Node server nor a real Gemini key. A real-key smoke test still requires local credentials and network access.

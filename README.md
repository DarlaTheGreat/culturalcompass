# Cultural Compass

AI coaching tool for new international hires. Designed and built by Daria Sur.

- `index.html` — the app (single file)
- `netlify/edge-functions/coach.js` — server-side proxy to the Claude API at `/api/coach`
- `netlify.toml` — tells Netlify there is no build step

Required environment variable in Netlify: `ANTHROPIC_API_KEY`
Optional: `ANTHROPIC_MODEL`

Check the connection by opening `/api/coach` on the live site. It should show `{"ready":true}`.

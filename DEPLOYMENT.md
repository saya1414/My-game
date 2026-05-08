# Deployment

This project has two deployable parts:

| Part | Tech | Hosted on | URL |
|---|---|---|---|
| Frontend (HTML/CSS/JS) | Static site | Cloudflare Pages | `https://<your-pages-project>.pages.dev` |
| Multiplayer server | Cloudflare Worker + Durable Object | Cloudflare Workers | `https://my-game-rooms.<your-subdomain>.workers.dev` |

## Repository

- GitHub: https://github.com/saya1414/My-game
- Default branch: `main`

---

## Frontend — Cloudflare Pages (auto-deploy from GitHub)

Set up **once** via the Cloudflare dashboard:

1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Authorize Cloudflare's GitHub App and grant access to `saya1414/My-game`
3. Pick the repo → **Begin setup**
4. Build settings:
   - Project name: `my-game` (becomes the subdomain)
   - Production branch: `main`
   - Framework preset: **None**
   - Build command: *(empty)*
   - Build output directory: *(empty)*
5. **Save and Deploy**

After that, every `git push` to `main` auto-redeploys in ~30 seconds.

```sh
git add .
git commit -m "your changes"
git push
```

### Common issues
- **403 on first deploy**: Cloudflare's GitHub App doesn't have access to the repo. Go to https://github.com/settings/installations → **Cloudflare Pages** → **Configure** → grant access to `saya1414/My-game`.

---

## Multiplayer Worker — Cloudflare Workers (manual deploy)

Lives in [worker/](worker/). Single Worker with one `GameRoom` Durable Object class (SQLite-backed, free-tier compatible).

### One-time setup

```sh
cd worker
npm install
```

### Authenticate

OAuth (`npx wrangler login`) is the official way but has been flaky in practice (port 8976 callback issues, browser state mismatch). The reliable alternative is an **API token**:

1. https://dash.cloudflare.com/profile/api-tokens → **Create Token**
2. Use template **"Edit Cloudflare Workers"** → **Continue to summary** → **Create Token**
3. Copy the token (shown only once)
4. Export it in your shell:
   ```sh
   export CLOUDFLARE_API_TOKEN="cfut_..."
   ```
   (Add it to `~/.zshrc` if you want it persistent. Never commit it.)

### Deploy

```sh
cd worker
npx wrangler deploy
```

First deploy prints the URL, e.g. `https://my-game-rooms.<your-subdomain>.workers.dev`.

If the deploy fails with `Asset too large` referencing `node_modules/workerd/bin/workerd`, wrangler is auto-detecting the parent project as static assets. The `worker/wrangler.toml` already pins `[assets].directory = "./public"` (an empty folder) to prevent this. If it still happens, force it on the CLI:

```sh
npx wrangler deploy --assets ./public --name my-game-rooms
```

### Wire the Worker URL into the frontend

Edit `MP_WORKER_URL` near the top of [script.js](script.js):

```js
const MP_WORKER_URL = "https://my-game-rooms.<your-subdomain>.workers.dev";
```

Then commit & push — Cloudflare Pages redeploys the frontend automatically.

### Local dev for the Worker

```sh
cd worker
npx wrangler dev          # runs on http://localhost:8787
```

While testing locally, set `MP_WORKER_URL = "http://localhost:8787"` in `script.js`.

---

## How it works at runtime

- A player clicks **Create Room** → frontend opens a WebSocket to `wss://<worker>/room/<CODE>`.
- Cloudflare routes that to a `GameRoom` Durable Object instance keyed by the room code (one per room, globally consistent).
- The DO holds the authoritative game state in memory: players, host, current cards, turn, round.
- The first player in a room is the **host**. Only the host can start the game, draw cards, advance the player, or reset.
- If the host disconnects, the next player in the room is auto-promoted.
- Every state change is broadcast to all sockets in the room as a single JSON `state` message; clients re-render from that.

## Free-tier limits

Both services are on Cloudflare's free plans:

| Resource | Limit |
|---|---|
| Pages bandwidth | Unlimited |
| Pages builds | 500/month |
| Workers requests | 100,000/day |
| Durable Object requests | 1,000,000/month |
| Durable Object storage (SQLite) | 5 GB |

A turn-based card game with friends will not come close to any of these.

---

## Cleanup / rotation

To list deployed Workers:

```sh
npx wrangler deployments list
```

To delete a Worker (e.g. an accidental one):

```sh
npx wrangler delete --name <worker-name>
```

To rotate the API token: delete it at https://dash.cloudflare.com/profile/api-tokens and create a new one.

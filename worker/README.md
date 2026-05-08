# My Game multiplayer worker

Cloudflare Worker + Durable Object that powers room-based multiplayer for the
party game.

## One-time setup

```sh
cd worker
npm install
npx wrangler login    # opens browser, log in to your Cloudflare account
```

## Deploy

```sh
npx wrangler deploy
```

The first deploy will print your worker URL, e.g.:

```
https://my-game-rooms.YOUR-SUBDOMAIN.workers.dev
```

Copy that URL, then in `../script.js` set:

```js
const MP_WORKER_URL = "https://my-game-rooms.YOUR-SUBDOMAIN.workers.dev";
```

Commit and push — Cloudflare Pages will redeploy the frontend automatically.

## Local development

```sh
npx wrangler dev
```

Then point `MP_WORKER_URL` at `http://localhost:8787` while testing.

## Free tier

This uses SQLite-backed Durable Objects, which are included in the
**Cloudflare Workers free plan** (100k requests/day, 1M Durable Object
requests/month). Plenty for a card game with friends.

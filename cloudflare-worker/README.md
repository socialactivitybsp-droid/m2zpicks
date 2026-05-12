# M2ZPicks Cloudflare Worker + KV Cache Bridge

## What this does
Appwrite (source of truth) -> Cloudflare Scheduled Worker -> KV cache -> Netlify frontend reads Worker endpoints.

## Endpoints
- `GET /tools` -> full cached tools payload
- `GET /categories` -> category counts
- `GET /stats` -> summary stats
- `GET /latest` -> latest 50 tools
- `GET /health` -> cache health/meta
- `POST /refresh` -> manual refresh (requires `x-refresh-token`)

## Setup
1. Create KV namespace and place IDs in `wrangler.toml`.
2. Set secrets:
   - `wrangler secret put APPWRITE_API_KEY`
   - `wrangler secret put REFRESH_TOKEN`
3. Deploy:
   - `wrangler deploy`

## Cron
Configured in `wrangler.toml`:
- `0 0 */3 * *` (every 3 days at 00:00 UTC)

## Frontend integration
Point frontend fetches to Worker base URL:
- `/tools`
- `/categories`
- `/stats`
- `/latest`

Keep Appwrite private for admin-only writes.

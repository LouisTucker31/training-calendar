# Training Calendar

A personal training-event calendar PWA, deployed as a static site on GitHub Pages, with event/workout data and logged-workout state stored in Supabase.

## Security headers not set on this deployment

GitHub Pages serves every file over HTTPS with HSTS automatically, but it's a static host with no server configuration available, so it cannot set custom HTTP response headers. Content-Security-Policy is set via a `<meta http-equiv>` tag in `index.html` instead (see the comment there for the exact policy and why `style-src` includes `'unsafe-inline'`).

The following headers cannot be set at all on GitHub Pages, since no `<meta>` tag equivalent exists for them:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

`frame-ancestors` also has no effect when CSP is set via `<meta>` rather than a real response header, so this site is not currently protected against being embedded in a hostile iframe.

If this app ever moves to a host that supports custom response headers (Cloudflare Pages, Netlify, Vercel, or a reverse proxy in front of GitHub Pages), configure the three headers above plus `frame-ancestors 'none'` in that host's header configuration.

## Data model

- `data.js` holds `PALETTE` (theme colours) - the only data still hardcoded client-side.
- `EVENTS`, `TRAINING_BLOCKS_RAW` and `WORKOUTS` are fetched from Supabase at startup (`supabase.js`) - see `supabase-schema.sql` for the table definitions.
- Logged-workout state (`training_logged_workouts`) is also stored in Supabase, so it syncs across devices.
- The Supabase anon key in `supabase.js` is intentionally public (Supabase's anon key is designed to ship client-side); the actual access boundary is the Row Level Security policies in `supabase-schema.sql`, not the key's secrecy.

# PesoPicks

A PrizePicks-style pick'em for a friends trip. The commissioner posts lines on friends ("Byron says 'that's awesome' 2.5"), everyone picks **More / Less** on 2–6 of them as a Power or Flex lineup, and lineups settle automatically when the commissioner grades the props. Fake pesos only.

## Run locally

```bash
npm install
npm run dev
```

With no Supabase env vars the app runs in **local demo mode** (data saved in the browser only). `.env.production` points builds at the shared Supabase project.

## How it works

- `src/lib/engine.js`: payout tables (Power 3/5/10/20/37.5X, Flex tiers), lineup rules, settlement (voids/pushes revert to a smaller lineup, Goblin 0.8X / Demon 1.5X per pick). Tests: `node src/lib/engine.test.js`
- `src/lib/backend/`: `local.js` (localStorage) and `supabase.js` share one API.
- `supabase/migrations/`: tables plus `pp_*` SECURITY DEFINER functions. Reads are public; every write checks a session token (name + 4-digit PIN, 8 wrong tries locks for 15 min). Balances only change server-side.
- The **first person to sign up becomes the Commissioner**. Everyone else needs the trip code (default `MEXICO`, change it in Commissioner → Settings).

## Deploy

```bash
npm run deploy
```

Builds and pushes `dist/` to the `gh-pages` branch, which GitHub Pages serves at https://eli-riedel.github.io/pesopicks/

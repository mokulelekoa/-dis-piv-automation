# HR Command Center — standalone deployment

This is the `/hr` toolkit packaged as its own deployable Next app, so it can go
live without the CMOP candidate-packet routes (and therefore without Supabase or
OpenAI credentials). Everything here is client-side; sample data lives in the
browser's localStorage.

## Deploying on Vercel

Import `mokulelekoa/-dis-piv-automation` at <https://vercel.com/new>, then in
**Settings → General** set:

| Setting | Value |
| --- | --- |
| Root Directory | `apps/hr-demo` |
| Framework Preset | Next.js (auto-detected) |

In **Settings → Git**, set the Production Branch to whichever branch carries the
work (e.g. `claude/hr-automation-app-design-wzhj9t`, or `master` after merging).
Pushes to that branch then deploy automatically, the same way `menehune-health`
works.

### Environment variables

None are required. One is optional:

| Variable | Effect |
| --- | --- |
| `NEXT_PUBLIC_PACKETS_URL` | Where the "Candidate Packets" links point. Set it to the deployed CMOP app (e.g. `https://dis-cmop-piv-automation.vercel.app/admin`). Unset, the links fall back to `/admin`, which does not exist in this deployment. |

`NEXT_PUBLIC_*` values are inlined at build time — changing one requires a fresh
deploy to take effect.

## Keeping this copy current

`app/hr/`, `lib/hr/`, `app/globals.css`, and `public/dis-logo.png` are **copies**
of the files at the repository root. Edit the originals, then run from the repo
root:

```bash
node scripts/sync-hr-demo.mjs          # refresh this folder
node scripts/sync-hr-demo.mjs --check  # verify it hasn't drifted (exits 1 if it has)
```

Only the files unique to this deployment — `app/layout.tsx`, `app/page.tsx`, and
the config files — are maintained here directly.

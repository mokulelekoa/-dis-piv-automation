import type { NextConfig } from 'next'

/**
 * Pin Turbopack's root to this app.
 *
 * This app is a subdirectory of a repo whose root is itself a Next app, and
 * that root contains `proxy.ts` (the CMOP Supabase middleware). Next infers its
 * root by walking up for a lockfile, and on Vercel — where the deployment sets
 * Root Directory to apps/hr-demo and injects its own config — that inference
 * landed on the repo root. Next then compiled the repo's `proxy.ts` into this
 * build, which fails because only this app's dependencies are installed:
 *
 *   ./proxy.ts:1:1  Module not found: Can't resolve '@supabase/ssr'
 *
 * Turbopack does not resolve files outside its root, so pinning it here keeps
 * the repo-root app out of this build entirely. It also silences the "Detected
 * additional lockfiles" warning that was the early symptom of the same thing.
 *
 * Use process.cwd() rather than a path derived from this file: the build always
 * runs with this directory as its working directory (Vercel's Root Directory,
 * or `npm run build` from here), whereas `import.meta.dirname` resolved to the
 * repo root on Vercel and broke the build a different way.
 *
 * Do NOT set `outputFileTracingRoot` from a file-relative path — that was the
 * previous failure: ENOENT lstat '/vercel/path0/.next/package.json'.
 */
const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
}

export default nextConfig

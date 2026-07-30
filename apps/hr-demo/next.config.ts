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
 * Both roots must be set, and to the SAME value. Setting only turbopack.root
 * is not enough — Next infers outputFileTracingRoot as the repo root, notices
 * the two disagree, and resolves it in favour of outputFileTracingRoot:
 *
 *   ⚠ Both `outputFileTracingRoot` and `turbopack.root` are set, but they must
 *     have the same value. Using `outputFileTracingRoot` value: /vercel/path0.
 *
 * which put the root straight back at the repo and recompiled proxy.ts.
 *
 * Earlier, setting outputFileTracingRoot alone ALSO failed (ENOENT lstat
 * '/vercel/path0/.next/package.json') because it was derived from this file's
 * location, which resolves to the repo root on Vercel. process.cwd() is the
 * value that is correct in both places.
 */
const appRoot = process.cwd()

const nextConfig: NextConfig = {
  turbopack: {
    root: appRoot,
  },
  outputFileTracingRoot: appRoot,
}

export default nextConfig

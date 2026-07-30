import type { NextConfig } from 'next'

/**
 * Intentionally empty.
 *
 * Do NOT set `outputFileTracingRoot` here. Because this app has its own
 * lockfile inside the main repo, Next logs a "Detected additional lockfiles"
 * warning during the build — that warning is cosmetic and pinning the tracing
 * root to silence it broke the Vercel build with:
 *
 *   ENOENT: no such file or directory, lstat '/vercel/path0/.next/package.json'
 *
 * On Vercel the repo is cloned to /vercel/path0 and the build runs in this
 * subdirectory, so a tracing root computed from the config file's own location
 * resolved back to the repo root and Next looked for build output that lives
 * here instead. Leave tracing alone and let Next work it out.
 */
const nextConfig: NextConfig = {}

export default nextConfig

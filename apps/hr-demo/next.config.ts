import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /**
   * This app has its own lockfile while living inside the main repo, which
   * otherwise makes Next guess which one marks the workspace root. Pin it here
   * so file tracing stays scoped to this folder.
   */
  outputFileTracingRoot: path.join(import.meta.dirname, '.'),
}

export default nextConfig

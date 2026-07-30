/**
 * Where the "Candidate Packets" cross-links point.
 *
 * In this repo the PIV paperwork app ships alongside the HR tools, so the
 * default is the internal /admin route. The standalone HR deployment
 * (apps/hr-demo) has no /admin of its own and sets NEXT_PUBLIC_PACKETS_URL to
 * the deployed CMOP app instead.
 *
 * NEXT_PUBLIC_* is inlined at build time — changing it in Vercel requires a
 * fresh deploy to take effect.
 */
export const PACKETS_HREF = process.env.NEXT_PUBLIC_PACKETS_URL || '/admin'

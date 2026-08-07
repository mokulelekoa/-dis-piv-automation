#!/usr/bin/env node
/**
 * Pull photographs from the By Confluence website into public/photos/.
 *
 * Run this on a machine with open network access (the Claude Code cloud
 * environment's egress proxy blocks byconfluence.com unless the environment's
 * network policy allows it):
 *
 *   node tools/fetch-photos.mjs                  # scrape https://www.byconfluence.com
 *   node tools/fetch-photos.mjs https://www.byconfluence.com/work
 *
 * What it does:
 *   1. Fetches the page (and same-site pages linked from its nav, one level deep).
 *   2. Collects every candidate image URL — <img src>, the widest srcset entry,
 *      CSS background-image urls, and og:image. Squarespace-hosted images are
 *      re-requested at ?format=2500w for full resolution.
 *   3. Downloads them, discards tiny files (< 40 kB — icons and logos), sorts the
 *      rest by size, and writes the six largest as work-01.jpg … work-06.jpg,
 *      with any remainder as extra-01.jpg ….
 *   4. Writes attribution.json recording the source URL and fetch date of every
 *      file, because these are the studio's photographs, not project assets.
 *
 * The site maps work-01 … work-06 onto the six reel frames in order. Re-order or
 * rename the files afterwards to choose which photo belongs to which project.
 *
 * Requires Node 18+ (global fetch). No dependencies.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const START = process.argv[2] || 'https://www.byconfluence.com/'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'photos')

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

const fetchText = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.text()
}

/**
 * Widest candidate from a srcset attribute value. Matches "url descriptor"
 * pairs instead of splitting on commas — URLs may themselves contain commas.
 */
const widestFromSrcset = (srcset) => {
  let best = null
  let bestW = -1
  for (const m of srcset.matchAll(/(\S+)\s+(\d+(?:\.\d+)?)[wx]/g)) {
    const w = parseFloat(m[2])
    if (w > bestW) {
      bestW = w
      best = m[1]
    }
  }
  // No width/density descriptors at all → first whitespace-delimited token.
  return best ?? srcset.trim().split(/\s+/)[0] ?? null
}

const collectImageUrls = (html, baseUrl) => {
  const urls = new Set()
  const add = (u) => {
    if (!u) return
    try {
      const abs = new URL(u, baseUrl)
      if (!/^https?:$/.test(abs.protocol)) return
      if (/\.(svg|gif|ico)(\?|$)/i.test(abs.pathname)) return
      // Squarespace CDN: normalise to one full-resolution variant per asset.
      if (abs.hostname.includes('squarespace')) abs.search = '?format=2500w'
      urls.add(abs.href)
    } catch {
      /* malformed URL in markup — skip */
    }
  }

  for (const m of html.matchAll(/<img[^>]+>/gi)) {
    const tag = m[0]
    // data-srcset first, explicitly: lazy-loaders put a tiny placeholder in
    // srcset and the real candidates in data-srcset, in either order.
    const srcset =
      tag.match(/data-srcset\s*=\s*["']([^"']+)["']/i)?.[1] ??
      tag.match(/\ssrcset\s*=\s*["']([^"']+)["']/i)?.[1]
    if (srcset) add(widestFromSrcset(srcset))
    add(tag.match(/data-src\s*=\s*["']([^"']+)["']/i)?.[1])
    add(tag.match(/\ssrc\s*=\s*["']([^"']+)["']/i)?.[1])
  }
  for (const m of html.matchAll(/background(?:-image)?\s*:[^;"']*url\(\s*["']?([^"')]+)["']?\s*\)/gi))
    add(m[1])
  // og:image, tolerating either attribute order.
  for (const m of html.matchAll(/<meta[^>]+>/gi)) {
    const tag = m[0]
    if (/property\s*=\s*["']og:image["']/i.test(tag))
      add(tag.match(/content\s*=\s*["']([^"']+)["']/i)?.[1])
  }
  // Squarespace galleries often carry the asset only in data-image.
  for (const m of html.matchAll(/data-image\s*=\s*["']([^"']+)["']/gi)) add(m[1])
  return urls
}

const sameSiteNavLinks = (html, baseUrl) => {
  const origin = new URL(baseUrl).origin
  const links = new Set()
  for (const m of html.matchAll(/<a[^>]+href\s*=\s*["']([^"']+)["']/gi)) {
    try {
      const abs = new URL(m[1], baseUrl)
      abs.hash = '' // strip the fragment; don't discard the whole link over it
      if (abs.href === new URL(baseUrl).href) continue
      if (abs.origin === origin && !/\.(pdf|jpg|png|zip)$/i.test(abs.pathname))
        links.add(abs.href.replace(/\/$/, ''))
    } catch {
      /* skip */
    }
  }
  return [...links].slice(0, 12)
}

const main = async () => {
  fs.mkdirSync(OUT, { recursive: true })
  console.log(`scraping ${START}`)
  const first = await fetchText(START)
  const pages = new Set([START.replace(/\/$/, ''), ...sameSiteNavLinks(first, START)])
  const images = collectImageUrls(first, START)

  for (const page of pages) {
    if (page.replace(/\/$/, '') === START.replace(/\/$/, '')) continue
    try {
      const html = await fetchText(page)
      for (const u of collectImageUrls(html, page)) images.add(u)
      console.log(`  + ${page}`)
    } catch (e) {
      console.log(`  ! ${page}: ${e.message}`)
    }
  }
  console.log(`${images.size} candidate images`)

  const downloads = []
  for (const url of images) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } })
      if (!res.ok) continue
      const type = res.headers.get('content-type') || ''
      if (!type.startsWith('image/')) continue
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 40_000) continue // icons, logos, favicons
      downloads.push({ url, buf, type })
      console.log(`  ✓ ${(buf.length / 1024).toFixed(0)} kB  ${url.slice(0, 100)}`)
    } catch (e) {
      console.log(`  ✗ ${url.slice(0, 80)}: ${e.message}`)
    }
  }

  downloads.sort((a, b) => b.buf.length - a.buf.length)

  // Clear previous runs first: a shorter run must not leave stale work-*/extra-*
  // files behind that attribution.json no longer describes.
  for (const f of fs.readdirSync(OUT))
    if (/^(work|extra)-\d+\.(jpe?g|png|webp)$/i.test(f) || f === 'attribution.json')
      fs.unlinkSync(path.join(OUT, f))

  // Always name outputs .jpg regardless of the served content type: the site
  // requests photos/work-0N.jpg verbatim, and browsers sniff the real format
  // from the bytes, so a PNG or WebP behind a .jpg name decodes fine. The true
  // type is recorded in attribution.json.
  const manifest = []
  downloads.forEach((d, i) => {
    const name =
      i < 6 ? `work-${String(i + 1).padStart(2, '0')}.jpg` : `extra-${String(i - 5).padStart(2, '0')}.jpg`
    fs.writeFileSync(path.join(OUT, name), d.buf)
    manifest.push({ file: name, source: d.url, contentType: d.type, bytes: d.buf.length })
  })

  fs.writeFileSync(
    path.join(OUT, 'attribution.json'),
    JSON.stringify(
      {
        note: 'Photographs © By Confluence. Pulled from the studio’s public website for use inside this redesign concept only — do not redistribute.',
        fetched: new Date().toISOString(),
        from: START,
        files: manifest,
      },
      null,
      2,
    ),
  )
  console.log(`\nwrote ${manifest.length} images + attribution.json to ${OUT}`)
  if (manifest.length === 0)
    console.log('No images survived the filters — check the URL, or lower the 40 kB threshold.')
  console.log('The reel maps work-01…06 to its six frames in order; rename to re-assign.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

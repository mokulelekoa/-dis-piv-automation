# By Confluence — 3D redesign concept

A speculative, WebGL-first redesign for **By Confluence**, a Hawai‘i-based cinematography and
visual storytelling studio that shoots underwater, on land and from the air for culture, science,
education and mission-driven organizations.

> **This is a concept, not the studio's site.** It is not affiliated with or endorsed by By
> Confluence. The studio's positioning is accurate; every project name, client, credit and contact
> detail in `src/data/site.ts` is placeholder copy written to exercise the layout. A "Concept" badge
> is visible in the masthead at every scroll position so the page cannot be mistaken for the real
> thing. Replace the copy — and the procedural plates — before this goes anywhere near production.

---

## The idea

The studio's name means *the place two currents meet*, and their signature work is underwater. So
the page is a single continuous dive: one WebGL canvas behind the whole document, and scrolling is
descent. You enter a few metres under the surface with Snell's window overhead, and by the contact
section you are at 186 m in the blue-black, surrounded by bioluminescence.

Everything follows from that one decision:

| Element | What it does |
|---|---|
| **Surface** | The underside of the ocean with a real **Snell's window** — above water compressed into a ~97° cone overhead, total internal reflection outside it. That wobbling bright disc is the thing that says "underwater" more than any amount of blue. |
| **Depth grade** | Fog colour and density follow how water actually filters light — red gone by ~5 m, yellow by ~30 m, blue-black past 60 m. The background, the fog and every material read the same colour object, so they can't disagree. |
| **Light shafts** | One additively-blended cone, with the shaft pattern sampled *around* its circumference so it is seamless and holds together as a volume rather than a stack of cards. |
| **Marine snow** | A few thousand points wrapped into a slab that re-centres on the camera in the vertex shader — constant density over a 186 m descent at fixed cost, no per-frame uploads. |
| **The reel** | Six frames orbiting the diver, anchored to their DOM stage box (not the viewport), snapping to detents so the centred frame always matches the caption. |
| **Depth gauge** | The scroll indicator is a depth gauge reading in metres, because on this page that is what scroll *is*. |
| **Camera** | Not a dolly — a diver. Depth from scroll, plus pitch from "looking up at the light" to "looking into the dark", pointer parallax, forward surge on fast scroll, and two incommensurate frequencies per axis of handheld drift so it never visibly loops. |

## Stack

- **React 19** + **Vite 8**
- **three.js** with **@react-three/fiber** 9, **drei**, **@react-three/postprocessing**
  (ACES tone mapping, bloom, chromatic aberration, grain, vignette)
- **GSAP** for DOM reveals, **Lenis** for smooth scroll, **Zustand** for the little discrete state there is
- Hand-written GLSL for every surface — no textures, no models, no external assets

## Running it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # typecheck + production bundle into dist/
npm run preview
```

## How it is put together

```
src/
  data/site.ts            all copy, in one file  ← replace this
  lib/
    depth.ts              dive → colour/density/metres; the shared easing helpers
    sections.ts           per-section scroll progress + the reel's DOM stage anchor
    store.ts              per-frame scroll/pointer state (outside React) + UI state (Zustand)
    useSmoothScroll.ts    Lenis; the single source of truth for scroll progress
    useReveal.ts          IntersectionObserver + GSAP reveals
    env.ts                WebGL / reduced-motion detection and quality tiers
  three/
    Scene.tsx             the one Canvas, quality tiers, postprocessing stack
    Rig.tsx               the diver camera
    Atmosphere.tsx        fog + backdrop grading
    Surface.tsx           ocean underside
    Rays.tsx              light shafts
    Particles.tsx         marine snow + bubbles
    Gallery.tsx           the work reel
    useShaderMaterial.ts  see the note below
    shaders/*.ts          the GLSL
  components/
    Chrome.tsx            nav, depth gauge, loader
    Sections.tsx          all DOM sections
```

### One gotcha worth knowing about

Passing `uniforms={obj}` to R3F's `<shaderMaterial>` does **not** hand the material your object —
it goes through the constructor, which clones it. Mutating the object you memoised then updates
nothing, and every animated uniform silently freezes at its initial value with no error anywhere.
`useShaderMaterial` builds the material directly and attaches it with `<primitive>`, so
`material.uniforms` is the object being written to and there is only one of it.

## Performance and accessibility

- **Quality tiers** (`env.ts`) pick particle counts, DPR ceiling and whether the postprocessing
  stack runs at all, from pointer type, viewport, core count and device memory. Coarse pointers and
  narrow viewports drop to the low tier.
- **`prefers-reduced-motion`** disables smooth scroll, all reveal animation, and the camera's
  handheld drift — the dive still happens, it just tracks scroll directly.
- **No WebGL** falls back to a static gradient of the same water. The page is fully readable.
- The render loop **stops when the tab is hidden**.
- The canvas is `aria-hidden` and `pointer-events: none`: it is scenery. Every control is a real
  DOM element — the reel is drag/arrow-key/tab operable, its caption is an `aria-live` region, and
  the full list of work is present as text for anyone not seeing the canvas.
- Skip link, visible focus rings, semantic landmarks, and no horizontal overflow at 390 px.

## Known gaps

- The frames are **procedural stand-ins**, not the studio's footage. `footage()` in
  `shaders/frame.ts` is a drop-in swap for a `sampler2D` — the grade, refraction, grain, vignette
  and fog around it all still apply.
- Inactive frames are desaturated and dimmed rather than depth-of-field blurred. Cheaper, steadier,
  and it reads the same at gallery distance — but it is not a real DOF pass.
- `postprocessing` is a heavy chunk (~200 kB gzip). Worth lazy-loading behind the first paint if
  this ever became real.
- No CMS, no routing, no per-project pages. It is one page.

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  Color,
  DataTexture,
  Group,
  LinearFilter,
  Mesh,
  PerspectiveCamera,
  RGBAFormat,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
} from 'three'
import { frameFragment, frameVertex } from './shaders/frame'
import { useShaderMaterial } from './useShaderMaterial'
import { work } from '../data/site'
import { galleryState, sectionProgress, stageAnchor } from '../lib/sections'
import { useUI } from '../lib/store'
import { damp, fogDensityAt } from '../lib/depth'

const RADIUS = 7.4
const TAU = Math.PI * 2
const STEP = TAU / work.length

/** The plate's aspect (5.5 / 2.3) — cover-fit crops photos into this shape. */
const PLATE_ASPECT = 5.5 / 2.3

/**
 * 1×1 neutral placeholder bound to every frame's sampler until (unless) its real
 * photo arrives — sampling an unbound texture is undefined-ish across drivers.
 */
const BLANK = new DataTexture(new Uint8Array([12, 40, 52, 255]), 1, 1, RGBAFormat)
BLANK.needsUpdate = true

/** How far in front of the diver the ring hangs. */
const RING_DISTANCE = 18
/** Distance to the frame actually facing the reader — what framing is judged on. */
const FRONT_DISTANCE = RING_DISTANCE - RADIUS
/** Target width of the active frame as a fraction of the visible width. */
const FRAME_FILL = 0.84
const FRAME_WIDTH = 5.5

/**
 * A carousel of frames orbiting the diver.
 *
 * The ring rides with the camera rather than sitting at a fixed depth, so its
 * arrival is driven by how far the reader is through the Work *section* — the
 * timing survives any amount of copy being added above it.
 */
export function Gallery({ waterColor }: { waterColor: Color }) {
  const group = useRef<Group>(null)
  const { camera } = useThree()
  const setActiveWork = useUI((s) => s.setActiveWork)

  const spin = useRef(0)
  const shown = useRef(0)
  const lastReported = useRef(-1)
  const scratch = useMemo(() => new Vector3(), [])

  return (
    <group ref={group}>
      {work.map((item, i) => (
        <Frame key={item.title} item={item} index={i} waterColor={waterColor} />
      ))}
      <Driver
        group={group}
        camera={camera as PerspectiveCamera}
        spin={spin}
        shown={shown}
        lastReported={lastReported}
        setActiveWork={setActiveWork}
        scratch={scratch}
      />
    </group>
  )
}

/** Ring transform + active-index bookkeeping, split out so it runs once per frame. */
function Driver({
  group,
  camera,
  spin,
  shown,
  lastReported,
  setActiveWork,
  scratch,
}: {
  group: RefObject<Group | null>
  camera: PerspectiveCamera
  spin: { current: number }
  shown: { current: number }
  lastReported: { current: number }
  setActiveWork: (i: number) => void
  scratch: Vector3
}) {
  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const g = group.current
    if (!g) return

    const p = sectionProgress.work ?? 0

    // Tied to how much of the stage box is actually on screen, so the reel
    // arrives and leaves with its own container.
    shown.current = damp(shown.current, stageAnchor.visible, 5, dt)

    // Scrolling through the section walks the reel; drag/keys add on top.
    const scrollTurn = (p - 0.5) * work.length * 0.9
    const continuous = scrollTurn + galleryState.offset

    // Snap to detents unless a drag is in progress. A continuously-rotating ring
    // leaves whatever is nearest the centre never quite *at* the centre, which
    // reads as broken next to a caption naming one specific film.
    const detent = galleryState.dragging ? continuous : Math.round(continuous)
    spin.current = damp(spin.current, -detent * STEP, galleryState.dragging ? 18 : 4.5, dt)

    // Place the ring in camera space and convert, so it lands exactly where the
    // stage box is on screen no matter how the rig is pitched or drifting.
    // Framing is measured at the *front* frame, not the ring centre — they are
    // 7.4 units apart, which is a 1.7× difference in apparent offset.
    const tanHalfFov = Math.tan((camera.fov * Math.PI) / 360)
    scratch.set(0, stageAnchor.y * tanHalfFov * FRONT_DISTANCE, -RING_DISTANCE)
    camera.localToWorld(scratch)
    g.position.copy(scratch)
    // The ring's axis stays world-vertical — a reel that tipped with the diver
    // would be unreadable.
    g.rotation.set(0, spin.current, 0)

    // Fit the active frame to the viewport width. On a phone the horizontal FOV
    // is roughly a third of a laptop's, so a fixed-size reel is cropped on both
    // edges; scaling the whole ring keeps the composition instead of the size.
    const visibleHalfWidth = tanHalfFov * FRONT_DISTANCE * camera.aspect
    const fit = Math.min(1, (2 * visibleHalfWidth * FRAME_FILL) / FRAME_WIDTH)

    // Recedes and shrinks away instead of dissolving in place.
    g.scale.setScalar(fit * (0.84 + shown.current * 0.16))
    g.visible = shown.current > 0.01

    const active = ((Math.round(continuous) % work.length) + work.length) % work.length
    if (active !== lastReported.current) {
      lastReported.current = active
      setActiveWork(active)
    }

    // Hand the fade and the selection down to the frames.
    g.userData.shown = shown.current
    g.userData.active = active
  })
  return null
}

function Frame({
  item,
  index,
  waterColor,
}: {
  item: (typeof work)[number]
  index: number
  waterColor: Color
}) {
  const mesh = useRef<Mesh>(null)
  const { gl } = useThree()

  const material = useShaderMaterial({
    vertexShader: frameVertex,
    fragmentShader: frameFragment,
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uSeed: { value: item.seed },
      uPalette: { value: new Vector3(...item.palette) },
      uActive: { value: 0 },
      uHover: { value: 0 },
      uBend: { value: 0.03 },
      uFogColor: { value: new Color('#0b5570') },
      uFogDensity: { value: 0.01 },
      uOpacity: { value: 0 },
      uTexture: { value: BLANK },
      uPhotoMix: { value: 0 },
      uCoverScale: { value: new Vector2(1, 1) },
      uCoverOffset: { value: new Vector2(0, 0) },
    },
  })

  // One effect owns the photo's whole life: load → configure → bind → unbind →
  // dispose. No React state — the uniforms are the state, read per frame.
  // Missing files and network failures leave the procedural plate; that is the
  // supported shipped state, so the error path is deliberately silent.
  useEffect(() => {
    if (!item.photo) return
    let live = true
    const u = material.uniforms

    // Paths in site.ts are site-relative; honour Vite's base ('./') so photos
    // resolve on sub-path deploys, not just when served from the origin root.
    new TextureLoader().load(
      import.meta.env.BASE_URL + item.photo,
      (tex) => {
        if (!live) {
          tex.dispose()
          return
        }
        tex.colorSpace = SRGBColorSpace
        // No mipmaps: their coarser levels are built from the WHOLE image, so
        // minified samples near the crop edge would bleed rows that cover-fit
        // deliberately discarded. Linear-only keeps the crop honest.
        tex.generateMipmaps = false
        tex.minFilter = LinearFilter
        tex.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())

        const img = tex.image as { width?: number; height?: number } | undefined
        const aspect = img?.width && img?.height ? img.width / img.height : PLATE_ASPECT
        if (aspect > PLATE_ASPECT) {
          // Wider than the plate: full height, crop the sides.
          u.uCoverScale.value.set(PLATE_ASPECT / aspect, 1)
          u.uCoverOffset.value.set((1 - PLATE_ASPECT / aspect) / 2, 0)
        } else {
          // Taller than the plate: full width, crop top/bottom.
          u.uCoverScale.value.set(1, aspect / PLATE_ASPECT)
          u.uCoverOffset.value.set(0, (1 - aspect / PLATE_ASPECT) / 2)
        }
        u.uTexture.value = tex
      },
      undefined,
      () => {
        /* absent photo → procedural plate stays */
      },
    )

    return () => {
      live = false
      const bound = u.uTexture.value as Texture
      // Unbind BEFORE disposing — a frame drawn between dispose and rebind
      // would make three silently re-upload the disposed texture.
      u.uTexture.value = BLANK
      if (bound !== BLANK) bound.dispose()
    }
  }, [item.photo, material, gl])

  const angle = index * STEP

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const u = material.uniforms
    u.uTime.value += delta

    const ring = mesh.current?.parent
    if (!ring) return

    const shown = (ring.userData.shown as number) ?? 0
    const active = (ring.userData.active as number) ?? 0

    u.uActive.value = damp(u.uActive.value, active === index ? 1 : 0, 6, dt)
    u.uHover.value = damp(u.uHover.value, galleryState.hover === index ? 1 : 0, 8, dt)
    u.uOpacity.value = damp(u.uOpacity.value, shown, 6, dt)
    // Crossfade the plate to the photograph once it is bound.
    u.uPhotoMix.value = damp(u.uPhotoMix.value, u.uTexture.value === BLANK ? 0 : 1, 3.5, dt)
    u.uFogColor.value.copy(waterColor)
    // A fixed, gentle density: the frames should recede from each other around
    // the ring without being swallowed by whatever depth the reader is at.
    u.uFogDensity.value = fogDensityAt(0.35) * 0.5
  })

  return (
    <mesh
      ref={mesh}
      position={[Math.sin(angle) * RADIUS, 0, Math.cos(angle) * RADIUS]}
      rotation={[0, angle, 0]}
    >
      {/* 2.39:1 — the studio shoots anamorphic-wide, so the frames are that shape. */}
      <planeGeometry args={[5.5, 2.3, 40, 20]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

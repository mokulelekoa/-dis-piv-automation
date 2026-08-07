import { useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, Group, Mesh, PerspectiveCamera, Vector3 } from 'three'
import { frameFragment, frameVertex } from './shaders/frame'
import { useShaderMaterial } from './useShaderMaterial'
import { work } from '../data/site'
import { galleryState, sectionProgress, stageAnchor } from '../lib/sections'
import { useUI } from '../lib/store'
import { damp, fogDensityAt } from '../lib/depth'

const RADIUS = 7.4
const TAU = Math.PI * 2
const STEP = TAU / work.length

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
    },
  })

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

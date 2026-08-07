import { GLSL_NOISE } from './common'

/**
 * The ocean surface, seen from underneath.
 *
 * The whole look hangs off one piece of real physics: Snell's window. Underwater,
 * everything above the surface is compressed into a ~97° cone directly overhead;
 * outside that cone the surface is a mirror. That circle of bright sky, wobbling
 * with the swell, is the single most recognisable "you are under water" cue there
 * is — so it is modelled rather than faked with a gradient.
 */
export const surfaceVertex = /* glsl */ `
${GLSL_NOISE}

uniform float uTime;
uniform float uWaveHeight;
uniform float uWaveScale;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv;

// Sum of a few travelling waves + fbm chop. Height only — the surface is read
// from far enough below that horizontal Gerstner displacement is not worth it.
float waveHeight(vec2 p) {
  float h = 0.0;
  h += sin(p.x * 0.055 + uTime * 0.55) * 1.00;
  h += sin(p.y * 0.043 - uTime * 0.42) * 0.85;
  h += sin((p.x + p.y) * 0.031 + uTime * 0.29) * 1.25;
  h += fbm(vec3(p * 0.055, uTime * 0.11), 4) * 1.6;
  return h;
}

void main() {
  vUv = uv;
  vec3 pos = position;

  float h = waveHeight(pos.xy) * uWaveHeight;
  pos.z += h;

  // Central-difference normal, in the plane's local space before it is rotated flat.
  float e = uWaveScale;
  float hx = waveHeight(pos.xy + vec2(e, 0.0)) * uWaveHeight;
  float hy = waveHeight(pos.xy + vec2(0.0, e)) * uWaveHeight;
  vec3 tangentX = normalize(vec3(e, 0.0, hx - h));
  vec3 tangentY = normalize(vec3(0.0, e, hy - h));
  vNormal = normalize(normalMatrix * normalize(cross(tangentX, tangentY)));

  vec4 world = modelMatrix * vec4(pos, 1.0);
  vWorldPos = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

export const surfaceFragment = /* glsl */ `
${GLSL_NOISE}

uniform float uTime;
uniform float uDive;        // 0 at the surface → 1 in the deep
uniform vec3  uSkyLow;
uniform vec3  uSkyHigh;
uniform vec3  uWaterTint;
uniform vec3  uFogColor;
uniform vec3  uSunDir;
uniform float uOpacity;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv;

// cos of the critical angle for water→air (~48.6°).
const float SNELL_COS = 0.6614;

void main() {
  vec3 N = normalize(vNormal);
  // Direction from the eye up to this point on the surface.
  vec3 V = normalize(vWorldPos - cameraPosition);

  float facing = clamp(dot(V, N), 0.0, 1.0);

  // --- Snell's window ---------------------------------------------------------
  // Inside the cone we see the sky (refracted, so squashed and bright); outside,
  // total internal reflection turns the underside of the surface into a mirror.
  float window = smoothstep(SNELL_COS - 0.13, SNELL_COS + 0.05, facing);

  // Held well below clipping on purpose. The surface is the brightest thing in
  // the film, but a blown-out ceiling takes the type with it — the highlights
  // should come from bloom on the caustic creases, not from a white plane.
  float skyGrad = clamp(facing * 1.15, 0.0, 1.0);
  vec3 sky = mix(uSkyLow, uSkyHigh, skyGrad) * 0.62;

  // Sun disc, refracted through the wobbling surface.
  float sunDot = clamp(dot(reflect(V, N), normalize(uSunDir)), 0.0, 1.0);
  vec3 sun = vec3(1.0, 0.95, 0.82) * pow(sunDot, 220.0) * 3.4;
  vec3 bloom = vec3(1.0, 0.93, 0.78) * pow(sunDot, 14.0) * 0.32;

  // --- Caustic creases on the surface itself ---------------------------------
  float c = caustic(vWorldPos.xz * 0.055, uTime);
  c += caustic(vWorldPos.xz * 0.021 + 31.0, uTime * 0.7) * 0.6;

  // The mirrored side: dark, with the caustic web glinting off it.
  vec3 mirror = uWaterTint * (0.16 + c * 0.5);

  vec3 col = mix(mirror, sky + sun + bloom, window);
  col += c * window * 0.22 * vec3(0.85, 1.0, 0.98);

  // --- Distance + depth attenuation ------------------------------------------
  // Steeper than the scene fog: the surface should dissolve into water within a
  // hundred metres or so, which is what gives the window its edge.
  float dist = length(vWorldPos - cameraPosition);
  float fog = 1.0 - exp(-dist * 0.016);
  col = mix(col, uFogColor, clamp(fog, 0.0, 1.0));

  // The surface simply stops being visible once you are deep enough.
  float visible = 1.0 - smoothstep(0.42, 0.86, uDive);

  // Dissolve the plane well inside its own edge. Fog alone leaves a visible
  // seam where the geometry stops and the backdrop starts — a hard horizon line
  // across open water, which is exactly the tell we are trying to avoid.
  float edgeFade = 1.0 - smoothstep(150.0, 300.0, dist);

  float alpha = uOpacity * visible * edgeFade * (0.35 + window * 0.65);
  if (alpha < 0.004) discard;

  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`

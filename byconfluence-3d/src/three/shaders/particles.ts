import { GLSL_NOISE } from './common'

/**
 * Marine snow / plankton.
 *
 * Particles live in a slab that is re-centred on the camera every frame in the
 * vertex shader, so a few thousand points give constant density across a 200m
 * descent instead of thinning out. Nothing is uploaded per frame — the wrap is
 * one `mod` against the camera's Y.
 */
export const planktonVertex = /* glsl */ `
${GLSL_NOISE}

uniform float uTime;
uniform float uCamY;
uniform float uRange;
uniform float uSize;
uniform float uPixelRatio;
uniform float uVelocity;

attribute float aScale;
attribute float aSeed;

varying float vSeed;
varying float vGlow;

void main() {
  vec3 p = position;

  // Wrap into a slab centred on the camera → infinite field, fixed cost.
  float halfRange = uRange * 0.5;
  p.y = uCamY + mod(p.y - uCamY + halfRange, uRange) - halfRange;

  // Slow, incoherent drift. Marine snow does not fall in straight lines.
  float t = uTime * 0.06;
  p.x += snoise(vec3(p.yz * 0.05, t + aSeed)) * 1.4;
  p.z += snoise(vec3(p.xy * 0.05, t + aSeed + 9.0)) * 1.4;
  p.y += sin(uTime * 0.25 + aSeed * 6.28) * 0.35;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  // Fast scrolling streaks the field — the same read as a slow shutter.
  float streak = 1.0 + clamp(abs(uVelocity) * 0.012, 0.0, 1.6);

  gl_PointSize = uSize * aScale * streak * uPixelRatio * (28.0 / max(-mv.z, 0.6));

  vSeed = aSeed;
  // Bioluminescent twinkle, phase-offset per particle.
  vGlow = 0.45 + 0.55 * pow(abs(sin(uTime * 0.55 + aSeed * 12.0)), 3.0);
}
`

export const planktonFragment = /* glsl */ `
uniform vec3 uNear;
uniform vec3 uDeep;
uniform float uDive;
uniform float uOpacity;

varying float vSeed;
varying float vGlow;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;

  // Soft core with a wide falloff — reads as out-of-focus matter, not a dot.
  float core = smoothstep(0.5, 0.0, d);
  float alpha = pow(core, 2.2);

  // A quarter of the field glows in the deep; the rest stays inert debris.
  float lumin = step(0.76, fract(vSeed * 43.7));
  vec3 col = mix(uNear, uDeep, uDive);
  col = mix(col, vec3(0.55, 1.0, 0.95), lumin * uDive * vGlow * 0.9);

  alpha *= uOpacity * mix(0.55, 1.0, vGlow);

  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`

/** Bubbles: bigger, rising, with the rim highlight that sells them as spheres. */
export const bubbleVertex = /* glsl */ `
${GLSL_NOISE}

uniform float uTime;
uniform float uCamY;
uniform float uRange;
uniform float uSize;
uniform float uPixelRatio;

attribute float aScale;
attribute float aSeed;

varying float vScale;

void main() {
  vec3 p = position;

  // Rise, then wrap. Bigger bubbles rise faster, as they actually do.
  float speed = 1.6 + aScale * 3.2;
  p.y += uTime * speed;

  float halfRange = uRange * 0.5;
  p.y = uCamY + mod(p.y - uCamY + halfRange, uRange) - halfRange;

  // Wobble — bubbles spiral rather than tracking straight up.
  p.x += sin(uTime * 1.1 + aSeed * 6.28) * (0.25 + aScale * 0.5);
  p.z += cos(uTime * 0.9 + aSeed * 6.28) * (0.25 + aScale * 0.5);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * aScale * uPixelRatio * (30.0 / max(-mv.z, 0.6));
  vScale = aScale;
}
`

export const bubbleFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;

varying float vScale;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;

  // Thin bright rim + a specular kick up-left, hollow in the middle.
  float rim = smoothstep(0.5, 0.42, d) * smoothstep(0.30, 0.44, d);
  float spec = smoothstep(0.20, 0.0, length(uv - vec2(-0.14, 0.14)));
  float alpha = (rim * 0.9 + spec * 0.75) * uOpacity * (0.5 + vScale * 0.5);

  if (alpha < 0.004) discard;
  gl_FragColor = vec4(uColor, alpha);
  #include <colorspace_fragment>
}
`

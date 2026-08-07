import { GLSL_NOISE } from './common'

/**
 * God rays / light shafts.
 *
 * Drawn as a single open cone hanging from the sun rather than as N billboarded
 * quads: one draw call, no sorting artefacts between shafts, and the shaft
 * pattern can be made genuinely seamless because the angular coordinate is
 * sampled on a circle instead of on a wrapping UV.
 */
export const raysVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

export const raysFragment = /* glsl */ `
${GLSL_NOISE}

uniform float uTime;
uniform float uIntensity;
uniform float uCount;
uniform vec3  uColor;
uniform vec3  uDeepColor;
uniform float uDive;

varying vec2 vUv;
varying vec3 vWorldPos;

const float TAU = 6.28318530718;

void main() {
  // Seamless angular sampling: walk a circle instead of the 0→1 UV seam.
  float a = vUv.x * TAU;
  vec2 ring = vec2(cos(a), sin(a));

  // Hard-ish shafts: a couple of octaves, then a steep power curve so the gaps
  // between shafts go properly black instead of muddy grey.
  float n = fbm(vec3(ring * uCount, uTime * 0.055), 3);
  n = n * 0.5 + 0.5;
  float shaft = pow(clamp(n, 0.0, 1.0), 3.4);

  // A second, faster layer gives the shafts their flicker as the swell moves.
  float flick = fbm(vec3(ring * (uCount * 2.3), uTime * 0.16 + 40.0), 2) * 0.5 + 0.5;
  shaft *= mix(0.55, 1.25, flick);

  // Brightest just under the surface, gone by the bottom of the cone.
  float vertical = pow(clamp(vUv.y, 0.0, 1.0), 2.1);
  float topFade = smoothstep(1.0, 0.93, vUv.y);   // hide the geometry's top rim

  vec3 col = mix(uDeepColor, uColor, vertical);

  float alpha = shaft * vertical * topFade * uIntensity;
  alpha *= 1.0 - smoothstep(0.55, 0.95, uDive);   // the light runs out with depth

  if (alpha < 0.003) discard;
  gl_FragColor = vec4(col * alpha, alpha);
  #include <colorspace_fragment>
}
`

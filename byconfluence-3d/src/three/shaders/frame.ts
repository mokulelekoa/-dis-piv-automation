import { GLSL_NOISE } from './common'

/**
 * The work-gallery frames.
 *
 * Each frame's image is generated in the fragment shader rather than loaded — the
 * studio's real footage isn't mine to ship, and a procedural stand-in that moves
 * like water is more honest (and lighter) than a stock photo pretending to be
 * their reel. Swap `footage()` for a `sampler2D` when the real plates arrive; the
 * grade, refraction, grain and vignette below all still apply.
 */
export const frameVertex = /* glsl */ `
uniform float uTime;
uniform float uBend;
uniform float uHover;
uniform float uSeed;

varying vec2 vUv;
varying float vDepth;

void main() {
  vUv = uv;
  vec3 pos = position;

  // Cylindrical bend around Y so the ring of frames wraps the viewer.
  float x = pos.x;
  pos.z -= (x * x) * uBend;

  // Slow buoyancy — every frame drifts on its own phase.
  pos.y += sin(uTime * 0.5 + uSeed) * 0.06;
  pos.z += cos(uTime * 0.37 + uSeed * 1.7) * 0.05;

  // Hovering pushes the frame toward the camera and flattens its bend slightly.
  pos.z += uHover * 0.35;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`

export const frameFragment = /* glsl */ `
${GLSL_NOISE}

uniform float uTime;
uniform float uSeed;
uniform vec3  uPalette;   // x: hue, y: saturation, z: lift
uniform float uActive;    // 0 → 1, how "selected" this frame is
uniform float uHover;
uniform vec3  uFogColor;
uniform float uFogDensity;
uniform float uOpacity;

varying vec2 vUv;
varying float vDepth;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

/**
 * An abstract water column: light from above, structure below, particulate
 * between, and the milky haze that separates near from far in every underwater
 * plate ever shot. Three tones and a haze pass is enough to read as an image.
 */
vec3 footage(vec2 uv, float t) {
  float depthGrad = 1.0 - uv.y;

  // Large-scale structure — reef mass / rock shelf rising from the lower frame.
  float mass = fbm(vec3(uv * vec2(2.2, 3.4) + vec2(uSeed, uSeed * 0.5), t * 0.05), 5);
  float shelf = smoothstep(0.46, 0.0, uv.y + mass * 0.26);

  // Ridges on the mass, so it is not one flat silhouette.
  float relief = fbm(vec3(uv * vec2(7.0, 9.0) + uSeed * 2.0, t * 0.04), 3) * 0.5 + 0.5;

  // Water column banding.
  float column = fbm(vec3(uv * vec2(1.4, 2.8) + 12.0, t * 0.08 + uSeed), 4) * 0.5 + 0.5;

  vec3 light = hsv2rgb(vec3(uPalette.x + 0.05, uPalette.y * 0.68, 0.88));
  vec3 mid   = hsv2rgb(vec3(uPalette.x, uPalette.y, 0.30 + uPalette.z * 0.30));
  vec3 dark  = hsv2rgb(vec3(uPalette.x - 0.05, min(uPalette.y * 1.25, 1.0), 0.045));

  vec3 col = mix(light, mid, pow(depthGrad, 0.6));
  col = mix(col, dark * (0.55 + relief * 0.9), shelf);
  col *= 0.72 + column * 0.5;

  // Caustics, strongest in the upper third where the light still reaches.
  float c = caustic(uv * 2.6 + uSeed, t);
  col += c * pow(uv.y, 1.7) * 0.55 * light;

  // Visibility haze — the further into the frame, the more water in the way.
  // Kept light: past about a quarter it stops reading as depth and starts
  // reading as a washed-out plate.
  float haze = smoothstep(0.25, 0.85, uv.y) * 0.26;
  col = mix(col, mid * 1.2, haze);

  // Suspended particulate, drifting up-frame.
  float motes = fbm(vec3(uv * 34.0, t * 0.5 + uSeed), 2);
  col += smoothstep(0.66, 0.96, motes) * 0.2;

  return col;
}

void main() {
  vec2 uv = vUv;

  // Refraction: the whole plate wobbles as if seen through moving water.
  float wob = fbm(vec3(uv * 3.0, uTime * 0.14 + uSeed), 3);
  vec2 ruv = uv + vec2(wob, -wob) * 0.006;

  // Chromatic split, widening toward the frame edges — anamorphic-ish.
  vec2 fromCentre = ruv - 0.5;
  float edge = dot(fromCentre, fromCentre);
  vec2 ca = fromCentre * edge * (0.018 + uHover * 0.012);

  vec3 col;
  col.r = footage(ruv + ca, uTime).r;
  col.g = footage(ruv, uTime).g;
  col.b = footage(ruv - ca, uTime).b;

  // --- grade -----------------------------------------------------------------
  // Inactive frames sit back: desaturated, lower contrast, dimmer. Cheaper and
  // steadier than a real DOF blur, and it reads the same at gallery distance.
  // The floor stays high enough that the rest of the reel is still legible as
  // work rather than as dark rectangles.
  float focus = mix(0.58, 1.06, uActive);
  vec3 grey = vec3(dot(col, vec3(0.2126, 0.7152, 0.0722)));
  col = mix(grey * 0.85, col, mix(0.5, 1.0, uActive));
  col = (col - 0.42) * mix(0.95, 1.24, uActive) + 0.42;
  col *= focus + uHover * 0.18;

  // --- frame furniture -------------------------------------------------------
  vec2 b = min(uv, 1.0 - uv);
  float inner = smoothstep(0.0, 0.006, min(b.x, b.y));
  float hairline = smoothstep(0.010, 0.012, min(b.x, b.y));
  col = mix(col + vec3(0.55, 0.75, 0.72) * (0.25 + uActive * 0.5), col, hairline);

  // Vignette.
  col *= 1.0 - edge * 1.05;

  // Underwater fog by real distance, so frames genuinely recede into the water.
  float fog = 1.0 - exp(-vDepth * uFogDensity);
  col = mix(col, uFogColor, clamp(fog, 0.0, 0.92));

  // Fine grain — the last 2% that stops it looking like a CG surface.
  float grain = fract(sin(dot(gl_FragCoord.xy + uTime * 60.0, vec2(12.9898, 78.233))) * 43758.5453);
  col += (grain - 0.5) * 0.035;

  float alpha = uOpacity * inner;
  if (alpha < 0.004) discard;

  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`

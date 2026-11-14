import {
  BackgroundCanvas,
  type BackgroundCanvasProps,
} from "@/components/ui/background-canvas";

export interface ParticlesProps
  extends Omit<
    BackgroundCanvasProps,
    | "atlas"
    | "colors"
    | "palettes"
    | "scene"
    | "simulation"
    | "still"
    | "uniforms"
  > {
  /**
   * The share of dots drawn in `accentColor`, from 0 to 1.
   *
   * @default 0.35
   */
  accent?: number;
  /**
   * The color of the accent dots and the bloom around them, any CSS color.
   *
   * @default "#4f7dff"
   */
  accentColor?: string;
  /**
   * The dots' color, any CSS color. The default follows your theme: light
   * dots on a dark surface. On a light surface a neutral color leans to
   * `accentColor`, so the dots are deep tones of it, not grey.
   *
   * @default "var(--foreground)"
   */
  color?: string;
  /**
   * How many dots a 1280 by 720 box holds. A smaller box shows fewer, at the
   * same spacing.
   *
   * @default 360
   */
  count?: number;
  /**
   * How far apart the layers feel, from 0 (every dot alike) to 1 (far dots
   * small, soft and slow, near ones large, sharp and quick, and a few wide
   * soft discs in front of the focus).
   *
   * @default 0.8
   */
  depth?: number;
  /**
   * The way the dots travel, in degrees: 0 is to the right, 90 up, 180 to
   * the left, -90 down.
   *
   * @default 40
   */
  direction?: number;
  /**
   * How fast the dots travel along `direction`. At 0 they only wander in
   * place.
   *
   * @default 1
   */
  drift?: number;
  /**
   * How strongly the dots show.
   *
   * @default 1
   */
  intensity?: number;
  /**
   * How far the pointer parts the dots around it, like a lens. 0 leaves them
   * alone.
   *
   * @default 1
   */
  repel?: number;
  /**
   * The width of a dot in the middle distance, in pixels.
   *
   * @default 4
   */
  size?: number;
  /**
   * How soft the dots' edges are, from 0 (crisp) to 1 (a blur). Far dots
   * are always softer than near ones.
   *
   * @default 0.45
   */
  softness?: number;
  /**
   * How much the dots fade in and out on their own, from 0 to 1.
   *
   * @default 0.4
   */
  twinkle?: number;
  /**
   * How far the accent dots spread in hue to either side of `accentColor`,
   * from 0 (one accent) to 1.
   *
   * @default 0.5
   */
  variety?: number;
  /**
   * How far each dot strays from its course on its own curved path.
   *
   * @default 1
   */
  wander?: number;
}

const radians = (degrees: number) => (degrees * Math.PI) / 180;

// data
const SCENE = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uAccentColor;
uniform float uAccent;
uniform float uCount;
uniform float uDepth;
uniform float uDirection;
uniform float uDrift;
uniform float uIntensity;
uniform float uRepel;
uniform float uSize;
uniform float uSoftness;
uniform float uTwinkle;
uniform float uVariety;
uniform float uWander;

// A dot colour in OKLab, kept off the surface: too close to it, its lightness flips, and a
// pale colour on a light surface (or a deep one on a dark surface) meets it part-way.
vec3 legible(vec3 c, float ground) {
  vec3 lab = toOklab(c);
  lab.x = mix(lab.x, ground > 0.5 ? 0.2 : 0.97, smoothstep(0.22, 0.1, abs(lab.x - ground)));
  lab.x = ground > 0.5 ? min(lab.x, ground - 0.3) : max(lab.x, ground + 0.3);
  return lab;
}

// One layer of dots, premultiplied; halo gathers the light around them. p is in cells, cell
// is a cell in CSS pixels, z runs 0 (far) to 1 (near, in focus) and past it for the layer in
// front of the focus; keep is how much the pointer's lens shrinks distances here. tints are
// the accent and its two neighbours in hue; shade is how far a plain dot leans to them.
vec4 dots(vec2 p, float cell, float z, float keep, float seed, vec3 ink, mat3 tints, float shade, inout vec3 halo) {
  float spread = clamp(uDepth, 0.0, 1.0);
  float focus = min(z, 1.0), past = max(z - 1.0, 0.0);
  // Far dots are small, faint and soft; near ones large, strong and sharp; the few in front
  // of the focus are wide, soft discs.
  float near = mix(1.0, 0.55 + 2.05 * z * z, spread);
  float tone = mix(0.75, mix(0.5, 1.0, focus) * (1.0 - mix(1.95, 2.15, uDark) * past), spread) * uIntensity * uIntro;
  float blur = mix(uSoftness, mix(2.2 * uSoftness, uSoftness * uSoftness, focus) + 2.2 * past, spread);
  float bloom = mix(0.7, mix(0.3, 1.0, focus), spread) * tone;
  // A dot strays this far from where its cell put it, and shows within 0.22 of a cell around
  // itself: under half a cell in all, so the four cells nearest a pixel hold every dot on it.
  float stray = min(uWander * 20.0 * near / cell, 0.19);
  float limit = 0.22 + 1.415 * stray;
  vec4 sum = vec4(0);
  vec2 base = floor(p - 0.5);
  for (int j = 0; j < 2; j++) {
    for (int i = 0; i < 2; i++) {
      vec2 id = base + vec2(i, j);
      vec3 h = hash32(id + seed);
      // Too far for it to reach this pixel: skipped before the costly part.
      vec2 gap = p - id - h.xy;
      if (dot(gap, gap) > limit * limit) continue;
      vec3 k = hash32(id * 1.37 + seed + 9.1);
      if (k.z > 0.8) continue;
      // Its own slow, curved path.
      float f = 0.1 + 0.2 * k.x;
      vec2 at = id + h.xy + vec2(sin(uTime * f + h.x * TAU), cos(uTime * f * 0.87 + h.y * TAU)) * stray;
      float span = length(p - at);
      float d = span * cell * uPixelRatio / keep;
      // Most are small, a few twice as wide.
      float r = 0.5 * uSize * near * (0.6 + 0.8 * h.z * h.z) * uPixelRatio * mix(0.5, 1.0, uIntro);
      float edge = max(r * blur, 0.75);
      float beat = 1.0 - uTwinkle * 0.7 * (0.5 + 0.5 * sin(uTime * (0.3 + 0.9 * k.y) + k.x * TAU));
      float cut = smoothstep(0.22, 0.16, span);
      float amount = smoothstep(r + edge, r - edge, d) * beat * cut;
      // Its colour: the accent or one of its neighbours for an accent dot, the plain colour
      // (leaning to them on a light surface) for the rest.
      float hue = fract(k.z * 61.3) * 2.0;
      vec3 own = hue < 1.0 ? mix(tints[0], tints[1], hue) : mix(tints[1], tints[2], hue - 1.0);
      own = mix(mix(ink, own, shade), own, step(fract(k.z * 23.7), uAccent));
      // On a dark surface a dot burns a little whiter at its core.
      sum += vec4(mix(own, vec3(1), 0.4 * uDark) * amount, amount);
      // The bloom around it.
      float reach = r * mix(1.8, 2.4, uDark) + edge + 2.5 * uPixelRatio;
      halo += own * exp(-d * d / (reach * reach)) * beat * cut * bloom;
    }
  }
  // Pigment on a light surface is a little thinner than light on a dark one.
  return sum * min(tone * mix(0.9, 1.0, uDark), 1.0 / max(sum.a, 1.0));
}

vec4 scene(vec2 frag) {
  vec2 p = centered(frag);
  vec2 way = vec2(cos(uDirection), sin(uDirection));
  // The pointer parts the dots like a lens: each moves away from it, more the further out it
  // is, up to a reach of 180 pixels.
  vec2 pointer = (uPointer.xy - 0.5 * uResolution) / uPixelRatio;
  vec2 away = p - pointer;
  float lens = 0.25 * clamp(uRepel, 0.0, 2.0) * uPointer.z * (1.0 - smoothstep(0.0, 180.0, length(away)));
  float ground = toOklab(uSurface).x;
  vec3 plain = legible(uColor, ground);
  vec3 tint = legible(uAccentColor, ground);
  // The accent and its neighbours in hue, a turn of its chroma either way.
  mat2 swing = rotate(uVariety * 0.9);
  mat3 tints = mat3(fromOklab(vec3(tint.x, swing * tint.yz)), fromOklab(tint), fromOklab(vec3(tint.x, tint.yz * swing)));
  // On a light surface a grey dot is a speck of dirt: a neutral colour leans to the accent.
  float shade = 0.75 * (1.0 - uDark) * (1.0 - smoothstep(0.02, 0.08, length(plain.yz)));
  // The discs in front are always in the accent's hues, and only when it has one: a grey disc
  // out of focus is a smudge.
  float veil = smoothstep(0.02, 0.08, length(tint.yz));
  vec3 ink = fromOklab(plain);
  vec4 result = vec4(0);
  vec3 halo = vec3(0);
  for (int l = 0; l < 4; l++) {
    float fl = float(l);
    // Far, middle and near, and one layer in front of the focus: 50, 35, 10 and 5% of the
    // count.
    float z = l == 0 ? 0.0 : l == 1 ? 0.45 : l == 2 ? 1.0 : 1.4;
    float share = l == 0 ? 0.5 : l == 1 ? 0.35 : l == 2 ? 0.1 : 0.05;
    float cell = sqrt(737280.0 / (max(uCount, 1.0) * share));
    float pace = 7.0 * uDrift * mix(1.0, min(0.55 + 2.05 * z * z, 2.6), clamp(uDepth, 0.0, 1.0)) / cell;
    mat2 spin = rotate(fl * 0.9 + 0.3);
    // Near layers part further than far ones.
    float keep = 1.0 - lens * mix(0.5, 1.0, min(z, 1.0));
    float show = l == 3 ? veil : 1.0;
    vec3 bloom = vec3(0);
    vec4 layer = dots(spin * (pointer + away * keep) / cell + fl * 17.3 - spin * way * uTime * pace, cell, z, keep, fl * 41.0, ink, tints, l == 3 ? 1.0 : shade, bloom);
    result = over(layer * show, result);
    halo += bloom * show;
  }
  float strength = max(halo.r, max(halo.g, halo.b));
  vec4 lit = glow(strength > 0.0 ? halo / strength : halo, strength * mix(0.24, 0.5, uDark));
  return over(result, lit);
}
`;

/**
 * Small dots drifting in depth, behind whatever you put inside it. Four
 * layers travel the same way at their own pace: many far dots, small, faint
 * and soft, a few near ones, large and sharp, and a handful of wide soft
 * discs in front of the focus, each wandering on its own curved path. A
 * share of them takes an accent color and its neighbors in hue. On a dark
 * surface the dots are points of light with a bloom; on a light one they
 * are pigment in deep tones of the accent. The pointer parts the dots
 * around it, and with reduced motion they hold a still frame.
 */
export const Particles = (props: ParticlesProps) => {
  const {
    accent = 0.35,
    accentColor = "#4f7dff",
    color = "var(--foreground)",
    count = 360,
    depth = 0.8,
    direction = 40,
    drift = 1,
    intensity = 1,
    repel = 1,
    size = 4,
    softness = 0.45,
    twinkle = 0.4,
    variety = 0.5,
    wander = 1,
    ...rest
  } = props;
  return (
    <BackgroundCanvas
      colors={{ uAccentColor: accentColor, uColor: color }}
      data-slot="particles"
      scene={SCENE}
      still={6}
      uniforms={{
        uAccent: accent,
        uCount: count,
        uDepth: depth,
        uDirection: radians(direction),
        uDrift: drift,
        uIntensity: intensity,
        uRepel: repel,
        uSize: size,
        uSoftness: softness,
        uTwinkle: twinkle,
        uVariety: variety,
        uWander: wander,
      }}
      {...rest}
    />
  );
};

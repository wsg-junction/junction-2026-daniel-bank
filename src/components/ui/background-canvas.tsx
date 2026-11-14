"use client";

import { type ComponentProps, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { mountBackground } from "@/lib/background-runtime";

export interface BackgroundCanvasProps extends ComponentProps<"div"> {
  /**
   * Glyphs drawn once into a texture the scene samples (`uAtlas`, one square
   * cell each in a row, `uAtlasCount` of them).
   */
  atlas?: { chars: string; font?: string; weight?: number };
  /** The scene's colour uniforms (`vec3`), each as any CSS colour. */
  colors?: Record<string, string | undefined>;
  /**
   * Which edges fade out to the surface: `radial` keeps the middle, the
   * others name the side that fades.
   *
   * @default "none"
   */
  fade?: "none" | "radial" | "top" | "bottom" | "left" | "right";
  /**
   * What shows until the first frame and in browsers without WebGL2: a CSS
   * `background` value that looks like the scene.
   */
  fallback?: string;
  /**
   * Film grain over the scene, from 0 to 1.
   *
   * @default 0
   */
  grain?: number;
  /**
   * Whether the scene follows the pointer and answers a press. Touch never
   * moves it, so scrolling a page on a phone isn't disturbed.
   *
   * @default true
   */
  interactive?: boolean;
  /**
   * How strongly the scene shows over the surface, from 0 to 1.
   *
   * @default 1
   */
  opacity?: number;
  /**
   * The scene's colour-list uniforms (`vec3 name[8]` and `int nameCount`),
   * each up to eight CSS colours.
   */
  palettes?: Record<string, readonly string[] | undefined>;
  /**
   * Holds the current frame.
   *
   * @default false
   */
  paused?: boolean;
  /**
   * Render scale, from 0.25 to 1, of the screen's pixels (capped at 2×).
   * Lower is cheaper and softer.
   *
   * @default 1
   */
  quality?: number;
  /** The GLSL: the scene's uniforms and `vec4 scene(vec2 frag)`. */
  scene: string;
  /**
   * A simulation the scene reads back as `uState`: GLSL with
   * `vec4 simulate(vec2 frag)`, run each frame on last frame's result.
   */
  simulation?: { scale?: number; source: string; steps?: number };
  /**
   * Animation speed: 1 is normal, 0 holds the frame.
   *
   * @default 1
   */
  speed?: number;
  /**
   * The moment, in seconds, drawn first and kept with reduced motion.
   *
   * @default 0
   */
  still?: number;
  /** A fixed moment, in seconds: draws it and doesn't animate. */
  time?: number;
  /** The scene's own uniforms: numbers, booleans (0 or 1) and vectors. */
  uniforms?: Record<string, number | boolean | readonly number[] | undefined>;
}

/** The mask for each `fade`: the value names the edge that fades. */
const FADE = {
  bottom: "[mask-image:linear-gradient(to_bottom,black_45%,transparent)]",
  left: "[mask-image:linear-gradient(to_left,black_45%,transparent)]",
  none: "",
  radial: "[mask-image:radial-gradient(farthest-side,black_45%,transparent)]",
  right: "[mask-image:linear-gradient(to_right,black_45%,transparent)]",
  top: "[mask-image:linear-gradient(to_top,black_45%,transparent)]",
} as const;

/**
 * A GLSL fragment shader on WebGL2, behind its children: the container
 * every shader background renders in, and the place to write your own. The
 * scene is transparent and reads the surface behind it, so it glows on a
 * dark page and tints a light one. It runs only while it's on screen and
 * the tab is visible, draws one still frame with reduced motion, and takes
 * any CSS colour, read again when the theme changes. Until the first
 * frame, and in a browser without WebGL2, the box shows `fallback`.
 * `data-state` is `loading`, `live`, `still` or `unsupported`.
 */
export const BackgroundCanvas = (props: BackgroundCanvasProps) => {
  const {
    atlas,
    colors,
    fade = "none",
    fallback,
    grain = 0,
    interactive = true,
    opacity,
    palettes,
    paused = false,
    quality = 1,
    scene,
    simulation,
    speed = 1,
    still = 0,
    time,
    uniforms,
    className,
    children,
    ...rest
  } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!(root && canvas)) {
      return;
    }
    // Calling it again with new props updates the running scene.
    const background = mountBackground(root, canvas, {
      atlas,
      colors,
      grain,
      interactive,
      palettes,
      paused,
      quality,
      scene,
      simulation,
      speed,
      still,
      time,
      uniforms,
    });
    return () => background.destroy();
  }, [
    atlas,
    colors,
    grain,
    interactive,
    palettes,
    paused,
    quality,
    scene,
    simulation,
    speed,
    still,
    time,
    uniforms,
  ]);

  return (
    <div
      className={cn(
        "group/background relative isolate overflow-hidden bg-background",
        className
      )}
      data-slot="background-canvas"
      ref={rootRef}
      {...rest}
    >
      <div
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-0 -z-10", FADE[fade])}
        data-slot="background-canvas-layer"
        style={{ opacity }}
      >
        {fallback ? (
          <div
            className="absolute inset-0 transition-opacity duration-300 group-data-[state=live]/background:opacity-0 group-data-[state=still]/background:opacity-0"
            data-slot="background-canvas-fallback"
            style={{ background: fallback }}
          />
        ) : null}
        <canvas
          className="absolute inset-0 block size-full opacity-0 transition-opacity duration-300 group-data-[state=live]/background:opacity-100 group-data-[state=still]/background:opacity-100"
          data-slot="background-canvas-canvas"
          ref={canvasRef}
        />
      </div>
      {children}
    </div>
  );
};

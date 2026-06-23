export type EasingType =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'cubicBezier';

export interface EasingDef {
  type: EasingType;
  /** Only used when type === 'cubicBezier'. CSS cubic-bezier 4-param: [x1, y1, x2, y2] */
  params?: [number, number, number, number];
}

/**
 * Animatable properties. `transform` is split into independent numeric
 * sub-properties so each can be keyframed separately and recombined into a
 * single valid SVG transform string at apply time.
 */
export type AnimatableProperty =
  | 'opacity'
  | 'translateX'
  | 'translateY'
  | 'rotate'
  | 'scale'
  | 'path';

export interface Keyframe {
  /** Time offset in milliseconds from animation start */
  time: number;
  /** Numeric properties → number; path → SVG path data string */
  value: number | string;
  easing: EasingDef;
}

export interface AnimationTrack {
  id: string;
  targetLayerId: string;
  property: AnimatableProperty;
  /** 'morph' reserved for Phase 3 path morphing via flubber */
  type?: 'morph';
  /** Must be sorted by time ascending */
  keyframes: Keyframe[];
}

export interface AnimationData {
  /** Total animation duration in milliseconds */
  duration: number;
  /** Target playback frame rate */
  fps: number;
  tracks: AnimationTrack[];
  /** When true (default), playback restarts from 0 after reaching duration. */
  loop?: boolean;
}

export const DEFAULT_ANIMATION_DATA: AnimationData = {
  duration: 1000,
  fps: 60,
  tracks: [],
  loop: true,
};

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

export type AnimatableProperty = 'opacity' | 'transform' | 'path';

export interface Keyframe {
  /** Time offset in milliseconds from animation start */
  time: number;
  /** opacity/transform → number (opacity: 0–1, transform: numeric value per axis),
   *  path → SVG path data string */
  value: number | string;
  easing: EasingDef;
}

export interface MorphOptions {
  /** Controls resampled point density. Lower = smoother. Default: 10 */
  maxSegmentLength?: number
}

export interface AnimationTrack {
  id: string;
  targetLayerId: string;
  property: AnimatableProperty;
  /** 'morph' — path morphing via flubber (Phase 3) */
  type?: 'morph';
  /** Options for morph interpolation. Only used when type === 'morph'. */
  morphOptions?: MorphOptions;
  /** Must be sorted by time ascending */
  keyframes: Keyframe[];
}

export interface AnimationData {
  /** Total animation duration in milliseconds */
  duration: number;
  /** Target playback frame rate */
  fps: number;
  tracks: AnimationTrack[];
}

export const DEFAULT_ANIMATION_DATA: AnimationData = {
  duration: 1000,
  fps: 60,
  tracks: [],
};

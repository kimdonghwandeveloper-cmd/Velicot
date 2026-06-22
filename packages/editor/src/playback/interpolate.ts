import type { AnimationTrack } from '../model/keyframe';
import { getEasingFn } from './easing';

/**
 * Computes the interpolated value for a track at a given time.
 *
 * - Before first keyframe: returns first keyframe value.
 * - After last keyframe: returns last keyframe value.
 * - path/morph tracks: returns the nearest earlier keyframe value (no numeric lerp).
 */
export function interpolateValue(
  track: AnimationTrack,
  timeMs: number,
): number | string {
  const kfs = track.keyframes;
  if (kfs.length === 0) return 0;
  if (kfs.length === 1) return kfs[0].value;

  if (timeMs <= kfs[0].time) return kfs[0].value;
  if (timeMs >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;

  let lo = 0;
  let hi = kfs.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (kfs[mid].time <= timeMs) lo = mid;
    else hi = mid;
  }

  const from = kfs[lo];
  const to = kfs[hi];

  if (track.property === 'path' || track.type === 'morph') {
    return from.value;
  }

  const span = to.time - from.time;
  const raw = span === 0 ? 1 : (timeMs - from.time) / span;
  const easeFn = getEasingFn(from.easing);
  const t = easeFn(Math.min(1, Math.max(0, raw)));

  const a = Number(from.value);
  const b = Number(to.value);
  if (Number.isNaN(a) || Number.isNaN(b)) return from.value;
  return a + (b - a) * t;
}

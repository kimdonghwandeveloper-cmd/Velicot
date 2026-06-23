import type { AnimationTrack } from '../model/keyframe';
import { getEasingFn } from './easing';
import { interpolateMorph } from '@velicot/morph';

/**
 * Computes the interpolated value for a track at a given time.
 *
 * - Before first keyframe: returns first keyframe value.
 * - After last keyframe: returns last keyframe value.
 * - path tracks with type==='morph': flubber path interpolation.
 * - path tracks without type: step (no lerp).
 * - numeric tracks (opacity, transform): eased linear interpolation.
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

  const span = to.time - from.time;
  const raw = span === 0 ? 1 : (timeMs - from.time) / span;
  const easeFn = getEasingFn(from.easing);
  const easedT = easeFn(Math.min(1, Math.max(0, raw)));

  if (track.property === 'path') {
    if (track.type === 'morph') {
      return interpolateMorph(
        String(from.value),
        String(to.value),
        easedT,
        track.morphOptions,
      );
    }
    return from.value;
  }

  const a = Number(from.value);
  const b = Number(to.value);
  if (Number.isNaN(a) || Number.isNaN(b)) return from.value;
  return a + (b - a) * easedT;
}

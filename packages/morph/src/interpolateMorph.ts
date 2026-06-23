import type { MorphOptions } from './types'

// flubber is a CJS bundle with no type declarations — import via named export
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { interpolate as flubberInterpolateRaw } from 'flubber'

const flubberInterpolate = flubberInterpolateRaw as (
  from: string,
  to: string,
  options?: { maxSegmentLength?: number },
) => (t: number) => string

/**
 * Interpolates between two SVG path strings using flubber.
 * Falls back to a step at t=0.5 for paths flubber cannot handle
 * (holes, multi-subpath, malformed data).
 */
export function interpolateMorph(
  fromPath: string,
  toPath: string,
  t: number,
  options?: MorphOptions,
): string {
  try {
    const fn = flubberInterpolate(fromPath, toPath, {
      maxSegmentLength: options?.maxSegmentLength ?? 10,
    })
    return fn(t)
  } catch {
    return t < 0.5 ? fromPath : toPath
  }
}

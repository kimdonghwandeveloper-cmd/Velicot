/// <reference path="./flubber.d.ts" />

import type { MorphOptions } from './types'

import { interpolate as flubberInterpolate } from 'flubber'

type MorphInterpolator = (progress: number) => string

const MAX_CACHE_ENTRIES = 100
const interpolatorCache = new Map<string, MorphInterpolator>()

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
  if (t <= 0) return fromPath
  if (t >= 1) return toPath

  const requestedSegmentLength = options?.maxSegmentLength
  const maxSegmentLength = requestedSegmentLength !== undefined
    && Number.isFinite(requestedSegmentLength)
    && requestedSegmentLength > 0
    ? requestedSegmentLength
    : 10
  const cacheKey = JSON.stringify([fromPath, toPath, maxSegmentLength])
  let interpolator = interpolatorCache.get(cacheKey)

  if (!interpolator) {
    try {
      interpolator = flubberInterpolate(fromPath, toPath, { maxSegmentLength })
    } catch (error) {
      console.warn(
        '[interpolateMorph] Unable to interpolate paths; keeping the source path.',
        error,
      )
      interpolator = (progress) => progress >= 1 ? toPath : fromPath
    }
    if (interpolatorCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = interpolatorCache.keys().next().value
      if (oldestKey !== undefined) interpolatorCache.delete(oldestKey)
    }
    interpolatorCache.set(cacheKey, interpolator)
  }
  return interpolator(t)
}

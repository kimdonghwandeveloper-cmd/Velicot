import { describe, it, expect } from 'vitest';
import { interpolateValue } from '../../playback/interpolate';
import { getEasingFn } from '../../playback/easing';
import type { AnimationTrack } from '../keyframe';

const LINEAR_EASING = { type: 'linear' as const };
const EASE_IN_OUT = { type: 'easeInOut' as const };

function makeOpacityTrack(
  keyframes: AnimationTrack['keyframes'],
): AnimationTrack {
  return {
    id: 'test',
    targetLayerId: 'layer-1',
    property: 'opacity',
    keyframes,
  };
}

describe('interpolateValue', () => {
  it('returns first value before start', () => {
    const track = makeOpacityTrack([
      { time: 100, value: 0.5, easing: LINEAR_EASING },
      { time: 500, value: 1, easing: LINEAR_EASING },
    ]);
    expect(interpolateValue(track, 0)).toBe(0.5);
  });

  it('returns last value after end', () => {
    const track = makeOpacityTrack([
      { time: 0, value: 1, easing: LINEAR_EASING },
      { time: 1000, value: 0, easing: LINEAR_EASING },
    ]);
    expect(interpolateValue(track, 2000)).toBe(0);
  });

  it('linear interpolates at t=0.5', () => {
    const track = makeOpacityTrack([
      { time: 0, value: 0, easing: LINEAR_EASING },
      { time: 1000, value: 1, easing: LINEAR_EASING },
    ]);
    expect(interpolateValue(track, 500)).toBeCloseTo(0.5);
  });

  it('linear interpolates at t=0', () => {
    const track = makeOpacityTrack([
      { time: 0, value: 0, easing: LINEAR_EASING },
      { time: 1000, value: 1, easing: LINEAR_EASING },
    ]);
    expect(interpolateValue(track, 0)).toBeCloseTo(0);
  });

  it('linear interpolates at t=1', () => {
    const track = makeOpacityTrack([
      { time: 0, value: 0, easing: LINEAR_EASING },
      { time: 1000, value: 1, easing: LINEAR_EASING },
    ]);
    expect(interpolateValue(track, 1000)).toBeCloseTo(1);
  });

  it('easeInOut is slower at midpoint than linear', () => {
    const track = makeOpacityTrack([
      { time: 0, value: 0, easing: EASE_IN_OUT },
      { time: 1000, value: 1, easing: EASE_IN_OUT },
    ]);
    // easeInOut at t=0.25 should be less than 0.25 (slow start)
    const val = interpolateValue(track, 250) as number;
    expect(val).toBeLessThan(0.25);
  });

  it('handles single keyframe', () => {
    const track = makeOpacityTrack([{ time: 0, value: 0.7, easing: LINEAR_EASING }]);
    expect(interpolateValue(track, 500)).toBe(0.7);
  });

  it('returns path string without interpolation', () => {
    const track: AnimationTrack = {
      id: 'p',
      targetLayerId: 'layer-1',
      property: 'path',
      keyframes: [
        { time: 0, value: 'M0,0 L10,0', easing: LINEAR_EASING },
        { time: 1000, value: 'M0,0 L20,0', easing: LINEAR_EASING },
      ],
    };
    expect(interpolateValue(track, 500)).toBe('M0,0 L10,0');
  });

  it('returns empty track default', () => {
    const track = makeOpacityTrack([]);
    expect(interpolateValue(track, 500)).toBe(0);
  });

  it('returns from.value instead of NaN when value is invalid string', () => {
    const track = makeOpacityTrack([
      { time: 0, value: 'invalid' as unknown as number, easing: LINEAR_EASING },
      { time: 1000, value: 1, easing: LINEAR_EASING },
    ]);
    const result = interpolateValue(track, 500);
    expect(result).not.toBeNaN();
    expect(result).toBe('invalid');
  });

  it('handles keyframes with duplicate time values', () => {
    const track = makeOpacityTrack([
      { time: 500, value: 0.2, easing: LINEAR_EASING },
      { time: 500, value: 0.8, easing: LINEAR_EASING },
    ]);
    expect(() => interpolateValue(track, 500)).not.toThrow();
  });

  it('works with translateX track', () => {
    const track: AnimationTrack = {
      id: 'tx',
      targetLayerId: 'layer-1',
      property: 'translateX',
      keyframes: [
        { time: 0, value: 0, easing: LINEAR_EASING },
        { time: 1000, value: 200, easing: LINEAR_EASING },
      ],
    };
    expect(interpolateValue(track, 500)).toBeCloseTo(100);
  });
});

describe('getEasingFn', () => {
  it('linear returns identity', () => {
    const fn = getEasingFn({ type: 'linear' });
    expect(fn(0)).toBeCloseTo(0);
    expect(fn(0.5)).toBeCloseTo(0.5);
    expect(fn(1)).toBeCloseTo(1);
  });

  it('easeInOut outputs 0 at 0 and 1 at 1', () => {
    const fn = getEasingFn({ type: 'easeInOut' });
    expect(fn(0)).toBeCloseTo(0);
    expect(fn(1)).toBeCloseTo(1);
  });

  it('cubicBezier with ease-in-out params behaves similarly to easeInOut', () => {
    const fn = getEasingFn({ type: 'cubicBezier', params: [0.42, 0, 0.58, 1] });
    expect(fn(0)).toBeCloseTo(0, 2);
    expect(fn(1)).toBeCloseTo(1, 2);
    // at midpoint, cubicBezier ease-in-out ≈ 0.5
    expect(fn(0.5)).toBeCloseTo(0.5, 1);
  });

  it('cubicBezier falls back to default params when none provided', () => {
    const fn = getEasingFn({ type: 'cubicBezier' });
    expect(fn(0)).toBeCloseTo(0, 2);
    expect(fn(1)).toBeCloseTo(1, 2);
  });

  it('unknown easing type falls back to linear', () => {
    const fn = getEasingFn({ type: 'unknown' as never });
    expect(fn(0.5)).toBeCloseTo(0.5);
  });
});

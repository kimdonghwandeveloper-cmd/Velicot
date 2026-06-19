import {
  easeLinear,
  easeCubicIn,
  easeCubicOut,
  easeCubicInOut,
} from 'd3-ease';
import type { EasingDef } from '../model/keyframe';

/**
 * Solves the CSS cubic-bezier parametric equation via bisection.
 * Returns an easing function t → y given control points (x1,y1,x2,y2).
 */
function makeCubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (t: number) => number {
  function sampleX(t: number) {
    return 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  }
  function sampleY(t: number) {
    return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  }
  function tFromX(x: number): number {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      const cx = sampleX(mid);
      if (Math.abs(cx - x) < 1e-6) return mid;
      if (cx < x) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }
  return (x: number) => sampleY(tFromX(x));
}

const D3_MAP: Record<string, (t: number) => number> = {
  linear: easeLinear,
  easeIn: easeCubicIn,
  easeOut: easeCubicOut,
  easeInOut: easeCubicInOut,
};

export function getEasingFn(def: EasingDef): (t: number) => number {
  if (def.type === 'cubicBezier') {
    const p = def.params ?? [0.42, 0, 0.58, 1];
    return makeCubicBezier(p[0], p[1], p[2], p[3]);
  }
  return D3_MAP[def.type] ?? easeLinear;
}

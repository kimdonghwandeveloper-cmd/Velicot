import type { AnimatableProperty } from '../model/keyframe';

type FrameValues = Map<string, Partial<Record<AnimatableProperty, number | string>>>;

interface LayerBaseline {
  opacity: string;
  transform: string | null;
  path: SVGPathElement | null;
  pathData: string | null;
}

const baselines = new WeakMap<SVGGElement, LayerBaseline>();

/**
 * Applies computed animation values to the live SVG DOM.
 * Looks up layer groups by data-layer-id attribute.
 */
export function applyAnimationFrame(
  svgRoot: SVGSVGElement,
  frameValues: FrameValues,
): void {
  frameValues.forEach((props, layerId) => {
    const g = findLayer(svgRoot, layerId);
    if (!g) return;

    if (!baselines.has(g)) {
      const path = g.querySelector<SVGPathElement>('path');
      baselines.set(g, {
        opacity: g.style.opacity,
        transform: g.getAttribute('transform'),
        path,
        pathData: path?.getAttribute('d') ?? null,
      });
    }

    if (props.opacity !== undefined) {
      const opacity = Number(props.opacity);
      if (Number.isFinite(opacity)) {
        g.style.opacity = String(Math.min(1, Math.max(0, opacity)));
      }
    }

    const hasTransform =
      props.translateX !== undefined ||
      props.translateY !== undefined ||
      props.rotate !== undefined ||
      props.scale !== undefined;
    if (hasTransform) {
      const tx = Number(props.translateX ?? 0);
      const ty = Number(props.translateY ?? 0);
      const r = Number(props.rotate ?? 0);
      const s = Number(props.scale ?? 1);
      if ([tx, ty, r, s].every(Number.isFinite)) {
        g.setAttribute('transform', `translate(${tx}, ${ty}) rotate(${r}) scale(${s})`);
      }
    }

    if (props.path !== undefined) {
      const pathEl = g.querySelector<SVGPathElement>('path');
      if (pathEl) {
        pathEl.setAttribute('d', String(props.path));
      }
    }
  });
}

/** Restores every layer changed by applyAnimationFrame to its original DOM state. */
export function resetAnimationFrame(svgRoot: SVGSVGElement): void {
  svgRoot.querySelectorAll<SVGGElement>('g[data-layer-id]').forEach((g) => {
    const baseline = baselines.get(g);
    if (!baseline) return;

    g.style.opacity = baseline.opacity;
    if (baseline.transform === null) g.removeAttribute('transform');
    else g.setAttribute('transform', baseline.transform);

    if (baseline.path) {
      if (baseline.pathData === null) baseline.path.removeAttribute('d');
      else baseline.path.setAttribute('d', baseline.pathData);
    }
    baselines.delete(g);
  });
}

function findLayer(svgRoot: SVGSVGElement, layerId: string): SVGGElement | undefined {
  return Array.from(
    svgRoot.querySelectorAll<SVGGElement>('g[data-layer-id]'),
  ).find((group) => group.getAttribute('data-layer-id') === layerId);
}

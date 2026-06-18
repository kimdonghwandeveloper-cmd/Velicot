import type { AnimatableProperty } from '../model/keyframe';

type FrameValues = Map<string, Partial<Record<AnimatableProperty, number | string>>>;

/**
 * Applies computed animation values to the live SVG DOM.
 * Looks up layer groups by data-layer-id attribute.
 */
export function applyAnimationFrame(
  svgRoot: SVGSVGElement,
  frameValues: FrameValues,
): void {
  frameValues.forEach((props, layerId) => {
    const g = svgRoot.querySelector<SVGGElement>(`g[data-layer-id="${layerId}"]`);
    if (!g) return;

    if (props.opacity !== undefined) {
      g.style.opacity = String(props.opacity);
    }

    if (props.transform !== undefined) {
      g.setAttribute('transform', String(props.transform));
    }

    if (props.path !== undefined) {
      const pathEl = g.querySelector<SVGPathElement>('path');
      if (pathEl) {
        pathEl.setAttribute('d', String(props.path));
      }
    }
  });
}

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
      const clamped = Math.min(1, Math.max(0, Number(props.opacity)));
      g.style.opacity = String(clamped);
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
      g.setAttribute('transform', `translate(${tx}, ${ty}) rotate(${r}) scale(${s})`);
    }

    if (props.path !== undefined) {
      const pathEl = g.querySelector<SVGPathElement>('path');
      if (pathEl) {
        pathEl.setAttribute('d', String(props.path));
      }
    }
  });
}

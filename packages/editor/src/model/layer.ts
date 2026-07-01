export interface LayerModel {
  id: string;
  name: string;
  /** serialized SVG content for this layer (innerHTML of the layer group) */
  svgContent: string;
  groupId: string;
  visible: boolean;
  locked: boolean;
}

export interface CanvasModel {
  version: '1.0';
  canvas: { width: number; height: number };
  layers: LayerModel[];
  /** Full SVG string snapshot from @svgedit/svgcanvas — used for save/restore */
  svgString?: string;
  /** Keyframe animation data — absent means no animation defined yet */
  animation?: import('./keyframe').AnimationData;
}

export function createEmptyCanvas(
  width = 512,
  height = 512,
): CanvasModel {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error('Canvas dimensions must be positive finite numbers');
  }
  return {
    version: '1.0',
    canvas: { width, height },
    layers: [],
  };
}

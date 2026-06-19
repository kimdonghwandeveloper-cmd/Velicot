import type { CanvasModel, LayerModel } from './layer';

const LAYER_GROUP_ATTR = 'data-velicot-layer';
const LAYER_ID_ATTR = 'data-layer-id';
const LAYER_NAME_ATTR = 'data-layer-name';
const LAYER_LOCKED_ATTR = 'data-layer-locked';

/**
 * Converts a live SVG DOM into a serializable CanvasModel.
 * Reads layer groups annotated by the editor with data attributes.
 */
export function svgDomToModel(svgRoot: SVGSVGElement): CanvasModel {
  const width = Number(svgRoot.getAttribute('width')) || 512;
  const height = Number(svgRoot.getAttribute('height')) || 512;

  // Support both Velicot-annotated layers and SVGEdit native g.layer groups
  const seen = new Set<SVGGElement>();
  const layerGroups: SVGGElement[] = [];
  for (const g of svgRoot.querySelectorAll<SVGGElement>(`g[${LAYER_GROUP_ATTR}], g.layer`)) {
    if (!seen.has(g)) { seen.add(g); layerGroups.push(g); }
  }

  const layers: LayerModel[] = layerGroups.map((g, i) => {
    // SVGEdit native layers: name is in a <title> child; no data attrs
    const titleEl = g.querySelector('title');
    const svgContent = titleEl
      ? g.innerHTML.replace(titleEl.outerHTML, '').trim()
      : g.innerHTML;
    return {
      id: g.getAttribute(LAYER_ID_ATTR) ?? g.id ?? `layer-${i}`,
      name: g.getAttribute(LAYER_NAME_ATTR) ?? titleEl?.textContent ?? 'Layer',
      svgContent,
      groupId: g.parentElement?.id ?? 'root',
      visible: g.style.display !== 'none',
      locked: g.getAttribute(LAYER_LOCKED_ATTR) === 'true',
    };
  });

  return {
    version: '1.0',
    canvas: { width, height },
    layers,
  };
}

/**
 * Reconstructs SVG DOM elements from a CanvasModel.
 * Appends layer groups into the provided SVG container element.
 */
export function modelToSvgDom(
  model: CanvasModel,
  svgRoot: SVGSVGElement,
): void {
  svgRoot.setAttribute('width', String(model.canvas.width));
  svgRoot.setAttribute('height', String(model.canvas.height));

  // Remove existing velicot layers before repopulating
  svgRoot
    .querySelectorAll(`g[${LAYER_GROUP_ATTR}]`)
    .forEach((el) => el.remove());

  for (const layer of model.layers) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute(LAYER_GROUP_ATTR, '');
    g.setAttribute(LAYER_ID_ATTR, layer.id);
    g.setAttribute(LAYER_NAME_ATTR, layer.name);
    g.setAttribute(LAYER_LOCKED_ATTR, String(layer.locked));
    g.id = layer.id;
    if (!layer.visible) {
      g.style.display = 'none';
    }
    g.innerHTML = layer.svgContent;
    svgRoot.appendChild(g);
  }
}

/**
 * Serializes a CanvasModel to a JSON string.
 */
export function serializeModel(model: CanvasModel): string {
  return JSON.stringify(model, null, 2);
}

/**
 * Parses a JSON string back into a CanvasModel.
 * Throws if the payload is not a valid CanvasModel.
 */
export function deserializeModel(json: string): CanvasModel {
  const parsed: unknown = JSON.parse(json);
  assertCanvasModel(parsed);
  return parsed;
}

function assertCanvasModel(value: unknown): asserts value is CanvasModel {
  if (
    typeof value !== 'object' ||
    value === null ||
    (value as Record<string, unknown>)['version'] !== '1.0' ||
    !Array.isArray((value as Record<string, unknown>)['layers'])
  ) {
    throw new Error('Invalid CanvasModel payload');
  }
}

import type { CanvasModel, LayerModel } from './layer';
import {
  DEFAULT_ANIMATION_DATA,
  type AnimatableProperty,
  type AnimationData,
  type AnimationTrack,
  type EasingDef,
  type Keyframe,
} from './keyframe';

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

    // Assign stable ID: prefer existing data-layer-id, fall back to non-empty g.id, else generate
    const existingId = g.getAttribute(LAYER_ID_ATTR) ?? (g.id || null);
    const id = existingId ?? `layer-${i}`;

    // Annotate SVGEdit-native layers so applyAnimationFrame can find them by data-layer-id
    if (!g.getAttribute(LAYER_ID_ATTR)) {
      g.setAttribute(LAYER_ID_ATTR, id);
      g.setAttribute(LAYER_GROUP_ATTR, '');
    }

    return {
      id,
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

  // Remove existing editor layers before repopulating.
  svgRoot
    .querySelectorAll(`g[${LAYER_GROUP_ATTR}], g.layer`)
    .forEach((el) => el.remove());

  for (const layer of model.layers) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('layer');
    g.setAttribute(LAYER_GROUP_ATTR, '');
    g.setAttribute(LAYER_ID_ATTR, layer.id);
    g.setAttribute(LAYER_NAME_ATTR, layer.name);
    g.setAttribute(LAYER_LOCKED_ATTR, String(layer.locked));
    g.id = layer.id;
    if (!layer.visible) {
      g.style.display = 'none';
    }
    g.innerHTML = layer.svgContent;
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = layer.name;
    g.prepend(title);
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
 * Serializes the public *.kfm.json shape from plan.md §5.1.
 * Editor-only fields remain in serializeModel and are not leaked here.
 */
export function serializeKfm(model: CanvasModel): string {
  return JSON.stringify({
    version: model.version,
    canvas: model.canvas,
    layers: model.layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      svgContent: layer.svgContent,
      groupId: layer.groupId,
      visible: layer.visible,
      locked: layer.locked,
    })),
    tracks: (model.animation?.tracks ?? []).map((track) => ({
      id: track.id,
      targetLayerId: track.targetLayerId,
      property: track.property,
      ...(track.type ? { type: track.type } : {}),
      ...(track.morphOptions ? { morphOptions: track.morphOptions } : {}),
      keyframes: track.keyframes.map((keyframe) => ({
        time: keyframe.time,
        value: keyframe.value,
        easing: easingToString(keyframe.easing),
      })),
    })),
  }, null, 2);
}

/**
 * Parses a JSON string back into a CanvasModel.
 * Throws if the payload is not a valid CanvasModel.
 */
export function deserializeModel(json: string): CanvasModel {
  const parsed: unknown = JSON.parse(json);
  return parseCanvasModel(parsed);
}

function parseCanvasModel(value: unknown): CanvasModel {
  if (!isRecord(value) || value.version !== '1.0') {
    throw new Error('Invalid or unsupported CanvasModel version');
  }
  if (!isRecord(value.canvas)) {
    throw new Error('Canvas dimensions are required');
  }
  const width = positiveFiniteNumber(value.canvas.width, 'canvas width');
  const height = positiveFiniteNumber(value.canvas.height, 'canvas height');
  if (!Array.isArray(value.layers)) {
    throw new Error('Canvas layers must be an array');
  }

  const layerIds = new Set<string>();
  const layers = value.layers.map((layer, index): LayerModel => {
    if (!isRecord(layer)) throw new Error(`Layer at index ${index} must be an object`);
    const id = nonEmptyString(layer.id, `layer ${index} id`);
    if (layerIds.has(id)) throw new Error(`Duplicate layer id "${id}"`);
    layerIds.add(id);

    const svgContent = typeof layer.svgContent === 'string'
      ? layer.svgContent
      : typeof layer.svgPath === 'string'
        ? `<path d="${escapeAttribute(layer.svgPath)}"></path>`
        : '';
    assertSafeSvgMarkup(svgContent, `layer "${id}"`);
    return {
      id,
      name: typeof layer.name === 'string' ? layer.name : id,
      svgContent,
      groupId: typeof layer.groupId === 'string' ? layer.groupId : 'root',
      visible: typeof layer.visible === 'boolean' ? layer.visible : true,
      locked: typeof layer.locked === 'boolean' ? layer.locked : false,
    };
  });

  const animation = parseAnimation(value.animation, value.tracks, layerIds);
  const svgString = value.svgString;
  if (svgString !== undefined && typeof svgString !== 'string') {
    throw new Error('svgString must be a string');
  }
  if (typeof svgString === 'string') assertSafeSvgMarkup(svgString, 'svgString');

  return {
    version: '1.0',
    canvas: { width, height },
    layers,
    ...(svgString !== undefined ? { svgString } : {}),
    ...(animation ? { animation } : {}),
  };
}

function parseAnimation(
  internalValue: unknown,
  publicTracksValue: unknown,
  layerIds: Set<string>,
): AnimationData | undefined {
  if (internalValue === undefined && publicTracksValue === undefined) return undefined;

  let duration = DEFAULT_ANIMATION_DATA.duration;
  let fps = DEFAULT_ANIMATION_DATA.fps;
  let loop = DEFAULT_ANIMATION_DATA.loop;
  let tracksValue = publicTracksValue;

  if (internalValue !== undefined) {
    if (!isRecord(internalValue)) throw new Error('animation must be an object');
    duration = nonNegativeFiniteNumber(internalValue.duration, 'animation duration');
    fps = positiveFiniteNumber(internalValue.fps, 'animation fps');
    if (internalValue.loop !== undefined && typeof internalValue.loop !== 'boolean') {
      throw new Error('animation loop must be a boolean');
    }
    loop = internalValue.loop as boolean | undefined;
    tracksValue = internalValue.tracks;
  }
  if (!Array.isArray(tracksValue)) throw new Error('animation tracks must be an array');

  const trackIds = new Set<string>();
  const tracks = tracksValue.map((track, index) =>
    parseTrack(track, index, layerIds, trackIds),
  );
  return { duration, fps, tracks, loop };
}

function parseTrack(
  value: unknown,
  index: number,
  layerIds: Set<string>,
  trackIds: Set<string>,
): AnimationTrack {
  if (!isRecord(value)) throw new Error(`Track at index ${index} must be an object`);
  const id = nonEmptyString(value.id, `track ${index} id`);
  if (trackIds.has(id)) throw new Error(`Duplicate track id "${id}"`);
  trackIds.add(id);

  const targetLayerId = nonEmptyString(value.targetLayerId, `track ${index} targetLayerId`);
  if (!layerIds.has(targetLayerId)) {
    throw new Error(`Track "${id}" references unknown layer "${targetLayerId}"`);
  }
  const property = parseProperty(value.property, id);
  if (!Array.isArray(value.keyframes)) {
    throw new Error(`Track "${id}" keyframes must be an array`);
  }
  const keyframes = value.keyframes
    .map((keyframe, keyframeIndex) =>
      parseKeyframe(keyframe, keyframeIndex, property, id),
    )
    .sort((a, b) => a.time - b.time);

  if (value.type !== undefined && value.type !== 'morph') {
    throw new Error(`Track "${id}" has an invalid type`);
  }
  if (value.type === 'morph' && property !== 'path') {
    throw new Error(`Morph track "${id}" must animate path`);
  }

  let morphOptions: AnimationTrack['morphOptions'];
  if (value.morphOptions !== undefined) {
    if (!isRecord(value.morphOptions)) {
      throw new Error(`Track "${id}" morphOptions must be an object`);
    }
    morphOptions = {
      maxSegmentLength: positiveFiniteNumber(
        value.morphOptions.maxSegmentLength,
        `track "${id}" maxSegmentLength`,
      ),
    };
  }
  return {
    id,
    targetLayerId,
    property,
    ...(value.type === 'morph' ? { type: 'morph' as const } : {}),
    ...(morphOptions ? { morphOptions } : {}),
    keyframes,
  };
}

function parseKeyframe(
  value: unknown,
  index: number,
  property: AnimatableProperty,
  trackId: string,
): Keyframe {
  if (!isRecord(value)) {
    throw new Error(`Keyframe ${index} in track "${trackId}" must be an object`);
  }
  const time = nonNegativeFiniteNumber(value.time, `keyframe ${index} time`);
  const keyframeValue = property === 'path'
    ? nonEmptyString(value.value, `keyframe ${index} path`)
    : finiteNumber(value.value, `keyframe ${index} value`);
  return { time, value: keyframeValue, easing: parseEasing(value.easing) };
}

function parseEasing(value: unknown): EasingDef {
  if (typeof value === 'string') {
    const cubicMatch = value.match(
      /^cubic-bezier\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)$/,
    );
    if (cubicMatch) {
      return {
        type: 'cubicBezier',
        params: cubicMatch.slice(1).map(Number) as [number, number, number, number],
      };
    }
    if (['linear', 'easeIn', 'easeOut', 'easeInOut'].includes(value)) {
      return { type: value as EasingDef['type'] };
    }
    throw new Error(`Unsupported easing "${value}"`);
  }
  if (!isRecord(value) || typeof value.type !== 'string') {
    throw new Error('Keyframe easing is invalid');
  }
  if (value.type === 'cubicBezier') {
    if (
      !Array.isArray(value.params) ||
      value.params.length !== 4 ||
      !value.params.every((part) => typeof part === 'number' && Number.isFinite(part))
    ) {
      throw new Error('cubicBezier easing requires four finite parameters');
    }
    return {
      type: 'cubicBezier',
      params: value.params as [number, number, number, number],
    };
  }
  if (['linear', 'easeIn', 'easeOut', 'easeInOut'].includes(value.type)) {
    return { type: value.type as EasingDef['type'] };
  }
  throw new Error(`Unsupported easing "${value.type}"`);
}

function parseProperty(value: unknown, trackId: string): AnimatableProperty {
  const properties: AnimatableProperty[] = [
    'opacity', 'translateX', 'translateY', 'rotate', 'scale', 'path',
  ];
  if (typeof value !== 'string' || !properties.includes(value as AnimatableProperty)) {
    throw new Error(`Track "${trackId}" has an invalid property`);
  }
  return value as AnimatableProperty;
}

function easingToString(easing: EasingDef): string {
  return easing.type === 'cubicBezier' && easing.params
    ? `cubic-bezier(${easing.params.join(',')})`
    : easing.type;
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}

function positiveFiniteNumber(value: unknown, label: string): number {
  const number = finiteNumber(value, label);
  if (number <= 0) throw new Error(`${label} must be greater than zero`);
  return number;
}

function nonNegativeFiniteNumber(value: unknown, label: string): number {
  const number = finiteNumber(value, label);
  if (number < 0) throw new Error(`${label} cannot be negative`);
  return number;
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function assertSafeSvgMarkup(markup: string, label: string): void {
  const forbiddenElement = /<\s*(?:script|foreignObject|iframe|object|embed)\b/i;
  const eventHandler = /(?:\s|\/)on[a-z]+\s*=/i;
  const scriptUrl = /(?:\s|\/)(?:href|src)\s*=\s*["']?\s*(?:javascript:|data:text\/html)/i;
  if (
    forbiddenElement.test(markup) ||
    eventHandler.test(markup) ||
    scriptUrl.test(markup)
  ) {
    throw new Error(`${label} contains unsafe SVG markup`);
  }

  // Browser parsing decodes character entities before exposing attributes,
  // which closes bypasses such as `java&#x73;cript:`.
  if (typeof document !== 'undefined') {
    const template = document.createElement('template');
    template.innerHTML = markup;
    for (const element of template.content.querySelectorAll('*')) {
      const tagName = element.localName.toLowerCase();
      if (['script', 'foreignobject', 'iframe', 'object', 'embed'].includes(tagName)) {
        throw new Error(`${label} contains unsafe SVG markup`);
      }
      for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase();
        const normalizedValue = attribute.value.trim().toLowerCase();
        if (
          name.startsWith('on') ||
          (['href', 'src', 'xlink:href'].includes(name) &&
            (normalizedValue.startsWith('javascript:') ||
              normalizedValue.startsWith('data:text/html')))
        ) {
          throw new Error(`${label} contains unsafe SVG markup`);
        }
      }
    }
  }
}

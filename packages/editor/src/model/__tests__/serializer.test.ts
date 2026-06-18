import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import type { CanvasModel, LayerModel } from '../layer';
import {
  svgDomToModel,
  modelToSvgDom,
  serializeModel,
  deserializeModel,
} from '../serializer';

function makeSvgRoot(dom: JSDOM): SVGSVGElement {
  const svg = dom.window.document.createElementNS(
    'http://www.w3.org/2000/svg',
    'svg',
  ) as SVGSVGElement;
  svg.setAttribute('width', '512');
  svg.setAttribute('height', '512');
  dom.window.document.body.appendChild(svg);
  return svg;
}

function makeLayer(overrides: Partial<LayerModel> = {}): LayerModel {
  return {
    id: 'layer-1',
    name: 'Layer 1',
    svgContent: '<rect x="0" y="0" width="10" height="10"/>',
    groupId: 'root',
    visible: true,
    locked: false,
    ...overrides,
  };
}

describe('serializer round-trip', () => {
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><body></body>', {
      pretendToBeVisual: true,
    });
    // Provide global document for modelToSvgDom
    global.document = dom.window.document as unknown as Document;
  });

  it('single layer round-trip preserves id and svgContent', () => {
    const model: CanvasModel = {
      version: '1.0',
      canvas: { width: 512, height: 512 },
      layers: [makeLayer()],
    };
    const svg = makeSvgRoot(dom);
    modelToSvgDom(model, svg);
    const result = svgDomToModel(svg);

    expect(result.layers).toHaveLength(1);
    expect(result.layers[0].id).toBe('layer-1');
    expect(result.layers[0].svgContent).toContain('rect');
  });

  it('20-layer round-trip preserves order and count', () => {
    const layers: LayerModel[] = Array.from({ length: 20 }, (_, i) =>
      makeLayer({ id: `layer-${i}`, name: `Layer ${i}` }),
    );
    const model: CanvasModel = {
      version: '1.0',
      canvas: { width: 512, height: 512 },
      layers,
    };
    const svg = makeSvgRoot(dom);
    modelToSvgDom(model, svg);
    const result = svgDomToModel(svg);

    expect(result.layers).toHaveLength(20);
    result.layers.forEach((l, i) => {
      expect(l.id).toBe(`layer-${i}`);
    });
  });

  it('empty canvas serializes to empty layers array', () => {
    const model: CanvasModel = {
      version: '1.0',
      canvas: { width: 512, height: 512 },
      layers: [],
    };
    const svg = makeSvgRoot(dom);
    modelToSvgDom(model, svg);
    const result = svgDomToModel(svg);
    expect(result.layers).toHaveLength(0);
  });

  it('invisible layer preserves visible:false after round-trip', () => {
    const model: CanvasModel = {
      version: '1.0',
      canvas: { width: 512, height: 512 },
      layers: [makeLayer({ visible: false })],
    };
    const svg = makeSvgRoot(dom);
    modelToSvgDom(model, svg);
    const result = svgDomToModel(svg);
    expect(result.layers[0].visible).toBe(false);
  });

  it('locked layer preserves locked:true after round-trip', () => {
    const model: CanvasModel = {
      version: '1.0',
      canvas: { width: 512, height: 512 },
      layers: [makeLayer({ locked: true })],
    };
    const svg = makeSvgRoot(dom);
    modelToSvgDom(model, svg);
    const result = svgDomToModel(svg);
    expect(result.layers[0].locked).toBe(true);
  });
});

describe('JSON serialization', () => {
  it('serializeModel + deserializeModel round-trip', () => {
    const model: CanvasModel = {
      version: '1.0',
      canvas: { width: 800, height: 600 },
      layers: [makeLayer()],
    };
    const json = serializeModel(model);
    const restored = deserializeModel(json);
    expect(restored.version).toBe('1.0');
    expect(restored.canvas.width).toBe(800);
    expect(restored.layers[0].id).toBe('layer-1');
  });

  it('deserializeModel throws on invalid payload', () => {
    expect(() => deserializeModel('{"foo":"bar"}')).toThrow(
      'Invalid CanvasModel payload',
    );
  });
});

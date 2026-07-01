import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { applyAnimationFrame, resetAnimationFrame } from '../../playback/applyFrame';

function makeLayer(id: string): SVGGElement {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('data-layer-id', id);
  return g;
}

function makeSvgRoot(...layers: SVGGElement[]): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
  layers.forEach((l) => svg.appendChild(l));
  return svg;
}

describe('applyAnimationFrame', () => {
  let svg: SVGSVGElement;
  let layerA: SVGGElement;

  beforeEach(() => {
    const dom = new JSDOM('<!DOCTYPE html><body></body>');
    // @ts-expect-error set global document for DOM operations
    global.document = dom.window.document;
    layerA = makeLayer('layer-a');
    svg = makeSvgRoot(layerA);
  });

  it('applies opacity within [0,1]', () => {
    applyAnimationFrame(svg, new Map([['layer-a', { opacity: 0.5 }]]));
    expect(layerA.style.opacity).toBe('0.5');
  });

  it('clamps opacity above 1 to 1', () => {
    applyAnimationFrame(svg, new Map([['layer-a', { opacity: 1.8 }]]));
    expect(layerA.style.opacity).toBe('1');
  });

  it('clamps opacity below 0 to 0', () => {
    applyAnimationFrame(svg, new Map([['layer-a', { opacity: -0.3 }]]));
    expect(layerA.style.opacity).toBe('0');
  });

  it('builds translate transform string from translateX', () => {
    applyAnimationFrame(svg, new Map([['layer-a', { translateX: 50 }]]));
    expect(layerA.getAttribute('transform')).toBe('translate(50, 0) rotate(0) scale(1)');
  });

  it('builds translate transform string from translateX and translateY', () => {
    applyAnimationFrame(svg, new Map([['layer-a', { translateX: 30, translateY: -20 }]]));
    expect(layerA.getAttribute('transform')).toBe('translate(30, -20) rotate(0) scale(1)');
  });

  it('includes rotate in transform string', () => {
    applyAnimationFrame(svg, new Map([['layer-a', { rotate: 45 }]]));
    expect(layerA.getAttribute('transform')).toBe('translate(0, 0) rotate(45) scale(1)');
  });

  it('includes scale in transform string', () => {
    applyAnimationFrame(svg, new Map([['layer-a', { scale: 2 }]]));
    expect(layerA.getAttribute('transform')).toBe('translate(0, 0) rotate(0) scale(2)');
  });

  it('silently skips unknown layerId', () => {
    expect(() =>
      applyAnimationFrame(svg, new Map([['nonexistent', { opacity: 0.5 }]])),
    ).not.toThrow();
  });

  it('applies path to first <path> child', () => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    layerA.appendChild(path);
    applyAnimationFrame(svg, new Map([['layer-a', { path: 'M0,0 L10,10' }]]));
    expect(path.getAttribute('d')).toBe('M0,0 L10,10');
  });

  it('restores original opacity, transform, and path data', () => {
    layerA.style.opacity = '0.8';
    layerA.setAttribute('transform', 'translate(4, 5)');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M0,0 L1,1');
    layerA.appendChild(path);

    applyAnimationFrame(svg, new Map([[
      'layer-a',
      { opacity: 0.2, translateX: 20, path: 'M2,2 L3,3' },
    ]]));
    resetAnimationFrame(svg);

    expect(layerA.style.opacity).toBe('0.8');
    expect(layerA.getAttribute('transform')).toBe('translate(4, 5)');
    expect(path.getAttribute('d')).toBe('M0,0 L1,1');
  });

  it('supports layer ids containing CSS selector characters', () => {
    layerA.setAttribute('data-layer-id', 'layer"with.special#chars');
    expect(() =>
      applyAnimationFrame(svg, new Map([[
        'layer"with.special#chars',
        { opacity: 0.4 },
      ]])),
    ).not.toThrow();
    expect(layerA.style.opacity).toBe('0.4');
  });

  it('ignores non-finite numeric values', () => {
    applyAnimationFrame(svg, new Map([[
      'layer-a',
      { opacity: Number.NaN, translateX: Number.POSITIVE_INFINITY },
    ]]));
    expect(layerA.style.opacity).toBe('');
    expect(layerA.hasAttribute('transform')).toBe(false);
  });
});

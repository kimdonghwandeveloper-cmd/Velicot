import { useEffect, useRef, useState } from 'react';
import SvgCanvas from '@svgedit/svgcanvas';
import type { ToolId } from '../toolbar/tools';
import type { CanvasModel } from '../model/layer';
import { svgDomToModel } from '../model/serializer';

export type SvgCanvasInstance = InstanceType<typeof SvgCanvas>;

interface UseSvgCanvasOptions {
  width?: number;
  height?: number;
  /** Initial SVG string to load (from a previously saved CanvasModel.svgString) */
  initialSvgString?: string;
  onModelChange?: (model: CanvasModel) => void;
  /** Called when the user selects an element on canvas; receives the layer id */
  onLayerSelect?: (layerId: string) => void;
}

interface UseSvgCanvasReturn {
  containerRef: React.RefObject<HTMLDivElement>;
  canvas: SvgCanvasInstance | null;
  setTool: (tool: ToolId) => void;
  getSvgString: () => string;
}

export function useSvgCanvas({
  width = 512,
  height = 512,
  initialSvgString,
  onModelChange,
  onLayerSelect,
}: UseSvgCanvasOptions = {}): UseSvgCanvasReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvas, setCanvas] = useState<SvgCanvasInstance | null>(null);
  const canvasRef = useRef<SvgCanvasInstance | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let svgCanvas: SvgCanvasInstance;
    try {
      svgCanvas = new SvgCanvas(container, {
        dimensions: [width, height],
        initFill: { color: 'FF0000', opacity: 1 },
        initStroke: { color: '000000', opacity: 1, width: 1 },
        initOpacity: 1,
      });
    } catch (err) {
      console.error('[useSvgCanvas] SvgCanvas constructor failed:', err);
      return;
    }

    canvasRef.current = svgCanvas;
    setCanvas(svgCanvas);

    // Restore saved SVG if provided
    if (initialSvgString) {
      svgCanvas.setSvgString(initialSvgString);
    }

    if (onModelChange) {
      svgCanvas.bind('changed', () => {
        const svgRoot = svgCanvas.getSvgContent();
        if (svgRoot) {
          onModelChange(svgDomToModel(svgRoot));
        }
      });
    }

    if (onLayerSelect) {
      // SVGEdit has no "element selected" event — poll on mouseup instead.
      // After any click on the canvas, check getSelectedElements() and walk
      // up to the nearest g[data-layer-id] to determine which layer was clicked.
      const handleMouseUp = () => {
        // Defer one tick so SVGEdit finishes updating selectedElements
        // before we read it.
        setTimeout(() => {
          const selectedEls: Element[] = (
            svgCanvas as unknown as { getSelectedElements: () => Element[] }
          ).getSelectedElements().filter(Boolean);
          const el = selectedEls[0];
          if (!el) return;
          let node: Element | null = el;
          while (node) {
            const layerId = node.getAttribute('data-layer-id');
            if (layerId) { onLayerSelect(layerId); return; }
            node = node.parentElement;
          }
        }, 0);
      };
      container.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      canvasRef.current = null;
      // Clear SVGEdit-injected DOM so that re-runs (React StrictMode, HMR)
      // start with an empty container instead of accumulating stale instances.
      container.innerHTML = '';
    };
  // onModelChange / initialSvgString intentionally excluded — callers must memoize them
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  const setTool = (tool: ToolId) => {
    if (!canvasRef.current) return;
    try {
      canvasRef.current.setMode(tool);
    } catch {
      // SVGEdit pathActions may throw when path editing state is uninitialized
      (canvasRef.current as unknown as { currentMode: string }).currentMode = tool;
    }
  };

  const getSvgString = (): string => {
    return canvasRef.current?.getSvgString() ?? '';
  };

  return { containerRef, canvas, setTool, getSvgString };
}

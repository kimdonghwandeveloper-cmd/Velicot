import { useEffect, useRef, useState } from 'react';
import SvgCanvas from '@svgedit/svgcanvas';
import type { ToolId } from '../toolbar/tools';
import type { CanvasModel } from '../model/layer';
import { svgDomToModel } from '../model/serializer';

export type SvgCanvasInstance = InstanceType<typeof SvgCanvas>;

interface UseSvgCanvasOptions {
  width?: number;
  height?: number;
  onModelChange?: (model: CanvasModel) => void;
}

interface UseSvgCanvasReturn {
  containerRef: React.RefObject<HTMLDivElement>;
  canvas: SvgCanvasInstance | null;
  setTool: (tool: ToolId) => void;
}

export function useSvgCanvas({
  width = 512,
  height = 512,
  onModelChange,
}: UseSvgCanvasOptions = {}): UseSvgCanvasReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvas, setCanvas] = useState<SvgCanvasInstance | null>(null);
  const canvasRef = useRef<SvgCanvasInstance | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const svgCanvas = new SvgCanvas(container, {
      dimensions: [width, height],
      initFill: { color: 'FF0000', opacity: 1 },
      initStroke: { color: '000000', opacity: 1, width: 1 },
      initOpacity: 1,
    });

    canvasRef.current = svgCanvas;
    setCanvas(svgCanvas);

    if (onModelChange) {
      svgCanvas.bind('changed', () => {
        const svgRoot = svgCanvas.getSvgContent();
        if (svgRoot) {
          onModelChange(svgDomToModel(svgRoot));
        }
      });
    }

    return () => {
      canvasRef.current = null;
    };
  // onModelChange intentionally excluded — callers must memoize it
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  const setTool = (tool: ToolId) => {
    canvasRef.current?.setMode(tool);
  };

  return { containerRef, canvas, setTool };
}

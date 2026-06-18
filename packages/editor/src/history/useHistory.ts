import { useCallback, useEffect, useState } from 'react';
import type { SvgCanvasInstance } from '../canvas/useSvgCanvas';

interface UseHistoryReturn {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useHistory(canvas: SvgCanvasInstance | null): UseHistoryReturn {
  const [, forceUpdate] = useState(0);

  const undo = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (canvas?.undoMgr as any)?.undo?.();
    forceUpdate((n) => n + 1);
  }, [canvas]);

  const redo = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (canvas?.undoMgr as any)?.redo?.();
    forceUpdate((n) => n + 1);
  }, [canvas]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'y' || (e.key === 'z' && e.shiftKey))
      ) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const undoMgr = canvas?.undoMgr as any;
  const canUndo = (undoMgr?.getUndoStackSize?.() ?? 0) > 0;
  const canRedo = (undoMgr?.getRedoStackSize?.() ?? 0) > 0;

  return { undo, redo, canUndo, canRedo };
}

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
    canvas?.undoMgr?.undo();
    forceUpdate((n) => n + 1);
  }, [canvas]);

  const redo = useCallback(() => {
    canvas?.undoMgr?.redo();
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

  const canUndo = canvas?.undoMgr?.getUndoStackSize?.() > 0 ?? false;
  const canRedo = canvas?.undoMgr?.getRedoStackSize?.() > 0 ?? false;

  return { undo, redo, canUndo, canRedo };
}

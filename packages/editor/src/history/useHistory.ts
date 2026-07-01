import { useCallback, useEffect, useState } from 'react';
import type { SvgCanvasInstance } from '../canvas/useSvgCanvas';

interface UseHistoryReturn {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

interface UndoManagerLike {
  undo?: () => void;
  redo?: () => void;
  getUndoStackSize?: () => number;
  getRedoStackSize?: () => number;
}

export function useHistory(canvas: SvgCanvasInstance | null): UseHistoryReturn {
  const [, forceUpdate] = useState(0);

  const undo = useCallback(() => {
    const undoManager = canvas?.undoMgr as unknown as UndoManagerLike | undefined;
    undoManager?.undo?.();
    forceUpdate((n) => n + 1);
  }, [canvas]);

  const redo = useCallback(() => {
    const undoManager = canvas?.undoMgr as unknown as UndoManagerLike | undefined;
    undoManager?.redo?.();
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

  const undoMgr = canvas?.undoMgr as unknown as UndoManagerLike | undefined;
  const canUndo = (undoMgr?.getUndoStackSize?.() ?? 0) > 0;
  const canRedo = (undoMgr?.getRedoStackSize?.() ?? 0) > 0;

  return { undo, redo, canUndo, canRedo };
}

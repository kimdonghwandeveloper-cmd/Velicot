import React, { useCallback, useState } from 'react';
import { useSvgCanvas } from './useSvgCanvas';
import { Toolbar } from '../toolbar/Toolbar';
import { useHistory } from '../history/useHistory';
import { TOOL_IDS, type ToolId } from '../toolbar/tools';
import type { CanvasModel } from '../model/layer';

interface SvgCanvasEditorProps {
  width?: number;
  height?: number;
  onModelChange?: (model: CanvasModel) => void;
}

export function SvgCanvasEditor({
  width = 512,
  height = 512,
  onModelChange,
}: SvgCanvasEditorProps) {
  const [activeTool, setActiveTool] = useState<ToolId>(TOOL_IDS.SELECT);

  const handleModelChange = useCallback(
    (model: CanvasModel) => {
      onModelChange?.(model);
    },
    [onModelChange],
  );

  const { containerRef, canvas, setTool } = useSvgCanvas({
    width,
    height,
    onModelChange: handleModelChange,
  });

  const { undo, redo, canUndo, canRedo } = useHistory(canvas);

  const handleToolChange = (tool: ToolId) => {
    setActiveTool(tool);
    setTool(tool);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#121212',
        color: '#fff',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          background: '#1e1e1e',
          borderBottom: '1px solid #333',
        }}
      >
        <button
          onClick={undo}
          disabled={!canUndo}
          style={btnStyle(!canUndo)}
          title="Undo (Ctrl+Z)"
        >
          Undo
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          style={btnStyle(!canRedo)}
          title="Redo (Ctrl+Y)"
        >
          Redo
        </button>
      </div>

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Toolbar activeTool={activeTool} onToolChange={handleToolChange} />
        <div
          ref={containerRef}
          style={{
            flex: 1,
            overflow: 'auto',
            background: '#2a2a2a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
      </div>
    </div>
  );
}

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '4px 10px',
    background: disabled ? '#333' : '#2d2d2d',
    color: disabled ? '#666' : '#fff',
    border: '1px solid #444',
    borderRadius: 4,
    cursor: disabled ? 'default' : 'pointer',
    fontSize: 12,
  };
}

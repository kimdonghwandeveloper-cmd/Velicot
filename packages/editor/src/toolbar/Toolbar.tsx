import React from 'react';
import { TOOLS, type ToolId } from './tools';

interface ToolbarProps {
  activeTool: ToolId;
  onToolChange: (tool: ToolId) => void;
}

export function Toolbar({ activeTool, onToolChange }: ToolbarProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: 8,
        background: '#1e1e1e',
        borderRight: '1px solid #333',
        minWidth: 48,
      }}
    >
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          title={`${tool.label} (${tool.shortcut})`}
          onClick={() => onToolChange(tool.id)}
          style={{
            width: 36,
            height: 36,
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            background: activeTool === tool.id ? '#0078d4' : '#2d2d2d',
            color: '#fff',
            fontSize: 11,
            fontWeight: activeTool === tool.id ? 700 : 400,
          }}
        >
          {tool.shortcut}
        </button>
      ))}
    </div>
  );
}

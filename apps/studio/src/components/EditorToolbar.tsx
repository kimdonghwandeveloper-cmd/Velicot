import React from 'react'

export type EditorToolId = 'select' | 'pathedit' | 'fhpath' | 'rect' | 'ellipse' | 'text'

interface ToolEntry { key: string; id: EditorToolId; label: string; title: string }

const TOOLS: ToolEntry[] = [
  { key: 'V', id: 'select',   label: 'V', title: 'Select (V)' },
  { key: 'A', id: 'pathedit', label: 'A', title: 'Path Edit (A)' },
  { key: 'P', id: 'fhpath',   label: 'P', title: 'Pen (P)' },
  { key: 'R', id: 'rect',     label: 'R', title: 'Rectangle (R)' },
  { key: 'O', id: 'ellipse',  label: 'O', title: 'Ellipse (O)' },
  { key: 'H', id: 'text',     label: 'H', title: 'Text (H)' },
]

interface Props {
  activeTool: EditorToolId
  onToolChange: (id: EditorToolId) => void
}

export function EditorToolbar({ activeTool, onToolChange }: Props) {
  return (
    <div style={{
      width: 44, background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', paddingTop: 8, gap: 2,
      flexShrink: 0,
    }}>
      {TOOLS.map((t) => (
        <button
          key={t.key}
          title={t.title}
          onClick={() => onToolChange(t.id)}
          style={{
            width: 32, height: 32, borderRadius: 'var(--radius-sm)',
            background: activeTool === t.id ? 'var(--accent)' : 'transparent',
            color: activeTool === t.id ? '#fff' : 'var(--text-2)',
            fontWeight: 600, fontSize: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.1s, color 0.1s',
          }}
        >
          {t.label}
        </button>
      ))}
      <div style={{ marginTop: 8, width: 24, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

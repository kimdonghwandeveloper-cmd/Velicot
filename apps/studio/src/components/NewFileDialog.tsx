import React, { useState } from 'react'
import { createEmptyCanvas, type CanvasModel } from '@velicot/editor'

interface Preset { label: string; w: number; h: number }

const PRESETS: Preset[] = [
  { label: 'Square 512', w: 512, h: 512 },
  { label: 'Square 1024', w: 1024, h: 1024 },
  { label: 'HD 1280×720', w: 1280, h: 720 },
  { label: 'Custom', w: 0, h: 0 },
]

interface Props {
  onClose: () => void
  onCreate: (model: CanvasModel, filename: string) => void
}

export function NewFileDialog({ onClose, onCreate }: Props) {
  const [preset, setPreset] = useState<string>('Square 512')
  const [w, setW] = useState(512)
  const [h, setH] = useState(512)

  const handlePreset = (label: string) => {
    setPreset(label)
    const p = PRESETS.find((x) => x.label === label)
    if (p && p.w > 0) { setW(p.w); setH(p.h) }
  }

  const handleCreate = () => {
    const model = createEmptyCanvas(w, h)
    onCreate(model, 'untitled.kfm.json')
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '28px 24px', width: 320,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>
          Create an artboard
        </div>

        <select
          value={preset}
          onChange={(e) => handlePreset(e.target.value)}
          style={selectStyle}
        >
          {PRESETS.map((p) => (
            <option key={p.label} value={p.label}>{p.label}</option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ color: 'var(--text-2)', minWidth: 14 }}>W</label>
          <input
            type="number" min={1} max={4096} value={w}
            onChange={(e) => { setW(Number(e.target.value)); setPreset('Custom') }}
            style={inputStyle}
          />
          <label style={{ color: 'var(--text-2)', minWidth: 14 }}>H</label>
          <input
            type="number" min={1} max={4096} value={h}
            onChange={(e) => { setH(Number(e.target.value)); setPreset('Custom') }}
            style={inputStyle}
          />
        </div>

        <button onClick={handleCreate} style={createBtnStyle}>
          Create Artboard
        </button>
      </div>
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  background: 'var(--bg-surface)', color: 'var(--text-1)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  padding: '7px 10px', width: '100%',
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-surface)', color: 'var(--text-1)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  padding: '6px 8px', width: '100%', textAlign: 'center',
}

const createBtnStyle: React.CSSProperties = {
  background: 'var(--accent)', color: '#fff', fontWeight: 600,
  borderRadius: 'var(--radius-sm)', padding: '9px 0', width: '100%',
  fontSize: 13, letterSpacing: 0.3,
  transition: 'background 0.15s',
}

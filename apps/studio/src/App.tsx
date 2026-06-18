import React, { useCallback, useState } from 'react'
import {
  SvgCanvasEditor,
  serializeModel,
  deserializeModel,
  type CanvasModel,
} from '@velicot/editor'

export default function App() {
  const [model, setModel] = useState<CanvasModel | null>(null)

  const handleModelChange = useCallback((m: CanvasModel) => {
    setModel(m)
  }, [])

  const handleSave = () => {
    if (!model) return
    const json = serializeModel(model)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'canvas.kfm.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const loaded = deserializeModel(ev.target?.result as string)
        setModel(loaded)
      } catch {
        alert('Invalid .kfm.json file')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 16px',
          background: '#0d0d0d',
          borderBottom: '1px solid #2a2a2a',
        }}
      >
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 16, letterSpacing: 1 }}>
          Velicot Studio
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={handleSave} style={headerBtnStyle}>
          Save .kfm.json
        </button>
        <label style={{ ...headerBtnStyle, cursor: 'pointer' }}>
          Load .kfm.json
          <input
            type="file"
            accept=".json,.kfm.json"
            style={{ display: 'none' }}
            onChange={handleLoad}
          />
        </label>
        {model && (
          <span style={{ color: '#666', fontSize: 11 }}>
            {model.layers.length} layer{model.layers.length !== 1 ? 's' : ''}
          </span>
        )}
      </header>

      {/* Editor */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <SvgCanvasEditor
          width={512}
          height={512}
          onModelChange={handleModelChange}
        />
      </div>
    </div>
  )
}

const headerBtnStyle: React.CSSProperties = {
  padding: '5px 12px',
  background: '#1e1e1e',
  color: '#ccc',
  border: '1px solid #444',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
}

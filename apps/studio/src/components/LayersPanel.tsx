import React, { useState } from 'react'
import type { CanvasModel, LayerModel } from '@velicot/editor'

interface Props {
  model: CanvasModel | null
  selectedLayerId: string | null
  onSelectLayer: (id: string) => void
}

export function LayersPanel({ model, selectedLayerId, onSelectLayer }: Props) {
  const [tab, setTab] = useState<'layers' | 'properties'>('layers')

  return (
    <div style={{
      width: 260, background: 'var(--bg-surface)',
      borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      flexShrink: 0, overflow: 'hidden',
    }}>
      {/* Tabs */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--border)',
        padding: '0 12px',
      }}>
        {(['layers', 'properties'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 12px',
              background: 'none', color: tab === t ? 'var(--text-1)' : 'var(--text-2)',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              fontWeight: tab === t ? 600 : 400,
              textTransform: 'capitalize',
              fontSize: 12, letterSpacing: 0.3,
              transition: 'color 0.1s',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'layers' ? (
        <LayersTab model={model} selectedId={selectedLayerId} onSelect={onSelectLayer} />
      ) : (
        <PropertiesTab selectedId={selectedLayerId} model={model} />
      )}
    </div>
  )
}

function LayersTab({ model, selectedId, onSelect }: {
  model: CanvasModel | null
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const layers = model?.layers ?? []

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px 4px',
      }}>
        <span style={{ fontSize: 10, letterSpacing: 1, color: 'var(--text-2)', textTransform: 'uppercase' }}>
          Layers
        </span>
        <button
          title="Add layer"
          style={{
            width: 22, height: 22, borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-overlay)', color: 'var(--text-2)',
            fontSize: 16, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          +
        </button>
      </div>

      {layers.length === 0 ? (
        <div style={{ padding: '16px 12px', color: 'var(--text-3)', fontSize: 11 }}>
          No layers yet
        </div>
      ) : (
        layers.map((layer) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            isSelected={layer.id === selectedId}
            onSelect={() => onSelect(layer.id)}
          />
        ))
      )}
    </div>
  )
}

function LayerRow({ layer, isSelected, onSelect }: {
  layer: LayerModel
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 12px',
        background: isSelected ? 'var(--bg-overlay)' : 'transparent',
        borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
    >
      <div style={{
        width: 14, height: 14, borderRadius: 3,
        border: '1px solid var(--border)',
        background: 'transparent', flexShrink: 0,
      }} />
      <span style={{
        flex: 1, color: isSelected ? 'var(--text-1)' : 'var(--text-2)',
        fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {layer.name}
      </span>
      {!layer.visible && (
        <span style={{ color: 'var(--text-3)', fontSize: 10 }}>hidden</span>
      )}
    </div>
  )
}

function PropertiesTab({ selectedId, model }: { selectedId: string | null; model: CanvasModel | null }) {
  const layer = model?.layers.find((l) => l.id === selectedId)
  if (!layer) {
    return (
      <div style={{ padding: 16, color: 'var(--text-3)', fontSize: 11 }}>
        Select a layer to see properties
      </div>
    )
  }
  return (
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <PropRow label="ID" value={layer.id} />
      <PropRow label="Name" value={layer.name} />
      <PropRow label="Visible" value={layer.visible ? 'Yes' : 'No'} />
      <PropRow label="Locked" value={layer.locked ? 'Yes' : 'No'} />
    </div>
  )
}

function PropRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: 'var(--text-2)', fontSize: 11, width: 56, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text-1)', fontSize: 12 }}>{value}</span>
    </div>
  )
}

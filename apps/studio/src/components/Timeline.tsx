import React, { useState } from 'react'

type StateTab = 'idle' | 'working' | 'done' | 'error'

const STATE_COLORS: Record<StateTab, string> = {
  idle: 'var(--accent)',
  working: 'transparent',
  done: 'transparent',
  error: 'transparent',
}

export function Timeline() {
  const [activeState, setActiveState] = useState<StateTab>('idle')
  const [isPlaying, setIsPlaying] = useState(false)

  return (
    <div style={{
      background: 'var(--bg-surface)',
      borderTop: '1px solid var(--border)',
      flexShrink: 0,
      userSelect: 'none',
    }}>
      {/* Status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '6px 12px', borderBottom: '1px solid var(--border-light)',
        fontSize: 11,
      }}>
        <CoordInput label="X" value={0} />
        <CoordInput label="Y" value={0} />
        <CoordInput label="W" value={512} />
        <CoordInput label="H" value={512} />
        <div style={{ flex: 1 }} />
        <span style={{ color: 'var(--text-2)' }}>state</span>
        {(['idle', 'working', 'done', 'error'] as StateTab[]).map((s) => (
          <button
            key={s}
            onClick={() => setActiveState(s)}
            style={{
              padding: '2px 10px', borderRadius: 20,
              border: '1px solid',
              borderColor: activeState === s ? 'var(--accent)' : 'var(--border)',
              background: activeState === s ? 'rgba(124,58,237,0.2)' : 'transparent',
              color: activeState === s ? 'var(--accent-light)' : 'var(--text-2)',
              fontSize: 11,
              transition: 'all 0.1s',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Playback controls */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', borderBottom: '1px solid var(--border-light)',
      }}>
        <PlayBtn icon="⏮" title="Go to start" onClick={() => {}} />
        <button
          title={isPlaying ? 'Pause' : 'Play'}
          onClick={() => setIsPlaying(!isPlaying)}
          style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11,
          }}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <PlayBtn icon="⏭" title="Go to end" onClick={() => {}} />

        <span style={{ color: 'var(--accent-light)', fontFamily: 'var(--font-mono)', fontSize: 12, marginLeft: 4 }}>
          0:00.000
        </span>
        <span style={{ color: 'var(--text-3)', fontSize: 11 }}>/</span>
        <span style={{ color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          1:00.000
        </span>

        <div style={{ flex: 1 }} />
        <span style={{ color: 'var(--text-2)', fontSize: 11 }}>60 fps</span>
        <PlayBtn icon="−" title="Zoom out" onClick={() => {}} small />
        <PlayBtn icon="+" title="Zoom in" onClick={() => {}} small />
        <button
          style={{
            padding: '3px 10px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-1)', fontSize: 11,
          }}
        >
          + Track
        </button>
      </div>

      {/* Timeline ruler + tracks */}
      <div style={{ height: 100, overflow: 'hidden', position: 'relative' }}>
        {/* Ruler */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '0 160px', height: 22,
          borderBottom: '1px solid var(--border-light)',
          fontSize: 10, color: 'var(--text-3)',
          gap: 0,
        }}>
          {['0s', '0.2s', '0.4s', '0.6s', '0.8s', '1.0s'].map((t, i) => (
            <span key={t} style={{ flex: 1 }}>{t}</span>
          ))}
        </div>

        {/* Empty tracks placeholder */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: 78, color: 'var(--text-3)', fontSize: 11,
        }}>
          Add tracks in Phase 2
        </div>

        {/* Playhead */}
        <div style={{
          position: 'absolute', top: 0, left: 160 + 4,
          width: 2, height: '100%', background: '#ef4444', pointerEvents: 'none',
        }} />
      </div>
    </div>
  )
}

function PlayBtn({ icon, title, onClick, small }: { icon: string; title: string; onClick: () => void; small?: boolean }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: small ? 22 : 26, height: small ? 22 : 26,
        borderRadius: 'var(--radius-sm)',
        background: 'transparent', color: 'var(--text-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12,
        transition: 'color 0.1s',
      }}
    >
      {icon}
    </button>
  )
}

function CoordInput({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <span style={{ color: 'var(--text-3)' }}>{label}</span>
      <input
        readOnly
        value={value}
        style={{
          width: 40, background: 'transparent', color: 'var(--text-1)',
          border: 'none', textAlign: 'center', fontFamily: 'var(--font-mono)',
          fontSize: 11, padding: '1px 2px',
        }}
      />
    </div>
  )
}

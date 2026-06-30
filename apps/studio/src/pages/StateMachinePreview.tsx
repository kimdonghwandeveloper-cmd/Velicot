import React from 'react'
import { DEFAULT_FSM_DOCUMENT } from '@velicot/fsm'
import { StateMachinePanel } from '../components/StateMachinePanel'

interface Props {
  onBack: () => void
}

export function StateMachinePreview({ onBack }: Props) {
  const [fsmDoc, setFsmDoc] = React.useState(DEFAULT_FSM_DOCUMENT)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <header style={{
        height: 48, display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
        padding: '0 16px', flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            padding: '5px 12px', borderRadius: 6, fontSize: 12,
            border: '1px solid var(--border)', background: 'var(--bg-elevated)',
            color: 'var(--text-2)', cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>
          State Machine Preview
        </span>
      </header>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <StateMachinePanel fsmDoc={fsmDoc} onFsmDocChange={setFsmDoc} />
      </div>
    </div>
  )
}

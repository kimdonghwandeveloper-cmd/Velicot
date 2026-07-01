import React, { useState } from 'react'
import { DEFAULT_FSM_DOCUMENT, type FsmDocument } from '@velicot/fsm'
import { StateMachinePanel } from '../components/StateMachinePanel'

interface Props {
  onBack: () => void
}

export function StateMachinePreview({ onBack }: Props) {
  const [document, setDocument] = useState<FsmDocument>(DEFAULT_FSM_DOCUMENT)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header style={{
        height: 52,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          title="Back to Home"
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: 'var(--accent)',
            color: '#fff',
          }}
        >
          ←
        </button>
        <span style={{ color: 'var(--text-1)', fontSize: 13, fontWeight: 600 }}>
          State Machine Preview
        </span>
      </header>
      <StateMachinePanel fsmDoc={document} onFsmDocChange={setDocument} />
    </div>
  )
}

import React, { useCallback, useRef, useState } from 'react'
import {
  useStateMachine,
  DEFAULT_FSM_DOCUMENT,
  parseFsmDocument,
  type FsmDocument,
  type CharacterState,
} from '@velicot/fsm'

const STATE_COLORS: Record<CharacterState, string> = {
  idle: '#6366f1',
  working: '#f59e0b',
  done: '#22c55e',
  error: '#ef4444',
}

const STATE_ICONS: Record<CharacterState, string> = {
  idle: '◉',
  working: '⟳',
  done: '✓',
  error: '✕',
}

interface Props {
  fsmDoc: FsmDocument
  onFsmDocChange: (doc: FsmDocument) => void
}

export function StateMachinePanel({ fsmDoc, onFsmDocChange }: Props) {
  const [log, setLog] = useState<string[]>([])
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [jsonText, setJsonText] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString()
    setLog((prev) => [`[${ts}] ${msg}`, ...prev].slice(0, 50))
  }, [])

  const { machineState, sendInput } = useStateMachine(fsmDoc, {
    onTransition: (prev, next, animFile) => {
      addLog(`${prev} → ${next}  (${animFile})`)
    },
  })

  const handleStatusClick = (status: CharacterState) => {
    sendInput('status', status)
  }

  const handleExportFsm = () => {
    const json = JSON.stringify(fsmDoc, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'state-machine.fsm.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportFsm = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = parseFsmDocument(JSON.parse(String(ev.target?.result ?? '')))
        onFsmDocChange(parsed)
        setJsonText(null)
        setJsonError(null)
        addLog(`Loaded "${file.name}"`)
      } catch (err) {
        setJsonError(err instanceof Error ? err.message : 'Parse error')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleJsonEdit = (text: string) => {
    setJsonText(text)
    try {
      const parsed = parseFsmDocument(JSON.parse(text))
      setJsonError(null)
      onFsmDocChange(parsed)
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : 'Invalid FSM document')
    }
  }

  const displayJson = jsonText ?? JSON.stringify(fsmDoc, null, 2)

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%' }}>
      {/* Left: diagram + controls */}
      <div style={{
        width: 360, flexShrink: 0, borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ color: 'var(--text-1)', fontWeight: 600, fontSize: 13 }}>State Machine</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.fsm.json"
              style={{ display: 'none' }}
              onChange={handleImportFsm}
            />
            <SmallBtn onClick={() => fileInputRef.current?.click()}>Import</SmallBtn>
            <SmallBtn onClick={handleExportFsm}>Export</SmallBtn>
          </div>
        </div>

        {/* State diagram */}
        <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
          <div style={{ color: 'var(--text-3)', fontSize: 11, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
            States
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {fsmDoc.states.map((state) => {
              const isActive = machineState.currentState === state
              const color = STATE_COLORS[state]
              return (
                <div
                  key={state}
                  style={{
                    borderRadius: 8,
                    border: `2px solid ${isActive ? color : 'var(--border)'}`,
                    background: isActive ? `${color}22` : 'var(--bg-elevated)',
                    padding: '10px 12px',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 16,
                      color: isActive ? color : 'var(--text-3)',
                      transition: 'color 0.2s',
                    }}>
                      {STATE_ICONS[state]}
                    </span>
                    <span style={{
                      fontSize: 12, fontWeight: isActive ? 700 : 400,
                      color: isActive ? color : 'var(--text-2)',
                      textTransform: 'capitalize',
                    }}>
                      {state}
                    </span>
                    {state === fsmDoc.default && (
                      <span style={{
                        fontSize: 9, color: 'var(--text-3)',
                        border: '1px solid var(--border)',
                        borderRadius: 3, padding: '1px 4px', marginLeft: 'auto',
                      }}>
                        default
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>
                    {fsmDoc.animations[state]}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Transitions list */}
        <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
          <div style={{ color: 'var(--text-3)', fontSize: 11, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
            Transitions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {fsmDoc.transitions.map((t, i) => {
              const isActive =
                machineState.currentState === t.from
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 8px', borderRadius: 5,
                  background: isActive ? 'var(--bg-overlay)' : 'transparent',
                  fontSize: 12,
                }}>
                  <span style={{ color: STATE_COLORS[t.from], fontWeight: 600 }}>{t.from}</span>
                  <span style={{ color: 'var(--text-3)' }}>→</span>
                  <span style={{ color: STATE_COLORS[t.to], fontWeight: 600 }}>{t.to}</span>
                  <span style={{ color: 'var(--text-3)', marginLeft: 'auto', fontSize: 10 }}>
                    {t.input}={t.when}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Status input simulator */}
        <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
          <div style={{ color: 'var(--text-3)', fontSize: 11, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
            Send status input
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {fsmDoc.states.map((state) => {
              const color = STATE_COLORS[state]
              const reachable = fsmDoc.transitions.some(
                (t) => t.from === machineState.currentState && t.input === 'status' && t.when === state,
              )
              return (
                <button
                  key={state}
                  onClick={() => handleStatusClick(state)}
                  disabled={!reachable}
                  style={{
                    padding: '7px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                    border: `1px solid ${reachable ? color : 'var(--border)'}`,
                    background: reachable ? `${color}18` : 'transparent',
                    color: reachable ? color : 'var(--text-3)',
                    cursor: reachable ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s', textTransform: 'capitalize',
                  }}
                >
                  {state}
                </button>
              )
            })}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-3)' }}>
            Current state: <span style={{ color: STATE_COLORS[machineState.currentState], fontWeight: 600 }}>
              {machineState.currentState}
            </span>
          </div>
        </div>

        {/* Transition log */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ color: 'var(--text-3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
              Transition log
            </div>
            <SmallBtn onClick={() => setLog([])}>Clear</SmallBtn>
          </div>
          <div style={{
            flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            {log.length === 0 ? (
              <div style={{ color: 'var(--text-3)', fontSize: 11 }}>No transitions yet.</div>
            ) : (
              log.map((entry, i) => (
                <div key={i} style={{ fontSize: 11, color: 'var(--text-2)', fontFamily: 'monospace' }}>
                  {entry}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Right: JSON editor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ color: 'var(--text-1)', fontWeight: 600, fontSize: 13 }}>FSM Document</span>
          <SmallBtn onClick={() => {
            setJsonText(null)
            setJsonError(null)
            onFsmDocChange(DEFAULT_FSM_DOCUMENT)
          }}>
            Reset to default
          </SmallBtn>
        </div>
        {jsonError && (
          <div style={{
            margin: '8px 16px 0', padding: '6px 10px',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 5, color: '#f87171', fontSize: 11,
          }}>
            {jsonError}
          </div>
        )}
        <textarea
          value={displayJson}
          onChange={(e) => handleJsonEdit(e.target.value)}
          spellCheck={false}
          style={{
            flex: 1, resize: 'none', border: 'none', outline: 'none',
            background: 'var(--bg-base)', color: 'var(--text-1)',
            fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6,
            padding: 16,
          }}
        />
      </div>
    </div>
  )
}

function SmallBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 10px', fontSize: 11, borderRadius: 4,
        border: '1px solid var(--border)', background: 'var(--bg-elevated)',
        color: 'var(--text-2)', cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

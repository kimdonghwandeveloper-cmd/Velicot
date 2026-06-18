import React, { useCallback, useRef, useState } from 'react'
import type {
  AnimationData,
  AnimationTrack,
  AnimatableProperty,
  EasingDef,
} from '@velicot/editor'

interface TimelineProps {
  animation: AnimationData
  onAnimationChange: (next: AnimationData) => void
  currentTime: number
  isPlaying: boolean
  onPlay: () => void
  onPause: () => void
  onSeek: (ms: number) => void
  selectedLayerId: string | null
}

const LABEL_WIDTH = 140
const PX_PER_MS_DEFAULT = 0.3

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const remaining = Math.floor(ms % 1000)
  return `${s}:${String(Math.floor(ms / 1000 * 60) % 60).padStart(2, '0')}.${String(remaining).padStart(3, '0')}`
}

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

const PROPERTY_OPTIONS: AnimatableProperty[] = ['opacity', 'transform', 'path']

const EASING_OPTIONS: Array<{ label: string; value: EasingDef['type'] }> = [
  { label: 'Linear', value: 'linear' },
  { label: 'Ease In', value: 'easeIn' },
  { label: 'Ease Out', value: 'easeOut' },
  { label: 'Ease In Out', value: 'easeInOut' },
  { label: 'Cubic Bezier', value: 'cubicBezier' },
]

export function Timeline({
  animation,
  onAnimationChange,
  currentTime,
  isPlaying,
  onPlay,
  onPause,
  onSeek,
  selectedLayerId,
}: TimelineProps) {
  const [pxPerMs, setPxPerMs] = useState(PX_PER_MS_DEFAULT)
  const [selectedKf, setSelectedKf] = useState<{ trackId: string; kfIndex: number } | null>(null)
  const [showAddTrack, setShowAddTrack] = useState(false)
  const [addTrackProp, setAddTrackProp] = useState<AnimatableProperty>('opacity')
  const rulerRef = useRef<HTMLDivElement>(null)
  const draggingKf = useRef<{ trackId: string; kfIndex: number } | null>(null)

  const totalWidth = animation.duration * pxPerMs

  // Scrub on ruler click/drag
  const handleRulerPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = rulerRef.current?.getBoundingClientRect()
      if (!rect) return
      const seek = (clientX: number) => {
        const x = clientX - rect.left - LABEL_WIDTH
        const ms = Math.max(0, Math.min(animation.duration, x / pxPerMs))
        onSeek(ms)
      }
      seek(e.clientX)
      const onMove = (ev: PointerEvent) => seek(ev.clientX)
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [animation.duration, pxPerMs, onSeek],
  )

  // Keyframe drag
  const handleKfPointerDown = useCallback(
    (e: React.PointerEvent, trackId: string, kfIndex: number) => {
      e.stopPropagation()
      draggingKf.current = { trackId, kfIndex }
      setSelectedKf({ trackId, kfIndex })
      const rect = rulerRef.current?.getBoundingClientRect()
      if (!rect) return
      const onMove = (ev: PointerEvent) => {
        if (!draggingKf.current) return
        const x = ev.clientX - rect.left - LABEL_WIDTH
        const ms = Math.max(0, Math.min(animation.duration, x / pxPerMs))
        const tracks = animation.tracks.map((t) => {
          if (t.id !== trackId) return t
          const kfs = t.keyframes.map((kf, i) =>
            i === kfIndex ? { ...kf, time: Math.round(ms) } : kf,
          )
          return { ...t, keyframes: [...kfs].sort((a, b) => a.time - b.time) }
        })
        onAnimationChange({ ...animation, tracks })
      }
      const onUp = () => {
        draggingKf.current = null
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [animation, pxPerMs, onAnimationChange],
  )

  const addTrack = () => {
    if (!selectedLayerId) return
    const id = `track_${selectedLayerId}_${addTrackProp}_${Date.now()}`
    const newTrack: AnimationTrack = {
      id,
      targetLayerId: selectedLayerId,
      property: addTrackProp,
      keyframes: [
        { time: 0, value: addTrackProp === 'opacity' ? 1 : 0, easing: { type: 'linear' } },
        { time: animation.duration, value: addTrackProp === 'opacity' ? 0 : 1, easing: { type: 'linear' } },
      ],
    }
    onAnimationChange({ ...animation, tracks: [...animation.tracks, newTrack] })
    setShowAddTrack(false)
  }

  const removeTrack = (trackId: string) => {
    onAnimationChange({ ...animation, tracks: animation.tracks.filter((t) => t.id !== trackId) })
    if (selectedKf?.trackId === trackId) setSelectedKf(null)
  }

  const updateKfEasing = (easing: EasingDef) => {
    if (!selectedKf) return
    const tracks = animation.tracks.map((t) => {
      if (t.id !== selectedKf.trackId) return t
      const kfs = t.keyframes.map((kf, i) =>
        i === selectedKf.kfIndex ? { ...kf, easing } : kf,
      )
      return { ...t, keyframes: kfs }
    })
    onAnimationChange({ ...animation, tracks })
  }

  const updateKfValue = (raw: string) => {
    if (!selectedKf) return
    const tracks = animation.tracks.map((t) => {
      if (t.id !== selectedKf.trackId) return t
      const kfs = t.keyframes.map((kf, i) => {
        if (i !== selectedKf.kfIndex) return kf
        const parsed = parseFloat(raw)
        return { ...kf, value: isNaN(parsed) ? raw : parsed }
      })
      return { ...t, keyframes: kfs }
    })
    onAnimationChange({ ...animation, tracks })
  }

  const selectedKfData = selectedKf
    ? animation.tracks
        .find((t) => t.id === selectedKf.trackId)
        ?.keyframes[selectedKf.kfIndex]
    : null

  const playheadX = LABEL_WIDTH + currentTime * pxPerMs

  return (
    <div style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)', flexShrink: 0, userSelect: 'none', display: 'flex', flexDirection: 'column' }}>
      {/* Playback controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderBottom: '1px solid var(--border-light)' }}>
        <PlayBtn icon="⏮" title="Go to start" onClick={() => onSeek(0)} />
        <button
          title={isPlaying ? 'Pause' : 'Play'}
          onClick={isPlaying ? onPause : onPlay}
          style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12,
          }}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <PlayBtn icon="⏭" title="Go to end" onClick={() => onSeek(animation.duration)} />

        <span style={{ color: 'var(--accent-light)', fontFamily: 'var(--font-mono)', fontSize: 12, marginLeft: 4 }}>
          {formatTime(currentTime)}
        </span>
        <span style={{ color: 'var(--text-3)', fontSize: 11 }}>/</span>
        <span style={{ color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          {formatTime(animation.duration)}
        </span>

        <div style={{ flex: 1 }} />
        <span style={{ color: 'var(--text-2)', fontSize: 11 }}>{animation.fps} fps</span>
        <PlayBtn icon="−" title="Zoom out" onClick={() => setPxPerMs((p) => Math.max(0.05, p * 0.7))} small />
        <PlayBtn icon="+" title="Zoom in" onClick={() => setPxPerMs((p) => Math.min(2, p * 1.4))} small />
        <button
          onClick={() => setShowAddTrack(true)}
          disabled={!selectedLayerId}
          style={{
            padding: '3px 10px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)', background: 'transparent',
            color: selectedLayerId ? 'var(--text-1)' : 'var(--text-3)',
            fontSize: 11, cursor: selectedLayerId ? 'pointer' : 'not-allowed',
          }}
        >
          + Track
        </button>
      </div>

      {/* Timeline area */}
      <div style={{ height: 160, overflow: 'auto', position: 'relative' }} ref={rulerRef}>
        <div style={{ minWidth: LABEL_WIDTH + totalWidth + 40, position: 'relative' }}>
          {/* Ruler */}
          <div
            style={{
              display: 'flex', alignItems: 'center', height: 22,
              borderBottom: '1px solid var(--border-light)',
              fontSize: 10, color: 'var(--text-3)',
              position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 2,
              cursor: 'crosshair',
            }}
            onPointerDown={handleRulerPointerDown}
          >
            <div style={{ width: LABEL_WIDTH, flexShrink: 0 }} />
            {generateRulerTicks(animation.duration, pxPerMs).map((tick) => (
              <div
                key={tick.ms}
                style={{
                  position: 'absolute',
                  left: LABEL_WIDTH + tick.ms * pxPerMs,
                  fontSize: 9, color: 'var(--text-3)',
                  paddingLeft: 3, whiteSpace: 'nowrap',
                }}
              >
                {tick.label}
              </div>
            ))}
          </div>

          {/* Tracks */}
          {animation.tracks.length === 0 ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: 80, color: 'var(--text-3)', fontSize: 11,
            }}>
              Select a layer and click "+ Track" to add animation
            </div>
          ) : (
            animation.tracks.map((track) => (
              <div key={track.id} style={{ display: 'flex', height: 28, borderBottom: '1px solid var(--border-light)', alignItems: 'center', position: 'relative' }}>
                {/* Label */}
                <div style={{
                  width: LABEL_WIDTH, flexShrink: 0, paddingLeft: 12,
                  fontSize: 11, color: 'var(--text-2)', display: 'flex',
                  alignItems: 'center', gap: 4,
                  position: 'sticky', left: 0, background: 'var(--bg-surface)', zIndex: 1,
                }}>
                  <span style={{
                    maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {track.targetLayerId.slice(0, 12)}
                  </span>
                  <span style={{ color: 'var(--accent-light)', fontSize: 10 }}>{track.property}</span>
                  <button
                    onClick={() => removeTrack(track.id)}
                    style={{ marginLeft: 'auto', color: 'var(--text-3)', fontSize: 14, paddingRight: 6 }}
                    title="Remove track"
                  >×</button>
                </div>

                {/* Track area */}
                <div style={{ position: 'relative', flex: 1, height: '100%' }}>
                  {track.keyframes.map((kf, kfIdx) => {
                    const isSelected = selectedKf?.trackId === track.id && selectedKf.kfIndex === kfIdx
                    return (
                      <div
                        key={kfIdx}
                        onPointerDown={(e) => handleKfPointerDown(e, track.id, kfIdx)}
                        title={`t=${formatMs(kf.time)} val=${kf.value}`}
                        style={{
                          position: 'absolute',
                          left: kf.time * pxPerMs - 5,
                          top: '50%',
                          transform: 'translateY(-50%) rotate(45deg)',
                          width: 10, height: 10,
                          background: isSelected ? 'var(--accent-light)' : 'var(--accent)',
                          border: `2px solid ${isSelected ? '#fff' : 'var(--bg-surface)'}`,
                          cursor: 'grab',
                          zIndex: 1,
                        }}
                      />
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Playhead */}
        <div style={{
          position: 'absolute', top: 0, left: playheadX,
          width: 2, height: '100%', background: '#ef4444',
          pointerEvents: 'none', zIndex: 3,
        }} />
      </div>

      {/* Keyframe editor panel */}
      {selectedKfData && (
        <div style={{
          borderTop: '1px solid var(--border-light)',
          padding: '6px 12px',
          display: 'flex', alignItems: 'center', gap: 16, fontSize: 11,
        }}>
          <span style={{ color: 'var(--text-2)' }}>Keyframe at {formatMs(selectedKfData.time)}</span>

          <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-2)' }}>
            Value
            <input
              value={String(selectedKfData.value)}
              onChange={(e) => updateKfValue(e.target.value)}
              style={{
                width: 70, background: 'var(--bg-elevated)',
                border: '1px solid var(--border)', color: 'var(--text-1)',
                borderRadius: 'var(--radius-sm)', padding: '2px 6px',
                fontFamily: 'var(--font-mono)',
              }}
            />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-2)' }}>
            Easing
            <select
              value={selectedKfData.easing.type}
              onChange={(e) =>
                updateKfEasing({ type: e.target.value as EasingDef['type'] })
              }
              style={{
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                color: 'var(--text-1)', borderRadius: 'var(--radius-sm)',
                padding: '2px 6px',
              }}
            >
              {EASING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          {selectedKfData.easing.type === 'cubicBezier' && (
            <CubicBezierInputs
              params={selectedKfData.easing.params ?? [0.42, 0, 0.58, 1]}
              onChange={(params) => updateKfEasing({ type: 'cubicBezier', params })}
            />
          )}
        </div>
      )}

      {/* Add Track modal */}
      {showAddTrack && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
          }}
          onClick={() => setShowAddTrack(false)}
        >
          <div
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: 20, minWidth: 280,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Add Track</div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 8 }}>
              Layer: <span style={{ color: 'var(--accent-light)' }}>{selectedLayerId}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 8 }}>Property</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {PROPERTY_OPTIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => setAddTrackProp(p)}
                  style={{
                    padding: '4px 12px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid',
                    borderColor: addTrackProp === p ? 'var(--accent)' : 'var(--border)',
                    background: addTrackProp === p ? 'rgba(124,58,237,0.2)' : 'transparent',
                    color: addTrackProp === p ? 'var(--accent-light)' : 'var(--text-2)',
                    fontSize: 11,
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAddTrack(false)}
                style={{ padding: '5px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: 11 }}
              >
                Cancel
              </button>
              <button
                onClick={addTrack}
                style={{ padding: '5px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11 }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CubicBezierInputs({
  params,
  onChange,
}: {
  params: [number, number, number, number]
  onChange: (p: [number, number, number, number]) => void
}) {
  const labels = ['x1', 'y1', 'x2', 'y2']
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {params.map((v, i) => (
        <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text-3)', fontSize: 10 }}>
          {labels[i]}
          <input
            type="number"
            step="0.01"
            min="-1"
            max="1"
            value={v}
            onChange={(e) => {
              const next = [...params] as [number, number, number, number]
              next[i] = parseFloat(e.target.value) || 0
              onChange(next)
            }}
            style={{
              width: 44, background: 'var(--bg-elevated)',
              border: '1px solid var(--border)', color: 'var(--text-1)',
              borderRadius: 'var(--radius-sm)', padding: '2px 4px',
              fontFamily: 'var(--font-mono)', fontSize: 10,
            }}
          />
        </label>
      ))}
    </div>
  )
}

function PlayBtn({
  icon, title, onClick, small,
}: {
  icon: string; title: string; onClick: () => void; small?: boolean
}) {
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
      }}
    >
      {icon}
    </button>
  )
}

function generateRulerTicks(
  durationMs: number,
  pxPerMs: number,
): Array<{ ms: number; label: string }> {
  const totalPx = durationMs * pxPerMs
  const targetTickCount = Math.min(20, Math.max(5, Math.floor(totalPx / 60)))
  const rawStep = durationMs / targetTickCount
  const step = roundToNiceInterval(rawStep)
  const ticks: Array<{ ms: number; label: string }> = []
  for (let ms = 0; ms <= durationMs; ms += step) {
    ticks.push({ ms, label: formatMs(ms) })
  }
  return ticks
}

function roundToNiceInterval(ms: number): number {
  const nice = [50, 100, 200, 250, 500, 1000, 2000, 5000, 10000]
  return nice.find((n) => n >= ms) ?? nice[nice.length - 1]
}

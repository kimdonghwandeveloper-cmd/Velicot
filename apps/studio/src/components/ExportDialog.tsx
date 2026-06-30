import React, { useState, useCallback } from 'react'
import { exportAnimation, type ExportFormat, type ExportProgress } from '@velicot/export'
import type { CanvasModel, AnimationData } from '@velicot/editor'

interface Props {
  filename: string
  canvasModel: CanvasModel
  animationData: AnimationData
  onClose: () => void
}

const FORMAT_OPTIONS: { value: ExportFormat; label: string; ext: string }[] = [
  { value: 'mp4', label: 'MP4 (H.264)', ext: 'mp4' },
  { value: 'webm', label: 'WebM (VP9)', ext: 'webm' },
  { value: 'gif', label: 'Animated GIF', ext: 'gif' },
]

export function ExportDialog({ filename, canvasModel, animationData, onClose }: Props) {
  const [format, setFormat] = useState<ExportFormat>('mp4')
  const [fps, setFps] = useState(30)
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isExporting = progress !== null && progress.phase !== 'done' && progress.phase !== 'error'
  const isDone = progress?.phase === 'done'

  const handleExport = useCallback(async () => {
    setError(null)
    setProgress({ phase: 'rendering', frameIndex: 0, totalFrames: 0 })

    try {
      const output = await exportAnimation(
        canvasModel,
        animationData,
        { format, fps, width: canvasModel.canvas.width, height: canvasModel.canvas.height },
        (p: ExportProgress) => setProgress({ ...p }),
      )

      const ext = FORMAT_OPTIONS.find((f) => f.value === format)?.ext ?? format
      const baseName = filename.replace(/\.[^.]+$/, '')
      const arrayBuffer = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer
      const blob = new Blob([arrayBuffer], { type: mimeType(format) })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${baseName}.${ext}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setProgress({ phase: 'error', error: msg })
    }
  }, [canvasModel, animationData, format, fps, filename])

  const progressLabel = (): string => {
    if (!progress) return ''
    if (progress.phase === 'rendering') {
      const f = progress.frameIndex ?? 0
      const t = progress.totalFrames ?? 0
      return `Rendering frame ${f} / ${t}`
    }
    if (progress.phase === 'encoding') {
      const pct = Math.round((progress.ratio ?? 0) * 100)
      return `Encoding… ${pct}%`
    }
    if (progress.phase === 'done') return 'Done!'
    if (progress.phase === 'error') return 'Export failed'
    return ''
  }

  const progressRatio = (): number => {
    if (!progress) return 0
    if (progress.phase === 'rendering') {
      const f = progress.frameIndex ?? 0
      const t = progress.totalFrames ?? 1
      return t === 0 ? 0 : (f / t) * 0.5
    }
    if (progress.phase === 'encoding') return 0.5 + (progress.ratio ?? 0) * 0.5
    if (progress.phase === 'done') return 1
    return 0
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        width: 400,
        padding: 24,
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-1)', fontWeight: 700, fontSize: 15 }}>
            Export Video
          </span>
          <button
            onClick={onClose}
            disabled={isExporting}
            style={{
              width: 24, height: 24, borderRadius: 6,
              background: 'var(--bg-elevated)', color: 'var(--text-2)',
              fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>

        {/* Format selector */}
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Format
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {FORMAT_OPTIONS.map((f) => (
              <button
                key={f.value}
                onClick={() => !isExporting && setFormat(f.value)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 8,
                  border: `1.5px solid ${format === f.value ? 'var(--accent)' : 'var(--border)'}`,
                  background: format === f.value ? 'rgba(99,102,241,0.12)' : 'var(--bg-elevated)',
                  color: format === f.value ? 'var(--accent)' : 'var(--text-2)',
                  fontSize: 12, fontWeight: format === f.value ? 700 : 400,
                  cursor: isExporting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* FPS selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap' }}>
            Frame Rate
          </label>
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            {[15, 24, 30, 60].map((f) => (
              <button
                key={f}
                onClick={() => !isExporting && setFps(f)}
                style={{
                  width: 40, height: 28, borderRadius: 6,
                  border: `1px solid ${fps === f ? 'var(--accent)' : 'var(--border)'}`,
                  background: fps === f ? 'rgba(99,102,241,0.12)' : 'var(--bg-elevated)',
                  color: fps === f ? 'var(--accent)' : 'var(--text-2)',
                  fontSize: 12, fontWeight: fps === f ? 700 : 400,
                  cursor: isExporting ? 'not-allowed' : 'pointer',
                }}
              >
                {f}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>fps</span>
        </div>

        {/* Canvas size (read-only) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Size
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
            {canvasModel.canvas.width} × {canvasModel.canvas.height} px
          </span>
        </div>

        {/* Progress bar */}
        {progress && (
          <div>
            <div style={{
              height: 6, borderRadius: 3,
              background: 'var(--bg-elevated)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${progressRatio() * 100}%`,
                background: progress.phase === 'error' ? '#ef4444' : 'var(--accent)',
                transition: 'width 0.2s',
                borderRadius: 3,
              }} />
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: progress.phase === 'error' ? '#f87171' : 'var(--text-2)' }}>
              {progressLabel()}
            </div>
          </div>
        )}

        {/* Error detail */}
        {error && (
          <div style={{
            padding: '8px 12px', borderRadius: 6,
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#f87171', fontSize: 11,
          }}>
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={isExporting}
            style={{
              padding: '8px 18px', borderRadius: 8, fontSize: 13,
              border: '1px solid var(--border)', background: 'var(--bg-elevated)',
              color: 'var(--text-2)', cursor: isExporting ? 'not-allowed' : 'pointer',
            }}
          >
            {isDone ? 'Close' : 'Cancel'}
          </button>
          {!isDone && (
            <button
              onClick={handleExport}
              disabled={isExporting}
              style={{
                padding: '8px 20px', borderRadius: 8, fontSize: 13,
                background: isExporting ? 'rgba(99,102,241,0.5)' : 'var(--accent)',
                color: '#fff', fontWeight: 600,
                cursor: isExporting ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {isExporting ? 'Exporting…' : 'Export'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function mimeType(format: ExportFormat): string {
  if (format === 'mp4') return 'video/mp4'
  if (format === 'webm') return 'video/webm'
  return 'image/gif'
}

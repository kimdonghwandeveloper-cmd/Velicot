import React, { useCallback, useRef, useState } from 'react'
import {
  useSvgCanvas, useHistory, serializeModel, usePlayback, applyAnimationFrame,
  DEFAULT_ANIMATION_DATA, type CanvasModel, type AnimationData,
} from '@velicot/editor'
import { EditorToolbar, type EditorToolId } from '../components/EditorToolbar'
import { LayersPanel } from '../components/LayersPanel'
import { Timeline } from '../components/Timeline'
import { saveRecent } from './Home'

type EditorTab = 'Design' | 'Animate' | 'State Machine'

interface Props {
  filename: string
  initialModel: CanvasModel | null
  onBackToHome: () => void
}

export function Editor({ filename, initialModel, onBackToHome }: Props) {
  const [activeTab, setActiveTab] = useState<EditorTab>('Animate')
  const [activeTool, setActiveTool] = useState<EditorToolId>('select')
  const [model, setModel] = useState<CanvasModel | null>(initialModel)
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [animation, setAnimation] = useState<AnimationData>(
    initialModel?.animation ?? { ...DEFAULT_ANIMATION_DATA },
  )
  const svgRootRef = useRef<SVGSVGElement | null>(null)

  const handleModelChange = useCallback((m: CanvasModel) => setModel(m), [])

  const { containerRef, canvas, setTool, getSvgString } = useSvgCanvas({
    width: initialModel?.canvas.width ?? 512,
    height: initialModel?.canvas.height ?? 512,
    initialSvgString: initialModel?.svgString,
    onModelChange: handleModelChange,
  })

  const { undo, redo, canUndo } = useHistory(canvas)

  const handleAnimationTick = useCallback(
    (frameValues: Parameters<typeof applyAnimationFrame>[1]) => {
      const svgRoot = svgRootRef.current
        ?? containerRef.current?.querySelector<SVGSVGElement>('svg')
        ?? null
      if (svgRoot) {
        svgRootRef.current = svgRoot
        applyAnimationFrame(svgRoot, frameValues)
      }
    },
    [containerRef],
  )

  const { currentTime, isPlaying, play, pause, seek } = usePlayback(
    animation,
    handleAnimationTick,
  )

  const handleAnimationChange = useCallback(
    (next: AnimationData) => {
      setAnimation(next)
      setModel((m) => m ? { ...m, animation: next } : m)
    },
    [],
  )

  const handleToolChange = (id: EditorToolId) => {
    setActiveTool(id)
    setTool(id as Parameters<typeof setTool>[0])
  }

  const handleExport = () => {
    if (!model) return
    // Reset animation-applied styles before capturing SVG so transient
    // playback values (opacity/transform) are not baked into the export.
    const svgRoot = svgRootRef.current
    if (svgRoot) {
      svgRoot.querySelectorAll<SVGGElement>('g[data-layer-id]').forEach((g) => {
        g.style.opacity = ''
        g.removeAttribute('transform')
      })
    }
    const modelWithSvg = { ...model, svgString: getSvgString(), animation }
    const json = serializeModel(modelWithSvg)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    saveRecent(filename, json)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top bar */}
      <header style={{
        height: 52, display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
        padding: '0 16px', flexShrink: 0,
      }}>
        {/* Logo + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <button
            onClick={onBackToHome}
            title="Back to Home"
            style={{
              width: 28, height: 28, background: 'var(--accent)', borderRadius: 6,
              color: '#fff', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >◆</button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.2 }}>
              SVG Motion Studio
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {filename}
            </div>
          </div>
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            style={{
              width: 26, height: 26, borderRadius: 'var(--radius-sm)',
              background: 'transparent', color: canUndo ? 'var(--text-2)' : 'var(--text-3)',
              fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >↺</button>
        </div>

        {/* Center tabs */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div style={{
            display: 'flex', background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)', padding: 3, gap: 2,
            border: '1px solid var(--border)',
          }}>
            {(['Design', 'Animate', 'State Machine'] as EditorTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '5px 16px', borderRadius: 6,
                  background: activeTab === tab ? 'var(--accent)' : 'transparent',
                  color: activeTab === tab ? '#fff' : 'var(--text-2)',
                  fontWeight: activeTab === tab ? 600 : 400,
                  fontSize: 12, transition: 'all 0.15s',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Right: zoom + export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            padding: '4px 8px', color: 'var(--text-2)', fontSize: 12,
          }}>
            <span style={{ fontSize: 11 }}>🔍</span>
            <span>100%</span>
          </div>
          <button
            onClick={handleExport}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--accent)', color: '#fff',
              borderRadius: 'var(--radius-sm)', padding: '6px 14px',
              fontWeight: 600, fontSize: 12,
            }}
          >
            <span style={{ fontSize: 12 }}>⬇</span> Export
          </button>
        </div>
      </header>

      {/* Main workspace */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <EditorToolbar activeTool={activeTool} onToolChange={handleToolChange} />

        {/* Canvas area */}
        <div style={{
          flex: 1, background: 'var(--bg-base)', overflow: 'auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
          backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}>
          {/* Artboard label */}
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', top: -20, left: 0,
              fontSize: 11, color: 'var(--text-3)',
            }}>
              Artboard 1 — {initialModel?.canvas.width ?? 512} × {initialModel?.canvas.height ?? 512}
            </div>

            {/* svgcanvas container */}
            <div
              ref={containerRef}
              style={{
                boxShadow: '0 0 0 1px var(--border), 0 8px 32px rgba(0,0,0,0.4)',
              }}
            />

            {/* Empty canvas overlay (shown when no shapes drawn) */}
            {(model?.layers.length ?? 0) === 0 && (
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <EmptyCanvasIcon />
                <span style={{ color: 'var(--text-3)', fontSize: 13 }}>Empty canvas</span>
                <span style={{ color: 'var(--text-3)', fontSize: 11 }}>
                  Use the pen or shape tools to draw
                </span>
              </div>
            )}
          </div>
        </div>

        <LayersPanel
          model={model}
          selectedLayerId={selectedLayerId}
          onSelectLayer={setSelectedLayerId}
        />
      </div>

      {/* Timeline */}
      <Timeline
        animation={animation}
        onAnimationChange={handleAnimationChange}
        currentTime={currentTime}
        isPlaying={isPlaying}
        onPlay={play}
        onPause={pause}
        onSeek={seek}
        selectedLayerId={selectedLayerId}
      />
    </div>
  )
}

function EmptyCanvasIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ opacity: 0.3 }}>
      <circle cx="16" cy="16" r="14" stroke="#6b6b8a" strokeWidth="1.5" strokeDasharray="4 3" />
      <line x1="16" y1="8" x2="16" y2="24" stroke="#6b6b8a" strokeWidth="1.5" />
      <line x1="8" y1="16" x2="24" y2="16" stroke="#6b6b8a" strokeWidth="1.5" />
    </svg>
  )
}

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  useSvgCanvas, useHistory, serializeModel, serializeKfm, usePlayback, applyAnimationFrame,
  resetAnimationFrame,
  DEFAULT_ANIMATION_DATA, type CanvasModel, type AnimationData,
} from '@velicot/editor'
import { DEFAULT_FSM_DOCUMENT, type FsmDocument } from '@velicot/fsm'
import { EditorToolbar, type EditorToolId } from '../components/EditorToolbar'
import { LayersPanel } from '../components/LayersPanel'
import { Timeline } from '../components/Timeline'
import { StateMachinePanel } from '../components/StateMachinePanel'
import { ExportDialog } from '../components/ExportDialog'
import { saveRecent } from './Home'

type EditorTab = 'Design' | 'Animate' | 'State Machine'

interface Props {
  filename: string
  initialModel: CanvasModel | null
  onBackToHome: () => void
}

export function Editor({ filename, initialModel, onBackToHome }: Props) {
  const [activeTab, setActiveTab] = useState<EditorTab>('Design')
  const [activeTool, setActiveTool] = useState<EditorToolId>('select')
  const [model, setModel] = useState<CanvasModel | null>(initialModel)
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [animation, setAnimation] = useState<AnimationData>(
    initialModel?.animation ?? { ...DEFAULT_ANIMATION_DATA },
  )
  const [fsmDoc, setFsmDoc] = useState<FsmDocument>(DEFAULT_FSM_DOCUMENT)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const svgRootRef = useRef<SVGSVGElement | null>(null)

  const handleModelChange = useCallback((m: CanvasModel) => setModel(m), [])

  const handleLayerSelect = useCallback((layerId: string) => {
    setSelectedLayerId(layerId)
  }, [])

  const { containerRef, canvas, setTool, getSvgString } = useSvgCanvas({
    width: initialModel?.canvas.width ?? 512,
    height: initialModel?.canvas.height ?? 512,
    initialSvgString: initialModel?.svgString,
    initialModel: initialModel ?? undefined,
    onModelChange: handleModelChange,
    onLayerSelect: handleLayerSelect,
  })

  const { undo, redo, canUndo } = useHistory(canvas)

  // Eagerly populate svgRootRef so export reset works even without prior playback.
  useEffect(() => {
    const svg = containerRef.current?.querySelector<SVGSVGElement>('svg')
    if (svg) svgRootRef.current = svg
  })

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

  const canvasAreaRef = useRef<HTMLDivElement>(null)
  const panStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null)

  // Hand/pan tool: intercept mouse events on the canvas scroll area
  useEffect(() => {
    const area = canvasAreaRef.current
    if (!area) return
    const onDown = (e: MouseEvent) => {
      if (activeTool !== 'hand') return
      e.preventDefault()
      panStartRef.current = { x: e.clientX, y: e.clientY, scrollLeft: area.scrollLeft, scrollTop: area.scrollTop }
    }
    const onMove = (e: MouseEvent) => {
      if (!panStartRef.current) return
      const dx = e.clientX - panStartRef.current.x
      const dy = e.clientY - panStartRef.current.y
      area.scrollLeft = panStartRef.current.scrollLeft - dx
      area.scrollTop = panStartRef.current.scrollTop - dy
    }
    const onUp = () => { panStartRef.current = null }
    area.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      area.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [activeTool])

  const handleAddLayer = useCallback(() => {
    if (!canvas) return
    const layerCount = (model?.layers.length ?? 0) + 1
    const name = `Layer ${layerCount}`
    const layerCanvas = canvas as unknown as { createLayer?: (layerName: string) => void }
    layerCanvas.createLayer?.(name)
  }, [canvas, model])

  const handleToolChange = useCallback((id: EditorToolId) => {
    setActiveTool(id)
    // 'hand' is handled by our pan listener — don't pass to SVGEdit
    if (id !== 'hand') {
      setTool(id)
    } else {
      // Switch SVGEdit back to select so it doesn't capture mouse events unexpectedly
      setTool('select')
    }
  }, [setTool])

  useEffect(() => {
    const keyToTool: Record<string, EditorToolId> = {
      v: 'select',
      a: 'line',
      p: 'fhpath',
      r: 'rect',
      o: 'ellipse',
      h: 'hand',
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return

      const tool = keyToTool[event.key.toLowerCase()]
      if (tool) {
        handleToolChange(tool)
        return
      }
      if (event.key === ' ' && activeTab === 'Animate') {
        event.preventDefault()
        if (isPlaying) pause()
        else play()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTab, handleToolChange, isPlaying, pause, play])

  useEffect(() => {
    if (activeTab === 'Animate') return
    if (isPlaying) pause()
    const svgRoot = svgRootRef.current
      ?? containerRef.current?.querySelector<SVGSVGElement>('svg')
      ?? null
    if (svgRoot) resetAnimationFrame(svgRoot)
  }, [activeTab, containerRef, isPlaying, pause])

  const handleExport = () => {
    if (!model) return
    // Reset animation-applied styles before capturing SVG so transient
    // playback values (opacity/transform) are not baked into the export.
    const svgRoot = svgRootRef.current
    if (svgRoot) {
      resetAnimationFrame(svgRoot)
    }
    const modelWithSvg = { ...model, svgString: getSvgString(), animation }
    const editorJson = serializeModel(modelWithSvg)
    const exportJson = serializeKfm(modelWithSvg)
    const blob = new Blob([exportJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    saveRecent(filename, editorJson)
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
            title="Save project as .kfm.json"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--bg-elevated)', color: 'var(--text-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '6px 14px',
              fontWeight: 500, fontSize: 12,
            }}
          >
            Save .kfm
          </button>
          <button
            onClick={() => setShowExportDialog(true)}
            title="Export animation as mp4/webm/gif"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--accent)', color: '#fff',
              borderRadius: 'var(--radius-sm)', padding: '6px 14px',
              fontWeight: 600, fontSize: 12,
            }}
          >
            <span style={{ fontSize: 12 }}>⬇</span> Export Video
          </button>
        </div>
      </header>

      {/* Main workspace */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {activeTab !== 'State Machine' && (
          <EditorToolbar activeTool={activeTool} onToolChange={handleToolChange} />
        )}

        {activeTab === 'State Machine' ? (
          <StateMachinePanel fsmDoc={fsmDoc} onFsmDocChange={setFsmDoc} />
        ) : (
          <>
            {/* Canvas area */}
            <div ref={canvasAreaRef} style={{
              flex: 1, background: 'var(--bg-base)', overflow: 'auto',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
              cursor: activeTool === 'hand' ? 'grab' : 'default',
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
              onAddLayer={handleAddLayer}
              onSelectLayer={(id) => {
                setSelectedLayerId(id)
                const layer = model?.layers.find((l) => l.id === id)
                if (layer && canvas) {
                  try {
                    const layerCanvas = canvas as unknown as {
                      setCurrentLayer?: (layerName: string) => void
                    }
                    layerCanvas.setCurrentLayer?.(layer.name)
                  } catch { /* SVGEdit may not support this in all versions */ }
                }
              }}
            />
          </>
        )}
      </div>

      {/* Timeline belongs to animation mode only. */}
      {activeTab === 'Animate' && (
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
      )}

      {/* Export Video dialog */}
      {showExportDialog && model && (
        <ExportDialog
          filename={filename}
          canvasModel={{ ...model, animation }}
          animationData={animation}
          onClose={() => setShowExportDialog(false)}
        />
      )}
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

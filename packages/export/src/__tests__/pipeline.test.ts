import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CanvasModel, AnimationData } from '@velicot/editor'
import type { ExportOptions, ExportProgress } from '../types'

vi.mock('@velicot/editor', () => ({
  interpolateValue: vi.fn(() => 0),
  applyAnimationFrame: vi.fn(),
}))

const mockFrames = [new Uint8Array([0x89, 0x50, 0x4e, 0x47])]
const mockOutput = new Uint8Array([0x00, 0x00, 0x00, 0x20])

vi.mock('../renderer', () => ({
  renderAllFrames: vi.fn().mockImplementation(
    async (_cm: unknown, _ad: unknown, _opts: unknown, onProgress: (i: number, t: number) => void) => {
      onProgress(1, 1)
      return mockFrames
    },
  ),
}))

vi.mock('../encoder', () => ({
  encodeFrames: vi.fn().mockImplementation(
    async (_frames: unknown, _opts: unknown, onProgress: (r: number) => void) => {
      onProgress(1.0)
      return mockOutput
    },
  ),
}))

const baseCanvas: CanvasModel = {
  version: '1.0',
  canvas: { width: 64, height: 64 },
  layers: [],
}

const baseAnimation: AnimationData = {
  duration: 1000,
  fps: 30,
  tracks: [],
  loop: false,
}

const baseOptions: ExportOptions = { format: 'mp4', fps: 30, width: 64, height: 64 }

describe('exportAnimation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the encoded Uint8Array', async () => {
    const { exportAnimation } = await import('../pipeline')
    const result = await exportAnimation(baseCanvas, baseAnimation, baseOptions)
    expect(result).toBe(mockOutput)
  })

  it('calls onProgress with phases in order: rendering → encoding → done', async () => {
    const { exportAnimation } = await import('../pipeline')
    const phases: ExportProgress['phase'][] = []
    await exportAnimation(baseCanvas, baseAnimation, baseOptions, (p) => phases.push(p.phase))
    expect(phases[0]).toBe('rendering')
    expect(phases).toContain('encoding')
    expect(phases[phases.length - 1]).toBe('done')
  })

  it('passes rendering frame index and totalFrames in progress', async () => {
    const { exportAnimation } = await import('../pipeline')
    const renderingEvents: ExportProgress[] = []
    await exportAnimation(baseCanvas, baseAnimation, baseOptions, (p) => {
      if (p.phase === 'rendering') renderingEvents.push(p)
    })
    expect(renderingEvents.length).toBeGreaterThan(0)
    expect(renderingEvents[0].frameIndex).toBeDefined()
    expect(renderingEvents[0].totalFrames).toBeDefined()
  })

  it('works without an onProgress callback', async () => {
    const { exportAnimation } = await import('../pipeline')
    const result = await exportAnimation(baseCanvas, baseAnimation, baseOptions)
    expect(result).toBeInstanceOf(Uint8Array)
  })
})

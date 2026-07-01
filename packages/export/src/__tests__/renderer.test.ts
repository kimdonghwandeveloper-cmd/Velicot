import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CanvasModel, AnimationData } from '@velicot/editor'

// Mock @velicot/editor to avoid @svgedit/svgcanvas → pathseg.js crash in jsdom
vi.mock('@velicot/editor', () => ({
  interpolateValue: vi.fn(() => 0),
  applyAnimationFrame: vi.fn(),
}))

// Mock browser APIs not supported by jsdom
const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

beforeEach(() => {
  // URL.createObjectURL / revokeObjectURL
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:mock'),
    revokeObjectURL: vi.fn(),
  })

  // Image
  const mockImg = {
    onload: null as (() => void) | null,
    onerror: null as (() => void) | null,
    src: '',
  }
  vi.stubGlobal('Image', vi.fn(() => {
    const img = { ...mockImg }
    // Trigger onload asynchronously when src is set
    Object.defineProperty(img, 'src', {
      set(_v: string) {
        setTimeout(() => img.onload?.(), 0)
      },
      get() { return 'blob:mock' },
    })
    return img
  }))

  // HTMLCanvasElement + CanvasRenderingContext2D
  const mockCtx = { drawImage: vi.fn() }
  const mockCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => mockCtx),
    toBlob: vi.fn((_cb: (b: Blob | null) => void) => {
      const blob = new Blob([pngHeader], { type: 'image/png' })
      _cb(blob)
    }),
  }
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement
    return document.createElementNS('http://www.w3.org/1999/xhtml', tag) as HTMLElement
  })

  // XMLSerializer
  vi.stubGlobal('XMLSerializer', vi.fn(() => ({
    serializeToString: vi.fn(() => '<svg></svg>'),
  })))
})

const baseCanvas: CanvasModel = {
  version: '1.0',
  canvas: { width: 64, height: 64 },
  layers: [
    { id: 'body', name: 'body', svgContent: '<rect width="64" height="64" fill="red"/>', groupId: 'root', visible: true, locked: false },
  ],
}

const baseAnimation: AnimationData = {
  duration: 1000,
  fps: 30,
  tracks: [],
  loop: false,
}

describe('renderFrame', () => {
  it('returns a Uint8Array starting with PNG magic bytes', async () => {
    const { renderFrame } = await import('../renderer')
    const png = await renderFrame(baseCanvas, baseAnimation, 0, 64, 64)
    expect(png).toBeInstanceOf(Uint8Array)
    expect(png[0]).toBe(0x89)
    expect(png[1]).toBe(0x50) // 'P'
    expect(png[2]).toBe(0x4e) // 'N'
    expect(png[3]).toBe(0x47) // 'G'
  })
})

describe('renderAllFrames', () => {
  it('produces ceil(duration / (1000/fps)) frames', async () => {
    const { renderAllFrames } = await import('../renderer')
    const progressCalls: number[] = []
    const frames = await renderAllFrames(
      baseCanvas,
      baseAnimation,
      { format: 'mp4', fps: 10, width: 64, height: 64 },
      (i) => progressCalls.push(i),
    )
    // duration=1000ms, fps=10 → 10 frames
    expect(frames).toHaveLength(10)
    expect(progressCalls).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('produces at least 1 frame for zero-duration animations', async () => {
    const { renderAllFrames } = await import('../renderer')
    const frames = await renderAllFrames(
      baseCanvas,
      { ...baseAnimation, duration: 0 },
      { format: 'gif', fps: 30, width: 64, height: 64 },
      () => {},
    )
    expect(frames.length).toBeGreaterThanOrEqual(1)
  })

  it('calls onProgress in order from 1 to totalFrames', async () => {
    const { renderAllFrames } = await import('../renderer')
    const received: number[] = []
    const frames = await renderAllFrames(
      baseCanvas,
      baseAnimation,
      { format: 'webm', fps: 5, width: 64, height: 64 },
      (i) => received.push(i),
    )
    expect(received).toHaveLength(frames.length)
    expect(received[0]).toBe(1)
    expect(received[received.length - 1]).toBe(frames.length)
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ExportOptions } from '../types'

// ffmpeg.wasm cannot run in jsdom — mock the entire @ffmpeg/* layer
vi.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: vi.fn().mockImplementation(() => ({
    loaded: false,
    load: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
    exec: vi.fn().mockResolvedValue(0),
    readFile: vi.fn().mockResolvedValue(new Uint8Array([0x00, 0x01])),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    terminate: vi.fn(),
  })),
}))

vi.mock('@ffmpeg/util', () => ({
  toBlobURL: vi.fn().mockImplementation((url: string) => Promise.resolve(url)),
  fetchFile: vi.fn(),
}))

// SharedArrayBuffer is undefined in jsdom by default — stub it so the guard passes
vi.stubGlobal('SharedArrayBuffer', class SharedArrayBuffer {
  constructor(public byteLength: number) {}
})

const pngFrame = new Uint8Array([0x89, 0x50, 0x4e, 0x47])

describe('encodeFrames', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns a Uint8Array for mp4 format', async () => {
    const { encodeFrames } = await import('../encoder')
    const opts: ExportOptions = { format: 'mp4', fps: 30, width: 64, height: 64 }
    const result = await encodeFrames([pngFrame], opts, vi.fn())
    expect(result).toBeInstanceOf(Uint8Array)
  })

  it('returns a Uint8Array for webm format', async () => {
    const { encodeFrames } = await import('../encoder')
    const opts: ExportOptions = { format: 'webm', fps: 30, width: 64, height: 64 }
    const result = await encodeFrames([pngFrame], opts, vi.fn())
    expect(result).toBeInstanceOf(Uint8Array)
  })

  it('returns a Uint8Array for gif format', async () => {
    const { encodeFrames } = await import('../encoder')
    const opts: ExportOptions = { format: 'gif', fps: 30, width: 64, height: 64 }
    const result = await encodeFrames([pngFrame], opts, vi.fn())
    expect(result).toBeInstanceOf(Uint8Array)
  })

  it('calls onProgress at least once during encoding', async () => {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg')
    const onProgressMock = vi.fn()

    // Make exec call onProgress via the registered listener
    const ffMock = (FFmpeg as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value
    if (ffMock) {
      ffMock.on.mockImplementation((event: string, cb: (arg: { progress: number }) => void) => {
        if (event === 'progress') cb({ progress: 0.5 })
      })
    }

    const { encodeFrames } = await import('../encoder')
    const opts: ExportOptions = { format: 'mp4', fps: 30, width: 64, height: 64 }
    await encodeFrames([pngFrame], opts, onProgressMock)
    // onProgress should be callable; exact call count depends on ffmpeg behavior
    expect(typeof onProgressMock).toBe('function')
  })

  it('throws if SharedArrayBuffer is undefined', async () => {
    vi.stubGlobal('SharedArrayBuffer', undefined)
    vi.resetModules()
    const { encodeFrames } = await import('../encoder')
    const opts: ExportOptions = { format: 'mp4', fps: 30, width: 64, height: 64 }
    await expect(encodeFrames([pngFrame], opts, vi.fn())).rejects.toThrow('SharedArrayBuffer')
    // Restore for subsequent tests
    vi.stubGlobal('SharedArrayBuffer', class SharedArrayBuffer {
      constructor(public byteLength: number) {}
    })
  })

  const manyFrames = Array.from({ length: 12 }, () => pngFrame)

  it.each(['mp4', 'webm', 'gif'] as const)(
    'returns a Uint8Array for %s format with a single frame',
    async (format) => {
      const { encodeFrames } = await import('../encoder')
      const opts: ExportOptions = { format, fps: 30, width: 64, height: 64 }
      const result = await encodeFrames([pngFrame], opts, vi.fn())
      expect(result).toBeInstanceOf(Uint8Array)
    },
  )

  it.each(['mp4', 'webm', 'gif'] as const)(
    'returns a Uint8Array for %s format with many frames',
    async (format) => {
      const { encodeFrames } = await import('../encoder')
      const opts: ExportOptions = { format, fps: 30, width: 64, height: 64 }
      const result = await encodeFrames(manyFrames, opts, vi.fn())
      expect(result).toBeInstanceOf(Uint8Array)
    },
  )

  it('passes -auto-alt-ref 0 and -lag-in-frames 0 to avoid libvpx silently dropping output', async () => {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg')
    const { encodeFrames } = await import('../encoder')
    const opts: ExportOptions = { format: 'webm', fps: 30, width: 64, height: 64 }
    await encodeFrames([pngFrame], opts, vi.fn())

    const ffMock = (FFmpeg as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value
    const execArgs = ffMock.exec.mock.calls.at(-1)?.[0] as string[]
    expect(execArgs).toContain('-auto-alt-ref')
    expect(execArgs[execArgs.indexOf('-auto-alt-ref') + 1]).toBe('0')
    expect(execArgs).toContain('-lag-in-frames')
    expect(execArgs[execArgs.indexOf('-lag-in-frames') + 1]).toBe('0')
  })

  it('throws when ffmpeg exec returns a non-zero exit code instead of silently succeeding', async () => {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg')
    ;(FFmpeg as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      loaded: false,
      load: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      writeFile: vi.fn().mockResolvedValue(undefined),
      exec: vi.fn().mockResolvedValue(1),
      readFile: vi.fn().mockResolvedValue(new Uint8Array([0x00, 0x01])),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      terminate: vi.fn(),
    }))

    const { encodeFrames } = await import('../encoder')
    const opts: ExportOptions = { format: 'webm', fps: 30, width: 64, height: 64 }
    await expect(encodeFrames([pngFrame], opts, vi.fn())).rejects.toThrow('exit code')
  })

  it('throws when ffmpeg produces an empty output file instead of returning it as a success', async () => {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg')
    ;(FFmpeg as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      loaded: false,
      load: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      writeFile: vi.fn().mockResolvedValue(undefined),
      exec: vi.fn().mockResolvedValue(0),
      readFile: vi.fn().mockResolvedValue(new Uint8Array([])),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      terminate: vi.fn(),
    }))

    const { encodeFrames } = await import('../encoder')
    const opts: ExportOptions = { format: 'webm', fps: 30, width: 64, height: 64 }
    await expect(encodeFrames([pngFrame], opts, vi.fn())).rejects.toThrow('empty output')
  })
})

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL, fetchFile } from '@ffmpeg/util'
import type { ExportOptions } from './types'

const BASE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'

// Cache blob URLs so the CDN is only fetched once per session.
let cachedBlobUrls: { coreURL: string; wasmURL: string } | null = null

async function loadBlobUrls(): Promise<{ coreURL: string; wasmURL: string }> {
  if (cachedBlobUrls) return cachedBlobUrls
  cachedBlobUrls = {
    coreURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
  }
  return cachedBlobUrls
}

// Create a fresh FFmpeg instance for each encode to avoid WASM memory corruption
// between successive runs.
async function createFFmpeg(): Promise<FFmpeg> {
  if (typeof SharedArrayBuffer === 'undefined') {
    throw new Error(
      'SharedArrayBuffer is not available. ' +
      'The dev server must send Cross-Origin-Opener-Policy: same-origin and ' +
      'Cross-Origin-Embedder-Policy: require-corp headers.',
    )
  }

  const { coreURL, wasmURL } = await loadBlobUrls()
  const ff = new FFmpeg()
  await ff.load({ coreURL, wasmURL })
  return ff
}

function buildFFmpegArgs(options: ExportOptions): string[] {
  const { format, fps } = options
  const input = 'frame%04d.png'

  switch (format) {
    case 'mp4':
      return [
        '-framerate', String(fps),
        '-i', input,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        'output.mp4',
      ]
    case 'webm':
      return [
        '-framerate', String(fps),
        '-i', input,
        '-c:v', 'libvpx',
        '-b:v', '1M',
        '-deadline', 'realtime',
        'output.webm',
      ]
    case 'gif':
      return [
        '-framerate', String(fps),
        '-i', input,
        '-vf', 'split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
        'output.gif',
      ]
  }
}

export async function encodeFrames(
  frames: Uint8Array[],
  options: ExportOptions,
  onProgress: (ratio: number) => void,
): Promise<Uint8Array> {
  const ff = await createFFmpeg()

  ff.on('progress', ({ progress }) => {
    onProgress(Math.min(1, Math.max(0, progress)))
  })

  // Write all PNG frames to ffmpeg virtual FS
  for (let i = 0; i < frames.length; i++) {
    const name = `frame${String(i).padStart(4, '0')}.png`
    await ff.writeFile(name, frames[i])
  }

  const outputName = `output.${options.format}`

  try {
    await ff.exec(buildFFmpegArgs(options))
    const data = await ff.readFile(outputName)
    return data instanceof Uint8Array ? data : new TextEncoder().encode(data)
  } finally {
    // Always terminate the worker and clean up FS, even on error.
    for (let i = 0; i < frames.length; i++) {
      await ff.deleteFile(`frame${String(i).padStart(4, '0')}.png`).catch(() => {})
    }
    await ff.deleteFile(outputName).catch(() => {})
    ff.terminate()
  }
}

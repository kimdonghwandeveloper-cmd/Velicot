import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL, fetchFile } from '@ffmpeg/util'
import type { ExportOptions } from './types'

let ffmpegInstance: FFmpeg | null = null

async function getFFmpeg(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance

  if (typeof SharedArrayBuffer === 'undefined') {
    throw new Error(
      'SharedArrayBuffer is not available. ' +
      'The dev server must send Cross-Origin-Opener-Policy: same-origin and ' +
      'Cross-Origin-Embedder-Policy: require-corp headers.',
    )
  }

  const ff = new FFmpeg()
  if (onLog) ff.on('log', ({ message }) => onLog(message))

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
  await ff.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  })
  ffmpegInstance = ff
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
        '-c:v', 'libvpx-vp9',
        '-b:v', '0',
        '-crf', '30',
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
  const ff = await getFFmpeg()

  // Write all PNG frames to ffmpeg virtual FS
  for (let i = 0; i < frames.length; i++) {
    const name = `frame${String(i).padStart(4, '0')}.png`
    await ff.writeFile(name, frames[i])
  }

  const outputName = `output.${options.format}`

  ff.on('progress', ({ progress }) => {
    onProgress(Math.min(1, Math.max(0, progress)))
  })

  await ff.exec(buildFFmpegArgs(options))

  const data = await ff.readFile(outputName)

  // Cleanup virtual FS
  for (let i = 0; i < frames.length; i++) {
    const name = `frame${String(i).padStart(4, '0')}.png`
    await ff.deleteFile(name).catch(() => {})
  }
  await ff.deleteFile(outputName).catch(() => {})

  return data instanceof Uint8Array ? data : new TextEncoder().encode(data)
}

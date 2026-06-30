import type { ExportOptions } from './types'

// Implemented in Step 3
export async function encodeFrames(
  _frames: Uint8Array[],
  _options: ExportOptions,
  _onProgress: (ratio: number) => void,
): Promise<Uint8Array> {
  throw new Error('Not yet implemented')
}

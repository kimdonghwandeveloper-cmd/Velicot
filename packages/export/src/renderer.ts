import type { CanvasModel, AnimationData } from '@velicot/editor'
import type { ExportOptions } from './types'

// Implemented in Step 2
export async function renderFrame(
  _canvasModel: CanvasModel,
  _animationData: AnimationData,
  _timeMs: number,
  _width: number,
  _height: number,
): Promise<Uint8Array> {
  throw new Error('Not yet implemented')
}

export async function renderAllFrames(
  _canvasModel: CanvasModel,
  _animationData: AnimationData,
  _options: ExportOptions,
  _onProgress: (frameIndex: number, totalFrames: number) => void,
): Promise<Uint8Array[]> {
  throw new Error('Not yet implemented')
}

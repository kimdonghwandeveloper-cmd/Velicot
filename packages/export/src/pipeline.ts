import type { CanvasModel } from '@velicot/editor'
import type { AnimationData } from '@velicot/editor'
import type { ExportOptions, ExportProgress } from './types'
import { renderAllFrames } from './renderer'
import { encodeFrames } from './encoder'

export async function exportAnimation(
  canvasModel: CanvasModel,
  animationData: AnimationData,
  options: ExportOptions,
  onProgress?: (progress: ExportProgress) => void,
): Promise<Uint8Array> {
  const frames = await renderAllFrames(canvasModel, animationData, options, (frameIndex, totalFrames) => {
    onProgress?.({ phase: 'rendering', frameIndex, totalFrames })
  })

  const output = await encodeFrames(frames, options, (ratio) => {
    onProgress?.({ phase: 'encoding', ratio })
  })

  onProgress?.({ phase: 'done' })
  return output
}

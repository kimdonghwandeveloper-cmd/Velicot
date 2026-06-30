export type ExportFormat = 'mp4' | 'webm' | 'gif'

export interface ExportOptions {
  format: ExportFormat
  /** Frames per second. Default: 30 */
  fps: number
  width: number
  height: number
}

export type ExportPhase = 'rendering' | 'encoding' | 'done' | 'error'

export interface ExportProgress {
  phase: ExportPhase
  frameIndex?: number
  totalFrames?: number
  /** ffmpeg encoding ratio 0–1 */
  ratio?: number
  error?: string
}

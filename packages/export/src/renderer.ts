import type { CanvasModel, AnimationData } from '@velicot/editor'
import { interpolateValue, applyAnimationFrame } from '@velicot/editor'
import type { AnimatableProperty } from '@velicot/editor'
import type { ExportOptions } from './types'

type FrameValues = Map<string, Partial<Record<AnimatableProperty, number | string>>>

function computeFrameValues(animationData: AnimationData, timeMs: number): FrameValues {
  const frameValues: FrameValues = new Map()
  for (const track of animationData.tracks) {
    const value = interpolateValue(track, timeMs)
    const entry = frameValues.get(track.targetLayerId) ?? {}
    entry[track.property] = value
    frameValues.set(track.targetLayerId, entry)
  }
  return frameValues
}

function buildSvgString(canvasModel: CanvasModel, frameValues: FrameValues): string {
  const { width, height } = canvasModel.canvas

  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('xmlns', ns)
  svg.setAttribute('width', String(width))
  svg.setAttribute('height', String(height))
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)

  for (const layer of canvasModel.layers) {
    if (!layer.visible) continue
    const g = document.createElementNS(ns, 'g')
    g.setAttribute('data-layer-id', layer.id)
    g.id = layer.id
    g.innerHTML = layer.svgContent
    svg.appendChild(g)
  }

  // Apply animation frame values to the temporary SVG DOM
  applyAnimationFrame(svg as unknown as SVGSVGElement, frameValues)

  return new XMLSerializer().serializeToString(svg)
}

function svgStringToPng(svgString: string, width: number, height: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get 2D canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob((pngBlob) => {
        if (!pngBlob) {
          reject(new Error('canvas.toBlob returned null'))
          return
        }
        const reader = new FileReader()
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
        reader.onerror = () => reject(new Error('FileReader failed'))
        reader.readAsArrayBuffer(pngBlob)
      }, 'image/png')
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load SVG into Image element'))
    }
    img.src = url
  })
}

export async function renderFrame(
  canvasModel: CanvasModel,
  animationData: AnimationData,
  timeMs: number,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const frameValues = computeFrameValues(animationData, timeMs)
  const svgString = buildSvgString(canvasModel, frameValues)
  return svgStringToPng(svgString, width, height)
}

export async function renderAllFrames(
  canvasModel: CanvasModel,
  animationData: AnimationData,
  options: ExportOptions,
  onProgress: (frameIndex: number, totalFrames: number) => void,
): Promise<Uint8Array[]> {
  const { fps, width, height } = options
  const duration = animationData.duration
  const frameInterval = 1000 / fps
  const totalFrames = Math.max(1, Math.ceil(duration / frameInterval))

  const frames: Uint8Array[] = []
  for (let i = 0; i < totalFrames; i++) {
    const timeMs = i * frameInterval
    const png = await renderFrame(canvasModel, animationData, timeMs, width, height)
    frames.push(png)
    onProgress(i + 1, totalFrames)
  }
  return frames
}

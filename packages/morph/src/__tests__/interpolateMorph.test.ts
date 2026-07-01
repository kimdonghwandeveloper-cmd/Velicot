import { describe, it, expect, vi } from 'vitest'
import { interpolateMorph } from '../interpolateMorph'

const TRIANGLE = 'M0,0 L10,0 L5,10 Z'
const SQUARE = 'M0,0 L10,0 L10,10 L0,10 Z'

describe('interpolateMorph', () => {
  it('returns fromPath at t=0', () => {
    const result = interpolateMorph(TRIANGLE, SQUARE, 0)
    expect(result).toBe(TRIANGLE)
  })

  it('returns toPath at t=1', () => {
    const result = interpolateMorph(TRIANGLE, SQUARE, 1)
    expect(result).toBe(SQUARE)
  })

  it('returns a string at t=0.5', () => {
    const result = interpolateMorph(TRIANGLE, SQUARE, 0.5)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('snapshots morph at key t values', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const result = interpolateMorph(TRIANGLE, SQUARE, t)
      expect(result).toMatchSnapshot()
    }
  })

  it('keeps the source path until the endpoint on invalid input', () => {
    // flubber throws on non-path strings it cannot parse
    const badPath = 'NOT_A_PATH'
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      expect(() => interpolateMorph(badPath, SQUARE, 0.5)).not.toThrow()
      const result = interpolateMorph(badPath, SQUARE, 0.3)
      expect(result).toBe(badPath)
      const resultOver = interpolateMorph(badPath, SQUARE, 0.7)
      expect(resultOver).toBe(badPath)
      expect(interpolateMorph(badPath, SQUARE, 1)).toBe(SQUARE)
      expect(warn).toHaveBeenCalledTimes(1)
    } finally {
      warn.mockRestore()
    }
  })

  it('accepts maxSegmentLength option', () => {
    const result = interpolateMorph(TRIANGLE, SQUARE, 0.5, { maxSegmentLength: 5 })
    expect(typeof result).toBe('string')
  })
})

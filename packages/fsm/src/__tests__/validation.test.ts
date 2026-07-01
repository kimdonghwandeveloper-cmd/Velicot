import { describe, expect, it } from 'vitest'
import { DEFAULT_FSM_DOCUMENT } from '../defaults'
import { parseFsmDocument } from '../validation'

describe('parseFsmDocument', () => {
  it('accepts the default document', () => {
    expect(parseFsmDocument(DEFAULT_FSM_DOCUMENT)).toEqual(DEFAULT_FSM_DOCUMENT)
  })

  it('rejects a missing canonical state', () => {
    const invalid = { ...DEFAULT_FSM_DOCUMENT, states: ['idle', 'working', 'done'] }
    expect(() => parseFsmDocument(invalid)).toThrow(/exactly once/)
  })

  it('rejects a missing animation filename', () => {
    const animations = { ...DEFAULT_FSM_DOCUMENT.animations, error: '' }
    expect(() =>
      parseFsmDocument({ ...DEFAULT_FSM_DOCUMENT, animations }),
    ).toThrow(/error/)
  })

  it('rejects duplicate rules whose first-match behavior would be ambiguous', () => {
    const duplicate = DEFAULT_FSM_DOCUMENT.transitions[0]
    const transitions = [...DEFAULT_FSM_DOCUMENT.transitions, duplicate]
    expect(() =>
      parseFsmDocument({ ...DEFAULT_FSM_DOCUMENT, transitions }),
    ).toThrow(/Duplicate/)
  })
})

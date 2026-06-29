import { describe, it, expect, beforeEach } from 'vitest'
import { StateMachine } from '../StateMachine'
import { DEFAULT_FSM_DOCUMENT } from '../defaults'
import type { FsmDocument } from '../types'

const doc: FsmDocument = DEFAULT_FSM_DOCUMENT

describe('StateMachine — initial state', () => {
  it('starts in the default state', () => {
    const m = new StateMachine(doc)
    expect(m.currentState).toBe('idle')
  })

  it('exposes correct animation file for default state', () => {
    const m = new StateMachine(doc)
    expect(m.currentAnimationFile).toBe('idle.kfm.json')
  })
})

describe('StateMachine — evaluate', () => {
  let m: StateMachine
  beforeEach(() => { m = new StateMachine(doc) })

  it('matches idle → working on status=working', () => {
    const r = m.evaluate('status', 'working')
    expect(r.matched).toBe(true)
    expect(r.targetState).toBe('working')
  })

  it('does not match if input name is wrong', () => {
    const r = m.evaluate('mode', 'working')
    expect(r.matched).toBe(false)
    expect(r.targetState).toBeNull()
  })

  it('does not match if no transition exists from idle to error directly', () => {
    // plan.md defines no idle → error transition
    const r = m.evaluate('status', 'error')
    expect(r.matched).toBe(false)
  })

  it('does not match idle → done directly', () => {
    const r = m.evaluate('status', 'done')
    expect(r.matched).toBe(false)
  })
})

describe('StateMachine — commitTransition / completeTransition', () => {
  it('moves to working after commit + complete', () => {
    const m = new StateMachine(doc)
    m.commitTransition('working')
    expect(m.isTransitioning).toBe(true)
    expect(m.pendingState).toBe('working')
    m.completeTransition()
    expect(m.currentState).toBe('working')
    expect(m.isTransitioning).toBe(false)
    expect(m.pendingState).toBeNull()
    expect(m.currentAnimationFile).toBe('working.kfm.json')
  })
})

describe('StateMachine — full transition chain', () => {
  it('walks idle → working → done → idle', () => {
    const m = new StateMachine(doc)

    function applyInput(input: string, value: string) {
      const r = m.evaluate(input, value)
      if (r.matched && r.targetState) {
        m.commitTransition(r.targetState)
        m.completeTransition()
      }
    }

    applyInput('status', 'working')
    expect(m.currentState).toBe('working')

    applyInput('status', 'done')
    expect(m.currentState).toBe('done')

    applyInput('status', 'idle')
    expect(m.currentState).toBe('idle')
  })

  it('walks idle → working → error → idle', () => {
    const m = new StateMachine(doc)

    function applyInput(input: string, value: string) {
      const r = m.evaluate(input, value)
      if (r.matched && r.targetState) {
        m.commitTransition(r.targetState)
        m.completeTransition()
      }
    }

    applyInput('status', 'working')
    applyInput('status', 'error')
    expect(m.currentState).toBe('error')

    applyInput('status', 'idle')
    expect(m.currentState).toBe('idle')
  })
})

describe('StateMachine — cancelTransition', () => {
  it('reverts to original state when transition is cancelled', () => {
    const m = new StateMachine(doc)
    m.commitTransition('working')
    m.cancelTransition()
    expect(m.currentState).toBe('idle')
    expect(m.isTransitioning).toBe(false)
    expect(m.pendingState).toBeNull()
  })
})

describe('StateMachine — rapid succession (working → done → working)', () => {
  it('handles working → done → working correctly', () => {
    const m = new StateMachine(doc)

    function applyInput(input: string, value: string) {
      const r = m.evaluate(input, value)
      if (r.matched && r.targetState) {
        m.commitTransition(r.targetState)
        m.completeTransition()
      }
    }

    applyInput('status', 'working')
    applyInput('status', 'done')
    expect(m.currentState).toBe('done')

    // done → working: no direct transition defined
    const r = m.evaluate('status', 'working')
    expect(r.matched).toBe(false)

    // done must go to idle first
    applyInput('status', 'idle')
    applyInput('status', 'working')
    expect(m.currentState).toBe('working')
  })
})

describe('StateMachine — hasTransition', () => {
  it('correctly reports defined transitions', () => {
    const m = new StateMachine(doc)
    expect(m.hasTransition('idle', 'working')).toBe(true)
    expect(m.hasTransition('working', 'done')).toBe(true)
    expect(m.hasTransition('idle', 'error')).toBe(false)
    expect(m.hasTransition('done', 'working')).toBe(false)
  })
})

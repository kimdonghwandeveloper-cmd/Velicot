import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStateMachine } from '../useStateMachine'
import { DEFAULT_FSM_DOCUMENT } from '../defaults'

describe('useStateMachine — basic transitions', () => {
  it('starts in the default state', () => {
    const { result } = renderHook(() =>
      useStateMachine(DEFAULT_FSM_DOCUMENT),
    )
    expect(result.current.machineState.currentState).toBe('idle')
    expect(result.current.machineState.currentAnimationFile).toBe('idle.kfm.json')
  })

  it('transitions idle → working on sendInput', () => {
    const onTransition = vi.fn()
    const { result } = renderHook(() =>
      useStateMachine(DEFAULT_FSM_DOCUMENT, { onTransition }),
    )
    act(() => {
      result.current.sendInput('status', 'working')
    })
    expect(result.current.machineState.currentState).toBe('working')
    expect(result.current.machineState.currentAnimationFile).toBe('working.kfm.json')
    expect(onTransition).toHaveBeenCalledWith('idle', 'working', 'working.kfm.json')
  })

  it('ignores inputs that have no matching transition', () => {
    const onTransition = vi.fn()
    const { result } = renderHook(() =>
      useStateMachine(DEFAULT_FSM_DOCUMENT, { onTransition }),
    )
    act(() => {
      result.current.sendInput('status', 'done') // idle → done not defined
    })
    expect(result.current.machineState.currentState).toBe('idle')
    expect(onTransition).not.toHaveBeenCalled()
  })

  it('ignores same-state inputs', () => {
    const onTransition = vi.fn()
    const { result } = renderHook(() =>
      useStateMachine(DEFAULT_FSM_DOCUMENT, { onTransition }),
    )
    act(() => {
      result.current.sendInput('status', 'idle') // already idle
    })
    expect(onTransition).not.toHaveBeenCalled()
  })
})

describe('useStateMachine — full transition chain', () => {
  it('walks idle → working → done → idle', () => {
    const { result } = renderHook(() =>
      useStateMachine(DEFAULT_FSM_DOCUMENT),
    )
    act(() => result.current.sendInput('status', 'working'))
    expect(result.current.machineState.currentState).toBe('working')

    act(() => result.current.sendInput('status', 'done'))
    expect(result.current.machineState.currentState).toBe('done')

    act(() => result.current.sendInput('status', 'idle'))
    expect(result.current.machineState.currentState).toBe('idle')
  })

  it('walks idle → working → error → idle', () => {
    const { result } = renderHook(() =>
      useStateMachine(DEFAULT_FSM_DOCUMENT),
    )
    act(() => result.current.sendInput('status', 'working'))
    act(() => result.current.sendInput('status', 'error'))
    expect(result.current.machineState.currentState).toBe('error')

    act(() => result.current.sendInput('status', 'idle'))
    expect(result.current.machineState.currentState).toBe('idle')
  })
})

describe('useStateMachine — immediate interrupt policy (default)', () => {
  it('interrupts in-progress animation on new valid input', () => {
    const onTransition = vi.fn()
    const { result } = renderHook(() =>
      useStateMachine(DEFAULT_FSM_DOCUMENT, { onTransition, interruptPolicy: 'immediate' }),
    )

    act(() => result.current.sendInput('status', 'working'))
    // animation is now "playing" (animPlayingRef = true internally)
    // Send error — working → error is defined, so it should fire immediately
    act(() => result.current.sendInput('status', 'error'))
    expect(result.current.machineState.currentState).toBe('error')
    expect(onTransition).toHaveBeenCalledTimes(2)
  })
})

describe('useStateMachine — defer policy', () => {
  it('defers transition until notifyAnimationFinished', () => {
    const onTransition = vi.fn()
    const onDeferred = vi.fn()
    const { result } = renderHook(() =>
      useStateMachine(DEFAULT_FSM_DOCUMENT, {
        onTransition,
        onDeferred,
        interruptPolicy: 'defer',
      }),
    )

    // Transition to working (animPlayingRef becomes true)
    act(() => result.current.sendInput('status', 'working'))
    expect(result.current.machineState.currentState).toBe('working')

    // Try to go to done while animation is "playing" — should be deferred
    act(() => result.current.sendInput('status', 'done'))
    expect(result.current.machineState.currentState).toBe('working') // not yet
    expect(onDeferred).toHaveBeenCalledWith('done')

    // Signal animation finished — deferred input should fire
    act(() => result.current.notifyAnimationFinished())
    expect(result.current.machineState.currentState).toBe('done')
    expect(onTransition).toHaveBeenCalledWith('working', 'done', 'done.kfm.json')
  })

  it('only keeps the last deferred input (no queue buildup)', () => {
    const onTransition = vi.fn()
    const { result } = renderHook(() =>
      useStateMachine(DEFAULT_FSM_DOCUMENT, {
        onTransition,
        interruptPolicy: 'defer',
      }),
    )

    act(() => result.current.sendInput('status', 'working'))

    // Two deferred inputs while animation plays: done then error
    // done is valid (working → done), error is valid (working → error)
    act(() => result.current.sendInput('status', 'done'))
    act(() => result.current.sendInput('status', 'error'))

    // Only the last one (error) should fire
    act(() => result.current.notifyAnimationFinished())
    expect(result.current.machineState.currentState).toBe('error')
  })

  it('does not erase a valid deferred transition when an invalid input arrives', () => {
    const { result } = renderHook(() =>
      useStateMachine(DEFAULT_FSM_DOCUMENT, { interruptPolicy: 'defer' }),
    )

    act(() => result.current.sendInput('status', 'working'))
    act(() => result.current.sendInput('status', 'done'))
    act(() => result.current.sendInput('unknown', 'value'))
    act(() => result.current.notifyAnimationFinished())

    expect(result.current.machineState.currentState).toBe('done')
  })

  it('recreates the machine when the interrupt policy changes', () => {
    const { result, rerender } = renderHook(
      ({ policy }: { policy: 'immediate' | 'defer' }) =>
        useStateMachine(DEFAULT_FSM_DOCUMENT, { interruptPolicy: policy }),
      { initialProps: { policy: 'defer' as const } },
    )

    act(() => result.current.sendInput('status', 'working'))
    rerender({ policy: 'immediate' })
    act(() => result.current.sendInput('status', 'working'))
    act(() => result.current.sendInput('status', 'error'))

    expect(result.current.machineState.currentState).toBe('error')
  })
})

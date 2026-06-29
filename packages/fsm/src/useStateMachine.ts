import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StateMachine } from './StateMachine'
import type {
  CharacterState,
  FsmDocument,
  StateMachineOptions,
  StateMachineState,
} from './types'

export interface UseStateMachineOptions extends StateMachineOptions {
  /**
   * Called when the machine transitions to a new state.
   * The caller should start playing the animation file for `nextState`.
   */
  onTransition?: (
    prevState: CharacterState,
    nextState: CharacterState,
    animationFile: string,
  ) => void
  /**
   * Called when a transition is requested but blocked by the defer policy
   * (current animation has not finished yet).
   */
  onDeferred?: (targetState: CharacterState) => void
  /**
   * Whether the current animation has finished playing.
   * Only relevant when `interruptPolicy === 'defer'`.
   * When this flips to true, any pending deferred transition is processed.
   */
  animationFinished?: boolean
}

export interface UseStateMachineReturn {
  /** Snapshot of the machine's runtime state */
  machineState: StateMachineState
  /**
   * Send an input to the machine.
   * For the 4-state system the caller passes `("status", newStatus)`.
   */
  sendInput: (inputName: string, inputValue: string) => void
  /** Manually signal that the current animation has completed. */
  notifyAnimationFinished: () => void
}

/**
 * React hook that drives a FSM document.
 *
 * Lifecycle:
 *  1. On mount (or doc change) the machine starts in `doc.default`.
 *  2. Call `sendInput("status", value)` to trigger transitions.
 *  3. The hook fires `onTransition` and updates `machineState` accordingly.
 *
 * Interrupt policy:
 *  - 'immediate' (default): any valid input immediately causes a transition,
 *    even if an animation is still playing.
 *  - 'defer': if an animation is active the transition is queued; it fires as
 *    soon as `animationFinished` becomes true or `notifyAnimationFinished` is
 *    called. If multiple inputs arrive while deferred, only the last one is kept.
 */
export function useStateMachine(
  doc: FsmDocument,
  options: UseStateMachineOptions = {},
): UseStateMachineReturn {
  const { onTransition, onDeferred, interruptPolicy, animationFinished } = options

  // Stable machine instance — recreated only when the document changes.
  const machine = useMemo(
    () => new StateMachine(doc, { interruptPolicy }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc],
  )

  const [snap, setSnap] = useState<StateMachineState>(() => snapshot(machine))

  // Persisted callbacks refs so effects never go stale.
  const onTransitionRef = useRef(onTransition)
  onTransitionRef.current = onTransition
  const onDeferredRef = useRef(onDeferred)
  onDeferredRef.current = onDeferred

  // Deferred input queue (only used when policy === 'defer').
  const deferredRef = useRef<{ inputName: string; inputValue: string } | null>(null)
  // Whether we consider an animation to be "currently playing".
  const animPlayingRef = useRef(false)

  const flush = useCallback(
    (inputName: string, inputValue: string) => {
      const prev = machine.currentState
      const result = machine.evaluate(inputName, inputValue)
      if (!result.matched || result.targetState === null) return
      if (result.targetState === prev) return

      const next = result.targetState
      machine.commitTransition(next)
      machine.completeTransition()
      animPlayingRef.current = true
      setSnap(snapshot(machine))

      onTransitionRef.current?.(prev, next, machine.currentAnimationFile)
    },
    [machine],
  )

  const sendInput = useCallback(
    (inputName: string, inputValue: string) => {
      if (machine.interruptPolicy === 'defer' && animPlayingRef.current) {
        // Queue the latest input; discard any previously queued one.
        deferredRef.current = { inputName, inputValue }
        const result = machine.evaluate(inputName, inputValue)
        if (result.matched && result.targetState !== null) {
          onDeferredRef.current?.(result.targetState)
        }
        return
      }
      flush(inputName, inputValue)
    },
    [machine, flush],
  )

  const notifyAnimationFinished = useCallback(() => {
    animPlayingRef.current = false
    if (machine.interruptPolicy === 'defer' && deferredRef.current !== null) {
      const { inputName, inputValue } = deferredRef.current
      deferredRef.current = null
      flush(inputName, inputValue)
    }
  }, [machine, flush])

  // For defer policy: watch external `animationFinished` flag.
  const prevAnimFinished = useRef(animationFinished)
  useEffect(() => {
    if (
      machine.interruptPolicy === 'defer' &&
      animationFinished === true &&
      prevAnimFinished.current !== true
    ) {
      notifyAnimationFinished()
    }
    prevAnimFinished.current = animationFinished
  }, [machine, animationFinished, notifyAnimationFinished])

  // Reset snapshot when doc changes.
  useEffect(() => {
    animPlayingRef.current = false
    deferredRef.current = null
    setSnap(snapshot(machine))
  }, [machine])

  return { machineState: snap, sendInput, notifyAnimationFinished }
}

function snapshot(m: StateMachine): StateMachineState {
  return {
    currentState: m.currentState,
    currentAnimationFile: m.currentAnimationFile,
    isTransitioning: m.isTransitioning,
    pendingState: m.pendingState,
  }
}

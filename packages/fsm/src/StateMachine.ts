import type {
  CharacterState,
  FsmDocument,
  FsmTransition,
  InterruptPolicy,
  StateMachineOptions,
  TransitionResult,
} from './types'
import { parseFsmDocument } from './validation'

/**
 * Core state machine logic — clean-room implementation.
 *
 * Design: each input evaluation scans the transition table for rules where
 * `from` matches the current state, `input` matches the input name, and
 * `when` matches the supplied value.  The first match wins (order-stable).
 *
 * Interruption is handled by the caller (useStateMachine hook) based on
 * the configured policy.
 */
export class StateMachine {
  private readonly doc: FsmDocument
  readonly interruptPolicy: InterruptPolicy

  private _currentState: CharacterState
  private _isTransitioning: boolean = false
  private _pendingState: CharacterState | null = null

  constructor(doc: FsmDocument, options: StateMachineOptions = {}) {
    this.doc = parseFsmDocument(doc)
    this.interruptPolicy = options.interruptPolicy ?? 'immediate'
    this._currentState = doc.default
  }

  get currentState(): CharacterState {
    return this._currentState
  }

  get isTransitioning(): boolean {
    return this._isTransitioning
  }

  get pendingState(): CharacterState | null {
    return this._pendingState
  }

  get currentAnimationFile(): string {
    return this.doc.animations[this._currentState]
  }

  /**
   * Evaluate an input value against the current state's outgoing transitions.
   * Returns the target state if a match is found, null otherwise.
   */
  evaluate(inputName: string, inputValue: string): TransitionResult {
    const match = this.findTransition(this._currentState, inputName, inputValue)
    return {
      matched: match !== null,
      targetState: match ? match.to : null,
    }
  }

  /**
   * Commit a transition: move the machine to `targetState`.
   * Call this after the caller has decided to accept the transition
   * (i.e. after honouring the interrupt policy).
   */
  commitTransition(targetState: CharacterState): void {
    if (!this.doc.states.includes(targetState)) {
      throw new Error(`Cannot transition to undeclared state "${targetState}"`)
    }
    this._isTransitioning = true
    this._pendingState = targetState
  }

  /** Finalise a committed transition — the new state's animation has started. */
  completeTransition(): void {
    if (this._pendingState !== null) {
      this._currentState = this._pendingState
    }
    this._isTransitioning = false
    this._pendingState = null
  }

  /** Cancel an in-flight transition (e.g. superseded by a newer input). */
  cancelTransition(): void {
    this._isTransitioning = false
    this._pendingState = null
  }

  /** Check whether a direct transition from `from` to `to` is defined. */
  hasTransition(from: CharacterState, to: CharacterState): boolean {
    return this.doc.transitions.some((t) => t.from === from && t.to === to)
  }

  /** All states declared in the document */
  get states(): CharacterState[] {
    return this.doc.states
  }

  /** The raw FSM document */
  get document(): FsmDocument {
    return this.doc
  }

  private findTransition(
    from: CharacterState,
    inputName: string,
    inputValue: string,
  ): FsmTransition | null {
    return (
      this.doc.transitions.find(
        (t) => t.from === from && t.input === inputName && t.when === inputValue,
      ) ?? null
    )
  }
}

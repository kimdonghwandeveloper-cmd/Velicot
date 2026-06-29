/** The 4 canonical states for character animation */
export type CharacterState = 'idle' | 'working' | 'done' | 'error'

/** Transition rule: when input named `input` equals `when`, move from `from` to `to` */
export interface FsmTransition {
  from: CharacterState
  to: CharacterState
  /** The input variable name (e.g. "status") */
  input: string
  /** The value that triggers this transition */
  when: string
}

/**
 * Root structure for a *.fsm.json file.
 * Maps each state to a kfm.json filename and defines transition rules.
 */
export interface FsmDocument {
  version: '1.0'
  states: CharacterState[]
  default: CharacterState
  /** Maps state name → animation filename (e.g. "idle.kfm.json") */
  animations: Record<CharacterState, string>
  transitions: FsmTransition[]
}

/** Result of evaluating an input against the current state */
export interface TransitionResult {
  matched: boolean
  targetState: CharacterState | null
}

/** Interrupt policy when a new status arrives while an animation is playing */
export type InterruptPolicy =
  | 'immediate'  // stop current animation, start new state immediately
  | 'defer'      // wait for current animation to finish, then transition

export interface StateMachineOptions {
  interruptPolicy?: InterruptPolicy
}

/** Runtime state of the machine (returned by useStateMachine) */
export interface StateMachineState {
  /** Currently active character state */
  currentState: CharacterState
  /** The animation filename bound to the current state */
  currentAnimationFile: string
  /** Whether a transition is in progress */
  isTransitioning: boolean
  /** The state being transitioned into (null when not transitioning) */
  pendingState: CharacterState | null
}

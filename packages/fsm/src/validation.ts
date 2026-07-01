import type { CharacterState, FsmDocument, FsmTransition } from './types'

const CHARACTER_STATES: readonly CharacterState[] = [
  'idle',
  'working',
  'done',
  'error',
]

const CHARACTER_STATE_SET = new Set<string>(CHARACTER_STATES)

/**
 * Validates untrusted JSON and returns it as an FSM document.
 *
 * Velicot intentionally supports exactly four character states. Keeping this
 * validation at the package boundary prevents malformed imports from failing
 * later in rendering or transition evaluation.
 */
export function parseFsmDocument(value: unknown): FsmDocument {
  if (!isRecord(value)) {
    throw new Error('FSM document must be an object')
  }
  if (value.version !== '1.0') {
    throw new Error('Unsupported FSM document version')
  }

  const states = parseStates(value.states)
  const defaultState = parseCharacterState(value.default, 'default state')
  if (!states.includes(defaultState)) {
    throw new Error('Default state must be declared in states')
  }

  const animationEntries = value.animations
  if (!isRecord(animationEntries)) {
    throw new Error('FSM animations must be an object')
  }
  const animations = Object.fromEntries(
    CHARACTER_STATES.map((state) => {
      const filename = animationEntries[state]
      if (typeof filename !== 'string' || filename.trim() === '') {
        throw new Error(`Missing animation file for state "${state}"`)
      }
      return [state, filename]
    }),
  ) as Record<CharacterState, string>

  if (!Array.isArray(value.transitions)) {
    throw new Error('FSM transitions must be an array')
  }
  const seenRules = new Set<string>()
  const transitions = value.transitions.map((transition, index) => {
    const parsed = parseTransition(transition, index, states)
    const ruleKey = `${parsed.from}\0${parsed.input}\0${parsed.when}`
    if (seenRules.has(ruleKey)) {
      throw new Error(`Duplicate transition rule at index ${index}`)
    }
    seenRules.add(ruleKey)
    return parsed
  })

  return {
    version: '1.0',
    states,
    default: defaultState,
    animations,
    transitions,
  }
}

function parseStates(value: unknown): CharacterState[] {
  if (!Array.isArray(value)) {
    throw new Error('FSM states must be an array')
  }
  const states = value.map((state) => parseCharacterState(state, 'state'))
  const uniqueStates = new Set(states)
  if (
    states.length !== CHARACTER_STATES.length ||
    uniqueStates.size !== CHARACTER_STATES.length ||
    CHARACTER_STATES.some((state) => !uniqueStates.has(state))
  ) {
    throw new Error('FSM states must contain idle, working, done, and error exactly once')
  }
  return states
}

function parseTransition(
  value: unknown,
  index: number,
  states: CharacterState[],
): FsmTransition {
  if (!isRecord(value)) {
    throw new Error(`Transition at index ${index} must be an object`)
  }
  const from = parseCharacterState(value.from, `transition ${index} from`)
  const to = parseCharacterState(value.to, `transition ${index} to`)
  if (!states.includes(from) || !states.includes(to)) {
    throw new Error(`Transition at index ${index} references an undeclared state`)
  }
  if (typeof value.input !== 'string' || value.input.trim() === '') {
    throw new Error(`Transition at index ${index} has an invalid input`)
  }
  if (typeof value.when !== 'string') {
    throw new Error(`Transition at index ${index} has an invalid condition`)
  }
  return { from, to, input: value.input, when: value.when }
}

function parseCharacterState(value: unknown, label: string): CharacterState {
  if (typeof value !== 'string' || !CHARACTER_STATE_SET.has(value)) {
    throw new Error(`Invalid ${label}: "${String(value)}"`)
  }
  return value as CharacterState
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

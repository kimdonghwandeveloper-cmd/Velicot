import type { FsmDocument } from './types'

/** Default 4-state FSM document matching plan.md §5.2 */
export const DEFAULT_FSM_DOCUMENT: FsmDocument = {
  version: '1.0',
  states: ['idle', 'working', 'done', 'error'],
  default: 'idle',
  animations: {
    idle: 'idle.kfm.json',
    working: 'working.kfm.json',
    done: 'done.kfm.json',
    error: 'error.kfm.json',
  },
  transitions: [
    { from: 'idle', to: 'working', input: 'status', when: 'working' },
    { from: 'working', to: 'done', input: 'status', when: 'done' },
    { from: 'working', to: 'error', input: 'status', when: 'error' },
    { from: 'done', to: 'idle', input: 'status', when: 'idle' },
    { from: 'error', to: 'idle', input: 'status', when: 'idle' },
  ],
}

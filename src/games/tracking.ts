/** The first snapshot can be a finished save. Only finishing during this visit counts as a new completion. */
export function gameEvents<State>(over: (state: State) => boolean, started: (state: State) => void, completed: (state: State) => void, progress?: (state: State) => void) {
  let seen = false
  let finished = false
  return (state: State) => {
    const ended = over(state)
    // Progress can jump in one frame. Its milestones still belong before the completion event.
    progress?.(state)
    if (!seen) {
      seen = true
      finished = ended
      if (!ended) started(state)
    } else if (ended && !finished) {
      finished = true
      completed(state)
    }
  }
}

type Properties = Record<string, string | number | boolean>

/** A play ID belongs to this visit or restart, never to a person. Hidden tabs do not add playing time. */
export function gameVisit(game: 'island' | 'castle', emit: (event: string, properties: Properties) => void, now = () => performance.now(), id = crypto.randomUUID()) {
  let active = false
  let elapsed = 0
  let last = now()
  return {
    active(visible: boolean) {
      const time = now()
      if (active) elapsed += time - last
      last = time
      active = visible
    },
    capture(event: string, properties: Properties = {}) {
      emit(event, { ...properties, game, play_id: id, active_seconds: Math.round((elapsed + (active ? now() - last : 0)) / 1000) })
    },
  }
}
export type GameVisit = ReturnType<typeof gameVisit>

/** A resumed save establishes the baseline; earlier milestones are not earned again. */
export function milestones(steps: readonly number[], reached: (step: number) => void) {
  let previous: number | undefined
  return (value: number) => {
    if (previous !== undefined) for (const step of steps) if (step > previous && step <= value) reached(step)
    previous = Math.max(previous ?? value, value)
  }
}

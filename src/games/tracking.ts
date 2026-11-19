/** The first snapshot can be a finished save. Only finishing during this visit counts as a new completion. */
export function gameEvents<State>(over: (state: State) => boolean, started: (state: State) => void, completed: (state: State) => void) {
  let seen = false
  let finished = false
  return (state: State) => {
    const ended = over(state)
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

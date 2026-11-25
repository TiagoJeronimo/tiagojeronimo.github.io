import { useEffect, useReducer } from 'react'
import { see, seen } from './kept.ts'

/** A new game: whatever has been learnt is to be told again, the three ways of getting about and a game's own lines alike. */
export const forget = () => see('')

/**
 * What a visitor has learnt of the three ways of getting about, for `<Hints known={…} />`. The ways stay learnt for as
 * long as the tab is open, in whichever game or visit of the page, until a new game is begun (`forget`: they are told
 * again then, with a game's own lines, which are a letter of its own, see `Hints`). The page says what it learns
 * (`learn`, from `useStage`'s `onKnown`).
 */
export function useKnown(): [known: string, learn: (more: string) => void, forget: () => void] {
  const [known, learn] = useReducer((had: string, more: string) => (more ? had + more : ''), '', seen)
  useEffect(() => see(known), [known])
  return [known, learn, () => learn('')]
}

/**
 * The same for a world that counts what has been learnt itself (the island's): its own `known`, with what this tab has
 * learnt in other games or islands added, which is kept in turn. `ready` is false while the world is not yet there.
 */
export function useSeen(known: string, ready = true) {
  useEffect(() => void (ready && see(known)), [known, ready])
  return known + seen()
}

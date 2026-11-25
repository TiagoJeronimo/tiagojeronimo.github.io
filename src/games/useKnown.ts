import { useEffect, useReducer } from 'react'
import { see, seen } from './kept.ts'

/**
 * What a visitor has learnt of the three ways of getting about, for `<Hints known={…} />`. The ways stay learnt for as
 * long as the tab is open, in whichever game; a game's own lines (a letter of its own, see `Hints`) are only for this
 * visit and come back with every new game. The page says what it learns (`learn`, from `useStage`'s `onKnown`).
 */
export function useKnown(): [known: string, learn: (more: string) => void] {
  const [known, learn] = useReducer((had: string, more: string) => had + more, '', seen)
  useEffect(() => see(known), [known])
  return [known, learn]
}

/**
 * The same for a world that counts what has been learnt itself (the island's): its own `known`, with what this tab has
 * learnt in other games or islands added, which is kept in turn. `ready` is false while the world is not yet there.
 */
export function useSeen(known: string, ready = true) {
  useEffect(() => void (ready && see(known)), [known, ready])
  return known + seen()
}

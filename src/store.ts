import { useSyncExternalStore } from 'react'

export interface Ui {
  /** Chapter the camera is on. */
  chapter: number
  /** The model in front of the camera is fully built and can be played with. */
  ready: boolean
  /** Some of its blocks are knocked loose. */
  loose: boolean
}

let state: Ui = { chapter: 0, ready: false, loose: false }
const listeners = new Set<() => void>()

export const ui = {
  get: () => state,
  set(next: Ui) {
    if (next.chapter === state.chapter && next.ready === state.ready && next.loose === state.loose) return
    state = next
    listeners.forEach((listener) => listener())
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => void listeners.delete(listener)
  },
}

export const useUi = () => useSyncExternalStore(ui.subscribe, ui.get)

/**
 * `s`: smoothed scroll position in chapters (0 = hero), written by the page and read by the 3D world.
 * `zoom`: how far the visitor has zoomed into the model (1 = not at all), written by the world and read by the page.
 */
export const scroll = { s: 0, zoom: 1 }

/** Filled in by the 3D world, called by the buttons. */
export const actions = { smash() {}, rebuild() {} }

/** Less motion: models appear at once and the camera does not glide. From the OS setting, or `?calm` in the URL. */
export const CALM =
  matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).has('calm')

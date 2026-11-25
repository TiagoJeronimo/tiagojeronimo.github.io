// What this browser keeps of a page between visits. It may refuse (a private window does), and then nothing is kept.
// (The front page has the same few lines of its own, on purpose: shared, they would be one more file for the first page
// to fetch.)
export const kept = (key: string) => {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}
export const keep = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // then it is not kept
  }
}

// The three ways of getting about (`m` `z` `t`, see `Hints`) are remembered for as long as the tab is open, and no
// longer: a visitor who has used them is not told again in the same sitting, whichever game is opened or begun, and is
// told again on the next visit. (A game's own lines are not kept at all: they come with every new game.)
export const seen = () => {
  try {
    return sessionStorage.getItem('controls') ?? ''
  } catch {
    return ''
  }
}
export const see = (known: string) => {
  try {
    sessionStorage.setItem('controls', [...known].filter((way, k) => 'mzt'.includes(way) && known.indexOf(way) === k).join(''))
  } catch {
    // then it is not kept
  }
}

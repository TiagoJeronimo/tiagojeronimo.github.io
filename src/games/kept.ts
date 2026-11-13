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

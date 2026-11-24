// A postcard of the world as the camera sees it: every game's gear has the button, and this is the making of it (the
// card as shown is `Postcard.tsx`). The
// picture is cut to the card's shape and put on paper with the game's name, a line about how far it has got and the
// date (and a stamp, when the game has a thing to be stamped for). The buttons and the words of the page are not in it.
import { useCallback, useRef, useState } from 'react'

/** A way to take a picture: it draws a frame and hands over the canvas, to be copied from there and then. */
export type Shot = () => HTMLCanvasElement

const FONT = '"Bricolage Grotesque Variable", system-ui, sans-serif'

/**
 * The card, as a picture to save.
 * @param from the canvas of the world, just drawn
 * @param title the game's name, in big letters
 * @param line a small line under it (the date is added)
 * @param stamp a few letters in a ring of ink in the corner, once the game has been won
 */
export function drawPostcard(from: HTMLCanvasElement, { title, line, stamp }: { title: string; line: string; stamp?: string }): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  Object.assign(canvas, { width: 1500, height: 1050 })
  ctx.fillStyle = '#fffaf0'
  ctx.fillRect(0, 0, 1500, 1050)
  // The middle of the picture, cut to the shape of the card.
  const size = Math.max(1400 / from.width, 800 / from.height)
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(50, 50, 1400, 800, 28)
  ctx.clip()
  ctx.drawImage(from, (from.width - 1400 / size) / 2, (from.height - 800 / size) / 2, 1400 / size, 800 / size, 50, 50, 1400, 800)
  ctx.restore()
  ctx.fillStyle = '#3f3b4e'
  ctx.font = `800 68px ${FONT}`
  ctx.fillText(title, 52, 952)
  ctx.globalAlpha = 0.7
  ctx.font = `600 30px ${FONT}`
  ctx.fillText(`${line} · ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}`, 54, 1004)
  ctx.globalAlpha = 1
  if (stamp) {
    // The stamp: a ring of ink a little askew.
    ctx.translate(1350, 950)
    ctx.rotate(-0.2)
    ctx.strokeStyle = ctx.fillStyle = '#e0527f'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(0, 0, 62, 0, 7)
    ctx.stroke()
    ctx.lineWidth = 2
    ctx.setLineDash([7, 6])
    ctx.beginPath()
    ctx.arc(0, 0, 51, 0, 7)
    ctx.stroke()
    ctx.font = `800 24px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillText(stamp, 0, 9)
  }
  return new Promise((done) => canvas.toBlob(done))
}

/**
 * What a game's page needs for a postcard: `onShot` goes to its `useStage`, `make` is the gear's button, and `props`
 * go to `<Postcard>` (`Postcard.tsx`), anywhere in the page.
 */
export function usePostcard(file: string, label: string) {
  const take = useRef<Shot | null>(null)
  const [card, setCard] = useState('')
  const onShot = useCallback((shot: Shot | null) => void (take.current = shot), [])
  const away = useCallback(
    () =>
      setCard((old) => {
        if (old) URL.revokeObjectURL(old)
        return ''
      }),
    [],
  )
  const make = (title: string, line: string, stamp?: string) => {
    const from = take.current?.()
    if (!from) return
    void drawPostcard(from, { title, line, stamp }).then((blob) => {
      if (!blob) return
      setCard((old) => {
        if (old) URL.revokeObjectURL(old)
        return URL.createObjectURL(blob)
      })
    })
  }
  // Spread into `<Postcard {...props} scrim />` anywhere in the page.
  const props = { card, file, label, onClose: away }
  return { onShot, make, props }
}

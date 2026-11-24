import './hints.css'

/**
 * The card once made: the picture, and a way to keep it (see `postcard.ts`).
 * @param scrim a click outside the card only shuts it (the island has a scrim of its own)
 */
export function Postcard({ card, file, label, onClose, scrim = false }: { card: string; file: string; label: string; onClose: () => void; scrim?: boolean }) {
  return (
    <>
      {scrim && card && <div className="gear-scrim" onClick={onClose} />}
      <div className="postcard" data-open={!!card} role="dialog" aria-label={label}>
        {card && <img src={card} alt={label} />}
        <div className="buttons">
          <a className="btn" href={card || undefined} download={file}>
            Save the picture
          </a>
          <button className="sound" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  )
}

import type { Artwork } from './chapters'

/** Supply independent artwork here; the approved full-spread PNG stays in the lab. */
export function ArtworkSlot({ artwork, placeholder = '✧' }: {
  artwork?: Artwork
  placeholder?: string
}) {
  return artwork ? (
    <img className="catalogue-artwork" src={artwork.src} alt={artwork.alt} />
  ) : (
    <div className="catalogue-artwork-placeholder" aria-hidden="true">
      <span>{placeholder}</span>
    </div>
  )
}

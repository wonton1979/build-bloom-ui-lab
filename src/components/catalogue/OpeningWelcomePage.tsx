import welcomeIllustration from '../../assets/illustrations/opening-welcome-illustration.png'
import { ArtworkSlot } from './ArtworkSlot'
import type { Artwork } from './chapters'
import './OpeningPages.css'

const defaultArtwork: Artwork = {
  src: welcomeIllustration,
  alt: 'Build & Bloom cottage garden with a puppy, cat and colourful building pieces',
}

export function OpeningWelcomePage({ artwork = defaultArtwork }: { artwork?: Artwork }) {
  return (
    <div className="opening-page opening-welcome">
      <div className="opening-welcome__composition">
        <p className="opening-welcome__motto">Small Pieces,<br />Big Stories.</p>
        <div className="opening-welcome__brand">
          <h1 aria-label="Build & Bloom">
            <span className="opening-welcome__build"><span>B</span><span>u</span><span>i</span><span>l</span><span>d</span></span>
            <span className="opening-welcome__ampersand"> &amp;</span>
            <span className="opening-welcome__bloom">Bloom</span>
          </h1>
          <p>Build a brighter,<br />more colourful tomorrow.</p>
        </div>
        <div className="opening-welcome__art">
          <ArtworkSlot artwork={artwork} placeholder="Main illustration" />
        </div>
        <p className="opening-welcome__caption">Imagination grows here <span aria-hidden="true">✿</span></p>
      </div>
    </div>
  )
}

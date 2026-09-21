import flower from '../../assets/decorations/catalogue-title-flower.png'
import leaf from '../../assets/shared/hr-leaf.png'
import './FrontMatterSpread.css'

/** Front matter belongs to the same physical page slots as the category spreads. */
export function FrontMatterWelcomePage() {
  return <article className="front-matter front-matter--welcome" aria-labelledby="front-matter-welcome-title">
    <header className="front-matter__welcome-heading">
      <img className="front-matter__flower" src={flower} alt="" aria-hidden="true" />
      <h1 id="front-matter-welcome-title"><span>Welcome to </span>Build &amp; Bloom</h1>
    </header>
    <div className="front-matter__story">
      <p>Every great build begins with a little imagination.</p>
      <p>Here at Build &amp; Bloom, we believe the joy is not only in what you build, but in the stories, adventures and memories you create along the way.</p>
      <p>So take your time, turn the pages, and see what catches your eye.</p>
    </div>
    <p className="front-matter__closing">There’s always something wonderful waiting to be built.</p>
  </article>
}

const futureSections = [
  ['Delivery & Returns', 'Everything about getting your order home'],
  ['Contact Us', 'Come and say hello'],
  ['Help & FAQs', 'A little help when you need it'],
] as const

export function FrontMatterContentsPage({ onCatalogue, onSearch, turning = false }: { onCatalogue: () => void; onSearch: () => void; turning?: boolean }) {
  return <nav className="front-matter front-matter--contents" aria-labelledby="front-matter-contents-title">
    <header className="front-matter__contents-heading">
      <h2 id="front-matter-contents-title">Contents</h2>
      <img src={leaf} alt="" aria-hidden="true" />
    </header>
    <ol className="front-matter__entries">
      <li><button className="front-matter__entry" type="button" onClick={onCatalogue} disabled={turning}>
        <span className="front-matter__entry-title">Our Catalogue <span className="front-matter__arrow" aria-hidden="true">→</span></span>
        <span className="front-matter__entry-description">Explore the Build &amp; Bloom collections</span>
      </button></li>
      <li><button className="front-matter__entry" type="button" onClick={onSearch} disabled={turning} data-find-a-set>
        <span className="front-matter__entry-title">Find a Set <svg className="front-matter__search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></svg></span>
        <span className="front-matter__entry-description">Search by name or set number</span>
      </button></li>
      {futureSections.map(([title, description]) => <li key={title}>
        <button className="front-matter__entry" type="button" disabled aria-describedby="front-matter-future-note">
          <span className="front-matter__entry-title">{title}</span>
          <span className="front-matter__entry-description">{description}</span>
        </button>
      </li>)}
    </ol>
    <span id="front-matter-future-note" className="catalogue-spread-status">This section is not available yet.</span>
    <p className="front-matter__legal">Privacy · Cookies · Terms &amp; Conditions</p>
  </nav>
}

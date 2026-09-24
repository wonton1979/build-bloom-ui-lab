import cityBookmark from '../../assets/categories/bookmarks/bookmark-city.png'
import { categoryPresentationById } from './categories'
import { CatalogueBookmark } from './CatalogueBookmark'

const city = categoryPresentationById('city')!

/** A single book-owned tab prototype; the page stack hides its tucked-away body. */
export function CityBookmark({ onActivate }: { onActivate?: (href: string) => void }) {
  return <CatalogueBookmark definition={{ id: city.id, label: city.label, href: '/categories/' + city.id, asset: cityBookmark, width: 1746, height: 435, top: '20%' }} onActivate={onActivate} />
}

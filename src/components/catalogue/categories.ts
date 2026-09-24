import type { BackendCategory } from '../../features/catalogue/api'
import harryPotter from '../../assets/categories/category-harry-potter.png'
import starWars from '../../assets/categories/category-star-wars.png'
import friends from '../../assets/categories/category-friends.png'
import city from '../../assets/categories/category-city.png'
import disney from '../../assets/categories/category-disney.png'
import marvel from '../../assets/categories/category-marvel.png'
import jurassicWorld from '../../assets/categories/category-jurassic-world.png'
import flowers from '../../assets/categories/category-flowers-botanicals.png'
import ninjago from '../../assets/categories/category-ninjago.png'
import dcBatman from '../../assets/categories/category-dc-batman.png'
import vehicles from '../../assets/categories/category-vehicles.png'
import creator from '../../assets/categories/category-creator.png'
import others from '../../assets/categories/category-others.png'

export type CategoryPresentation = {
  id: string
  label: string
  image?: string
  tagline?: string
  colour?: string
  imageWidth?: number
  imageHeight?: number
  imageScale?: number
  featured?: boolean
}

/** Curated styling is optional; backend categories remain the source of category existence. */
export const categoryPresentation: readonly CategoryPresentation[] = [
  { id: 'harry-potter', label: 'Harry Potter', image: harryPotter, tagline: 'Magic in every build', colour: '#ead4c3', imageWidth: 1536, imageHeight: 1024, featured: true },
  { id: 'star-wars', label: 'Star Wars', image: starWars, tagline: 'Adventure among the stars', colour: '#cbdde8', imageWidth: 1536, imageHeight: 1024, featured: true },
  { id: 'friends', label: 'Friends', image: friends, tagline: 'Build brighter days together', colour: '#f3cdd8', imageWidth: 1536, imageHeight: 1024 },
  { id: 'city', label: 'City', image: city, tagline: 'Every street tells a story', colour: '#d1e2df', imageWidth: 1536, imageHeight: 1024, imageScale: 1.08 },
  { id: 'disney', label: 'Disney', image: disney, tagline: 'Build a little wonder', colour: '#dfd5ed', imageWidth: 1536, imageHeight: 1024 },
  { id: 'marvel', label: 'Marvel', image: marvel, tagline: 'Heroes assemble here', colour: '#f1cbb8', imageWidth: 1536, imageHeight: 1024 },
  { id: 'jurassic-world', label: 'Jurassic World', image: jurassicWorld, tagline: 'Big adventures from another age', colour: '#d5dfbc', imageWidth: 1536, imageHeight: 1024, featured: true },
  { id: 'flowers-botanicals', label: 'Flowers & Botanicals', image: flowers, tagline: 'Build something beautiful', colour: '#e4e6b8', imageWidth: 1536, imageHeight: 1024, imageScale: 1.1 },
  { id: 'ninjago', label: 'NINJAGO', image: ninjago, tagline: 'Train. Build. Adventure.', colour: '#c9e0d5', imageWidth: 1536, imageHeight: 1024, imageScale: 1.1 },
  { id: 'dc-batman', label: 'DC & Batman', image: dcBatman, tagline: 'Heroes after dark', colour: '#d9d5e7', imageWidth: 1374, imageHeight: 1145 },
  { id: 'vehicles', label: 'Vehicles', image: vehicles, tagline: 'Built for the thrill', colour: '#f3c9bc', imageWidth: 1536, imageHeight: 1024, featured: true },
  { id: 'creator', label: 'Creator', image: creator, tagline: 'Imagine it. Build it differently.', colour: '#f3dfa9', imageWidth: 1536, imageHeight: 1024 },
  { id: 'others', label: 'Others', image: others, tagline: 'More little worlds to discover', colour: '#dfdbc2', imageWidth: 1536, imageHeight: 1024 },
]

export type CatalogueCategory = CategoryPresentation & {
  /** Runtime route key: a preserved curated slug or a deterministic name slug. */
  id: string
  backendId: number
  backendCategory: BackendCategory
  href: string
  image?: string
}

const normalizeName = (name: string) => name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en').replace(/[^a-z0-9]+/g, ' ').trim()
const slugFromName = (name: string, backendId: number) => {
  const slug = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return slug || `category-${backendId}`
}

/** Resolve category existence from the API, applying presentation only when a curated match exists. */
export function resolveCatalogueCategories(categories: readonly BackendCategory[]): CatalogueCategory[] {
  const configs = new Map(categoryPresentation.map((item, index) => [normalizeName(item.label), { item, index }]))
  const candidates = categories.map(category => {
    const configured = configs.get(normalizeName(category.name))
    return { category, presentation: configured?.item, order: configured?.index ?? Number.MAX_SAFE_INTEGER,
      sortName: normalizeName(category.name), baseSlug: configured?.item.id ?? slugFromName(category.name, category.id) }
  }).sort((a, b) => a.order - b.order || a.sortName.localeCompare(b.sortName, 'en') || a.category.id - b.category.id)
  const usedSlugs = new Set<string>()
  return candidates.map(({ category, presentation, baseSlug }) => {
    let slug = baseSlug
    if (usedSlugs.has(slug)) slug = `${baseSlug}-${category.id}`
    while (usedSlugs.has(slug)) slug = `${slug}-${category.id}`
    usedSlugs.add(slug)
    const image = presentation?.image ?? category.imageUrl ?? undefined
    return {
      backendCategory: category,
      ...(presentation ?? { id: slug, label: category.name }),
      id: slug,
      backendId: category.id,
      label: presentation?.label ?? category.name,
      image,
      href: `/categories/${slug}`,
    }
  })
}
export function categoryPresentationById(id: string) {
  return categoryPresentation.find(category => category.id === id)
}
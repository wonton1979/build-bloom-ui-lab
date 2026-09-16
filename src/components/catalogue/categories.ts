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

export type CatalogueCategory = {
  id: string
  label: string
  image: string
  href: string
  tagline: string
  colour: string
  imageWidth: number
  imageHeight: number
  imageScale?: number
}

// Agreed provisional same-origin contract: /categories/<slug>.
// Keep URLs centralized for migration into Colorful Life; this lab has no destination pages.
export const catalogueCategories: readonly CatalogueCategory[] = [
  { id: 'harry-potter', label: 'Harry Potter', image: harryPotter, href: '/categories/harry-potter', tagline: 'Magic in every build', colour: '#ead4c3', imageWidth: 1536, imageHeight: 1024 },
  { id: 'star-wars', label: 'Star Wars', image: starWars, href: '/categories/star-wars', tagline: 'Adventure among the stars', colour: '#cbdde8', imageWidth: 1536, imageHeight: 1024 },
  { id: 'friends', label: 'Friends', image: friends, href: '/categories/friends', tagline: 'Build brighter days together', colour: '#f3cdd8', imageWidth: 1536, imageHeight: 1024 },
  { id: 'city', label: 'City', image: city, href: '/categories/city', tagline: 'Every street tells a story', colour: '#d1e2df', imageWidth: 1536, imageHeight: 1024, imageScale: 1.08 },
  { id: 'disney', label: 'Disney', image: disney, href: '/categories/disney', tagline: 'Build a little wonder', colour: '#dfd5ed', imageWidth: 1536, imageHeight: 1024, imageScale: 1.12 },
  { id: 'marvel', label: 'Marvel', image: marvel, href: '/categories/marvel', tagline: 'Heroes assemble here', colour: '#f1cbb8', imageWidth: 1536, imageHeight: 1024, imageScale: 1.08 },
  { id: 'jurassic-world', label: 'Jurassic World', image: jurassicWorld, href: '/categories/jurassic-world', tagline: 'Big adventures from another age', colour: '#d5dfbc', imageWidth: 1536, imageHeight: 1024 },
  { id: 'flowers-botanicals', label: 'Flowers & Botanicals', image: flowers, href: '/categories/flowers-botanicals', tagline: 'Build something beautiful', colour: '#e4e6b8', imageWidth: 1536, imageHeight: 1024, imageScale: 1.1 },
  { id: 'ninjago', label: 'NINJAGO', image: ninjago, href: '/categories/ninjago', tagline: 'Train. Build. Adventure.', colour: '#c9e0d5', imageWidth: 1536, imageHeight: 1024, imageScale: 1.1 },
  { id: 'dc-batman', label: 'DC & Batman', image: dcBatman, href: '/categories/dc-batman', tagline: 'Heroes after dark', colour: '#d9d5e7', imageWidth: 1374, imageHeight: 1145 },
  { id: 'vehicles', label: 'Vehicles', image: vehicles, href: '/categories/vehicles', tagline: 'Built for the thrill', colour: '#f3c9bc', imageWidth: 1536, imageHeight: 1024 },
  { id: 'creator', label: 'Creator', image: creator, href: '/categories/creator', tagline: 'Imagine it. Build it differently.', colour: '#f3dfa9', imageWidth: 1536, imageHeight: 1024 },
  { id: 'others', label: 'Others', image: others, href: '/categories/others', tagline: 'More little worlds to discover', colour: '#dfdbc2', imageWidth: 1536, imageHeight: 1024 },
]

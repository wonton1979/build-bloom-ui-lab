export type Artwork = { src: string; alt: string }

export type CatalogueChapter = {
  id: string
  title: string
  subtitle: string
  page: string
  colour: string
  tabColour: string
  symbol: string
  artwork?: Artwork
}

export const catalogueChapters: readonly CatalogueChapter[] = [
  { id: 'space', title: 'Space', subtitle: 'Reach for new adventures', page: '06', colour: '#c9d9e9', tabColour: '#326993', symbol: '★' },
  { id: 'city-town', title: 'City & Town', subtitle: 'Build your world', page: '14', colour: '#cbd9e9', tabColour: '#e9b745', symbol: '▦' },
  { id: 'vehicles', title: 'Vehicles', subtitle: 'On the move', page: '24', colour: '#f5bcb0', tabColour: '#d96451', symbol: '↗' },
  { id: 'castles-adventure', title: 'Castles & Adventure', subtitle: 'Stories await', page: '34', colour: '#c7ded5', tabColour: '#9274ad', symbol: '♜' },
  { id: 'animals', title: 'Animals', subtitle: 'Friends for life', page: '44', colour: '#cfe2cc', tabColour: '#7eaa60', symbol: '♧' },
  { id: 'flowers-nature', title: 'Flowers & Nature', subtitle: 'Let creativity grow', page: '54', colour: '#e0e6a4', tabColour: '#83b9a7', symbol: '✿' },
  { id: 'pre-loved', title: 'Pre-Loved Treasures', subtitle: 'Great sets find new homes', page: '62', colour: '#f9d8a4', tabColour: '#e9a047', symbol: '◇' },
  { id: 'new-arrivals', title: 'New Arrivals', subtitle: 'Fresh ideas, more to explore', page: '70', colour: '#f6c5c2', tabColour: '#e88d94', symbol: '✧' },
]

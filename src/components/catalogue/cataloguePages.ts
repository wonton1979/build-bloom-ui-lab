import { catalogueCategories } from './categories'

/** Four physical pages assembled from the centralized category records. */
export const cataloguePages = [
  catalogueCategories.slice(0, 3),
  catalogueCategories.slice(3, 7),
  catalogueCategories.slice(7, 10),
  catalogueCategories.slice(10),
] as const

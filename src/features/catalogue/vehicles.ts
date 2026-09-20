import { getCategories, getProducts } from './api'

export async function getVehicles(signal?: AbortSignal) {
  const categories = await getCategories(signal)
  const category = categories.find(item => item.name === 'Vehicles')
  if (!category) throw new Error('Vehicles category is unavailable')
  const listings = await getProducts({ categoryId: category.id }, signal)
  if (listings.some((listing) => !('category' in listing) ||
    typeof listing.isFeatureProduct !== 'boolean' || !('catalogueArtworkUrl' in listing) ||
    typeof listing.createdAt !== 'string')) {
    throw new Error('Catalogue API contract mismatch: category or presentation fields are missing')
  }
  return listings.filter((listing) => listing.category?.id === category.id)
}

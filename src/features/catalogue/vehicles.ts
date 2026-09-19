import { getProducts } from './api'

export async function getVehicles(signal?: AbortSignal) {
  const listings = await getProducts({ category: 'VEHICLES' }, signal)
  if (listings.some((listing) => !('colorfulLifeCategory' in listing) ||
    typeof listing.isFeatureProduct !== 'boolean' || !('catalogueArtworkUrl' in listing) ||
    typeof listing.createdAt !== 'string')) {
    throw new Error('Catalogue API contract mismatch: category or presentation fields are missing')
  }
  return listings.filter((listing) => listing.colorfulLifeCategory === 'VEHICLES')
}

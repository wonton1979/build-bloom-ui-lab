import { getProducts, type ProductListing } from './api'

// Set numbers choose editorial placement only within the official category.
// Category membership always comes from ProductListing.colorfulLifeCategory.
export function selectVehicle(listings: ProductListing[], setNumber: string) {
  return listings
    .filter((listing) => listing.colorfulLifeCategory === 'VEHICLES' && listing.legoProduct.setNumber === setNumber)
    .sort((a, b) => Number(b.condition === 'NEW') - Number(a.condition === 'NEW') || a.id - b.id)[0]
}

export async function getVehicles(signal?: AbortSignal) {
  const listings = await getProducts({ colorfulLifeCategory: 'VEHICLES' }, signal)
  if (listings.some((listing) => !('colorfulLifeCategory' in listing))) {
    throw new Error('Catalogue API contract mismatch: colorfulLifeCategory is missing')
  }
  return listings.filter((listing) => listing.colorfulLifeCategory === 'VEHICLES')
}

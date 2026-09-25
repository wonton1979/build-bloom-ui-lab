import { getCategories, getProducts } from './api'

export async function getVehicles(signal?: AbortSignal) {
  const categories = await getCategories(signal)
  const category = categories.find(item => item.name === 'Vehicles')
  if (!category) throw new Error('Vehicles category is unavailable')
  const products = await getProducts({ categoryId: category.id }, signal)
  if (products.some(product => !('category' in product) || typeof product.isFeatureProduct !== 'boolean' || !Array.isArray(product.offers))) {
    throw new Error('Catalogue API contract mismatch: product offers or presentation fields are missing')
  }
  return products.filter(product => product.category?.id === category.id)
}

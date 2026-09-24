import type { BackendCategory } from '../../features/catalogue/api'
import { categoryPresentation } from './categories'

export const curatedBackendCategories: BackendCategory[] = categoryPresentation.map((presentation, index) => ({
  id: 100 + index,
  name: presentation.label,
  subtitle: null,
  description: null,
  imageUrl: null,
}))

export const backendCategory = (id: number, name: string, overrides: Partial<BackendCategory> = {}): BackendCategory => ({
  id,
  name,
  subtitle: null,
  description: null,
  imageUrl: null,
  ...overrides,
})
import type { CatalogueCategory } from './categories'

/** Physical catalogue pages preserve the approved three-entry maximum. */
export function paginateCatalogueCategories(categories: readonly CatalogueCategory[], pageSize = 3): CatalogueCategory[][] {
  const pages: CatalogueCategory[][] = []
  for (let start = 0; start < categories.length; start += pageSize) pages.push(categories.slice(start, start + pageSize))
  return pages
}

export function pairCataloguePages<T>(pages: readonly T[]): [T | undefined, T | undefined][] {
  const spreads: [T | undefined, T | undefined][] = []
  for (let index = 0; index < pages.length; index += 2) spreads.push([pages[index], pages[index + 1]])
  return spreads
}
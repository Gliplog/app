import type { Catalog, CatalogProduct, PkProfile, Trial } from '@/domain/catalog'
import medicationsJson from './medications.json'

/*
 * The JSON is bundled (and therefore precached for offline use). Its shape is enforced by the
 * JSON Schema beside it in tests/data/catalog.spec.ts, so the cast here is checked at test time
 * rather than trusted.
 */
export const catalog = medicationsJson as unknown as Catalog

export function findProduct(id: string | null | undefined): CatalogProduct | undefined {
  return id ? catalog.products.find((p) => p.id === id) : undefined
}

export function findPkProfile(id: string | null | undefined): PkProfile | undefined {
  return id ? catalog.pkProfiles.find((p) => p.id === id) : undefined
}

/** The trials a product lists, in the product's order of relevance. */
export function trialsFor(product: CatalogProduct | undefined): Trial[] {
  if (!product) return []
  return product.trialIds.flatMap((id) => catalog.trials.filter((t) => t.id === id))
}

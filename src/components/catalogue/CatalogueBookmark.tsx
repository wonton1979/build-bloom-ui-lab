import './CityBookmark.css'
import type { CSSProperties } from 'react'

export type CatalogueBookmarkDefinition = {
  id: string
  label: string
  href: string
  asset: string
  width: number
  height: number
  top: string
  extraReveal?: number
}

export function CatalogueBookmark({ definition, onActivate }: {
  definition: CatalogueBookmarkDefinition
  onActivate?: (href: string) => void
}) {
  return (
    <a
      className={`city-bookmark catalogue-bookmark--${definition.id}`}
      href={definition.href}
      aria-label={`Open ${definition.label} category`}
      style={{
        '--bookmark-top': definition.top,
        '--bookmark-extra-reveal': `${definition.extraReveal ?? 0}px`,
      } as CSSProperties}
      onClick={(event) => {
        if (!onActivate) return
        event.preventDefault()
        onActivate(definition.href)
      }}
    >
      <img src={definition.asset} alt="" width={definition.width} height={definition.height} decoding="async" />
    </a>
  )
}

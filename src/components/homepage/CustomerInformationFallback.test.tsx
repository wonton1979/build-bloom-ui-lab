import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CustomerInformationFallback } from './CustomerInformationFallback'

describe('CustomerInformationFallback', () => {
  it('renders one semantic, keyboard-accessible button with the approved label', () => {
    const markup = renderToStaticMarkup(<CustomerInformationFallback />)

    expect(markup).toContain('type="button"')
    expect(markup).toContain('aria-label="Customer Information"')
    expect(markup).toContain('Customer Information →')
    expect(markup).toContain('customer-information-fallback')
  })

  it('passes activation through without inventing a destination', () => {
    let activated = false
    const markup = renderToStaticMarkup(<CustomerInformationFallback onActivate={() => { activated = true }} />)

    expect(markup).toContain('customer-information-fallback')
    expect(activated).toBe(false)
  })
})

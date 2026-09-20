import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CartContent, CartModal } from './CartModal'

describe('Cart presentation', () => {
  it('uses the empty illustrations and a real Continue Shopping action', () => {
    const markup = renderToStaticMarkup(<CartModal onClose={() => {}} />)
    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('aria-label="Close shopping cart"')
    expect(markup).toContain('Shopping Cart')
    expect(markup).toContain('Your cart is empty')
    expect(markup).toContain('waiting for an adventure.')
    expect(markup).toContain('Continue Shopping')
    expect(markup).toContain('cart-empty-wagon')
    expect(markup).toContain('cart-empty-footer')
    expect(markup).toContain('hr-leaf')
    expect(markup).not.toContain('cart-filled-')
    expect(markup).not.toContain('Checkout')
  })

  it('renders caller-supplied filled content without making up prices or actions', () => {
    const markup = renderToStaticMarkup(<CartContent onContinueShopping={() => {}} content={{
      kind: 'filled', items: <p>Supplied item content</p>, summary: <p>Supplied summary</p>,
      actions: <button type="button">Supplied action</button>,
    }} />)
    expect(markup).toContain('cart-filled-wagon')
    expect(markup).toContain('cart-filled-footer')
    expect(markup).toContain('Supplied item content')
    expect(markup).toContain('Supplied summary')
    expect(markup).toContain('Supplied action')
    expect(markup).not.toContain('Your cart is empty')
    expect(markup).not.toContain('Continue Shopping')
    expect(markup).not.toContain('cart-empty-')
  })

  it('does not invent summary or checkout controls when none are supplied', () => {
    const markup = renderToStaticMarkup(<CartContent onContinueShopping={() => {}} content={{ kind: 'filled', items: <p>Supplied items</p> }} />)
    expect(markup).not.toContain('cart-modal__summary')
    expect(markup).not.toContain('cart-modal__actions')
    expect(markup).not.toContain('Checkout')
  })
})

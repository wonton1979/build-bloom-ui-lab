import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addCartItem, getCart } from './api'

describe('persistent cart API', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('restores the authenticated cart with a bearer token', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    await getCart('jwt-token')
    expect(fetcher).toHaveBeenCalledWith('/api/cart', expect.objectContaining({ method: 'GET' }))
    expect((fetcher.mock.calls[0][1].headers as Headers).get('Authorization')).toBe('Bearer jwt-token')
  })

  it('persists one listing addition without applying a local increment', async () => {
    const response = { items: [{ productListingId: 7, quantity: 2, productListing: {} }] }
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    await addCartItem('jwt-token', 7, 1)
    expect(fetcher).toHaveBeenCalledWith('/api/cart/items', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ productListingId: 7, quantity: 1 }),
    }))
  })

  it('surfaces rejected cart writes instead of fabricating success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Insufficient stock' }), { status: 409 })))
    await expect(addCartItem('jwt-token', 7, 1)).rejects.toThrow('Insufficient stock')
  })
})

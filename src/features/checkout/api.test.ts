import { afterEach, describe, expect, it, vi } from 'vitest'
import { CheckoutApiError, createOrder, getOrder, preparePayment } from './api'
afterEach(() => vi.unstubAllGlobals())
describe('checkout HTTP contracts', () => {
  it('sends listing IDs/quantities with authentication and Idempotency-Key, without totals', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 41 }), { status: 201 })); vi.stubGlobal('fetch', fetch)
    const input = { items: [{ productListingId: 16901, quantity: 2 }] }
    await createOrder('jwt', input, 'attempt-uuid')
    expect(fetch).toHaveBeenCalledWith('/api/orders', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer jwt', 'Idempotency-Key': 'attempt-uuid' }), body: JSON.stringify(input) }))
  })
  it('reads safe order state and initializes Stripe without client amount', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ clientSecret: 'secret' })))); vi.stubGlobal('fetch', fetch)
    await getOrder('jwt', 41); expect(fetch.mock.calls[0][0]).toBe('/api/orders/41')
    expect(await preparePayment('jwt', 41)).toBe('secret'); expect(fetch.mock.calls[1][0]).toBe('/api/orders/41/payments/stripe'); expect(fetch.mock.calls[1][1].body).toBeUndefined()
  })
  it('rejects missing secrets', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}'))); await expect(preparePayment('jwt', 41)).rejects.toThrow('unavailable') })
  it.each(['ORDER_EXPIRED', 'ORDER_NOT_PAYABLE', 'PAYMENT_ALREADY_COMPLETED', 'ORDER_IDEMPOTENCY_MISMATCH', 'INVALID_IDEMPOTENCY_KEY'])('parses structured %s without misleading auth errors', async code => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code, message: 'internal' } }), { status: 409 })))
    try { await createOrder('jwt', { items: [] }, 'uuid'); throw new Error('expected failure') } catch (error) { expect(error).toBeInstanceOf(CheckoutApiError); expect((error as CheckoutApiError).code).toBe(code); expect((error as Error).message).not.toContain('Email already in use') }
  })
})

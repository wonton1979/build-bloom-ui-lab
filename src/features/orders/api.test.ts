import { afterEach, describe, expect, it, vi } from 'vitest'
import { listOrders, readOrder } from './api'
import { AuthApiError } from '../auth/api'
afterEach(() => vi.unstubAllGlobals())
describe('customer order read contracts', () => {
  it('uses GET with Bearer auth and no browser customer ID, preserving list order', async () => {
    const orders = [{ id: 42 }, { id: 41 }]
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(orders))))
    vi.stubGlobal('fetch', fetcher)
    expect(await listOrders('jwt')).toEqual(orders)
    await readOrder('jwt', 41)
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/api/orders', '/api/orders/41'])
    for (const [, init] of fetcher.mock.calls) {
      expect(init.method).toBe('GET'); expect(init.body).toBeUndefined()
      expect(init.headers.get('Authorization')).toBe('Bearer jwt')
    }
  })
  it('retains structured verification errors for protected reads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'EMAIL_VERIFICATION_REQUIRED', message: 'Verify' } }), { status: 403 })))
    await expect(listOrders('jwt')).rejects.toMatchObject({ status: 403, code: 'EMAIL_VERIFICATION_REQUIRED' })
  })
  it('does not hide owner-scoped not-found responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })))
    await expect(readOrder('jwt', 41)).rejects.toBeInstanceOf(AuthApiError)
  })
})

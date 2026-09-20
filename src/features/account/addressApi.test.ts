import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAddress, deleteAddress, getAddresses, updateAddress } from './addressApi'

describe('address API', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('loads the authenticated address book', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    await getAddresses('token')
    expect(fetcher).toHaveBeenCalledWith('/api/users/me/addresses', expect.objectContaining({ method: 'GET' }))
    expect((fetcher.mock.calls[0][1].headers as Headers).get('Authorization')).toBe('Bearer token')
  })

  it('sends address creation and default flags', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 1 }), { status: 201 }))
    vi.stubGlobal('fetch', fetcher)
    await createAddress('token', { recipientName: 'Ada', line1: '1 Main', city: 'Bath', postcode: 'BA1', country: 'GB', isDefaultShipping: true, isDefaultBilling: true })
    expect(fetcher.mock.calls[0][1].body).toContain('isDefaultShipping')
    expect(fetcher.mock.calls[0][1].body).toContain('isDefaultBilling')
  })

  it('patches and deletes by address id', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetcher)
    await updateAddress('token', 1, { city: 'Bristol' })
    await deleteAddress('token', 1)
    expect(fetcher.mock.calls[0][0]).toBe('/api/users/me/addresses/1')
    expect(fetcher.mock.calls[1][0]).toBe('/api/users/me/addresses/1')
  })
})

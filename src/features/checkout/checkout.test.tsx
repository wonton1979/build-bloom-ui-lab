// @vitest-environment jsdom
import { act, useEffect, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CheckoutApiError, createOrder, getOrder, preparePayment, recoverPayment, type Order } from './api'
import { checkoutOrderId, clearAttempt, deliverySnapshot, isConfirmed, isExpired, orderInput, readAttempt, saveAttempt } from './state'
import { useCheckout } from './useCheckout'
import { AuthApiError, getCurrentUser } from '../auth/api'
import type { Address } from '../account/addressApi'
import { cartListing, offer } from '../catalogue/catalogueFixtures'

vi.mock('../auth/api', async original => ({ ...await original<typeof import('../auth/api')>(), getCurrentUser: vi.fn() }))
vi.mock('./api', async importOriginal => ({ ...await importOriginal<typeof import('./api')>(), createOrder: vi.fn(), getOrder: vi.fn(), preparePayment: vi.fn(), recoverPayment: vi.fn() }))
const address: Address = { id: 1, recipientName: 'Customer', line1: '1 Street', line2: null, city: 'London', postcode: 'SW1A 1AA', country: 'United Kingdom', phone: null, isDefaultShipping: true, isDefaultBilling: true }
const input = { items: [{ productListingId: 16901, quantity: 1 }], deliveryAddress: deliverySnapshot(address) }
export const pendingOrder: Order = { id: 41, status: 'PENDING', totalAmount: '20.50', reservationExpiresAt: new Date(Date.now() + 1800000).toISOString(), payment: null, billingRecipientName: 'Billing', billingLine1: '2 Street', billingLine2: null, billingCity: 'London', billingPostcode: 'SW1A 1AA', billingCountryCode: 'GB', deliveryRecipientName: 'Customer', deliveryLine1: '1 Street', deliveryLine2: null, deliveryCity: 'London', deliveryPostcode: 'SW1A 1AA', deliveryCountryCode: 'GB', orderItems: [{ id: 1, quantity: 1, unitPrice: '20.50', lineTotal: '20.50', conditionSnapshot: 'USED_LIKE_NEW', productListing: { id: 16901, legoProduct: { title: 'Flowers', setNumber: '123' } } }] }
const paidOrder = { ...pendingOrder, status: 'CONFIRMED', payment: { status: 'SUCCEEDED', paidAt: '2026-10-06T12:00:00Z' } }
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
let current: ReturnType<typeof useCheckout>
function Harness({ id = null }: { id?: number | null }) { const value = useCheckout('token', 1, id); useEffect(() => { current = value }, [value]); return <p>{value.phase}</p> }
async function mount(element: ReactNode) { const container = document.createElement('div'); document.body.append(container); root = createRoot(container); await act(async () => root.render(element)); return container }
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); window.history.replaceState({}, '', '/checkout'); vi.mocked(getOrder).mockResolvedValue(pendingOrder) })
afterEach(async () => { if (root) await act(async () => root.unmount()); vi.useRealTimers(); document.body.innerHTML = '' })

describe('checkout address, identity and recovery rules', () => {
  it('maps saved delivery explicitly, omitting nulls and default flags', () => { expect(deliverySnapshot(address)).toEqual({ recipientName: 'Customer', line1: '1 Street', city: 'London', postcode: 'SW1A 1AA', countryCode: 'GB' }) })
  it.each(['', 'Unknown country', 'ZZ', 'G', 'GBR'])('blocks invalid country %s', country => { expect(() => deliverySnapshot({ ...address, country })).toThrow('country code') })
  it('blocks missing address fields and preserves distinct listing quantities', () => {
    expect(() => deliverySnapshot({ ...address, city: '' })).toThrow('required fields')
    const listing = cartListing(offer(16901, { legoProductId: 500 }))
    expect(orderInput([{ productListingId: 16901, listing, quantity: 1 }, { productListingId: 16902, listing: { ...listing, id: 16902 }, quantity: 3 }], address).items).toEqual([{ productListingId: 16901, quantity: 1 }, { productListingId: 16902, quantity: 3 }])
  })
  it('requires both paid and legitimate confirmed/fulfilment state', () => {
    expect(isConfirmed(pendingOrder)).toBe(false)
    expect(isConfirmed({ ...paidOrder, status: 'PENDING' })).toBe(false)
    for (const status of ['CONFIRMED', 'DISPATCHED', 'COMPLETED']) expect(isConfirmed({ ...paidOrder, status })).toBe(true)
    expect(isConfirmed({ ...paidOrder, status: 'EXPIRED' })).toBe(false)
  })
  it('recognizes elapsed unpaid reservations and validates URL ids', () => {
    expect(isExpired({ ...pendingOrder, reservationExpiresAt: '2000-01-01' })).toBe(true)
    expect(checkoutOrderId('/checkout/orders/41')).toBe(41)
    expect(checkoutOrderId('/checkout/orders/-1')).toBeNull()
  })
  it('retains exact attempts per account and removes only that attempt', () => {
    saveAttempt(1, { key: 'uuid', input }); expect(readAttempt(1)).toEqual({ key: 'uuid', input }); expect(readAttempt(2)).toBeNull(); clearAttempt(1); expect(readAttempt(1)).toBeNull()
  })
})

describe('checkout orchestration', () => {
  it('blocks duplicate creation and retains the same key/payload after a lost response and refresh', async () => {
    let reject!: (error: Error) => void
    vi.mocked(createOrder).mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail }))
    await mount(<Harness />)
    await act(async () => { void current.create(input); void current.create(input) })
    expect(createOrder).toHaveBeenCalledTimes(1)
    const key = vi.mocked(createOrder).mock.calls[0][2]
    await act(async () => reject(new Error('Network lost')))
    await act(async () => root.unmount())
    await mount(<Harness />)
    vi.mocked(createOrder).mockResolvedValue({ id: 41 })
    await act(async () => current.create({ items: [{ productListingId: 999, quantity: 2 }] }))
    expect(createOrder).toHaveBeenLastCalledWith('token', input, key)
    expect(window.location.pathname).toBe('/checkout/orders/41')
    expect(readAttempt(1)).toBeNull()
  })
  it('recovers an order using GET without creating or initializing payment', async () => {
    await mount(<Harness id={41} />)
    expect(current.phase).toBe('reserved'); expect(current.order?.totalAmount).toBe('20.50'); expect(createOrder).not.toHaveBeenCalled(); expect(preparePayment).not.toHaveBeenCalled()
  })
  it('recovers from a failed initial order read without creating or polling a new order', async () => {
    vi.mocked(getOrder).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(pendingOrder)
    await mount(<Harness id={41} />)
    expect(current.phase).toBe('failure')
    await act(async () => current.reloadOrder())
    expect(current.phase).toBe('reserved'); expect(getOrder).toHaveBeenCalledTimes(2); expect(createOrder).not.toHaveBeenCalled()
  })
  it('initializes only the recovered order and supplies its secret', async () => {
    vi.mocked(preparePayment).mockResolvedValue('secret')
    await mount(<Harness id={41} />)
    await act(async () => current.prepare())
    expect(preparePayment).toHaveBeenCalledWith('token', 41); expect(current.secret).toBe('secret'); expect(current.phase).toBe('payment')
  })
  it('opens confirmed orders directly without Stripe initialization', async () => {
    vi.mocked(getOrder).mockResolvedValue(paidOrder)
    await mount(<Harness id={41} />)
    expect(current.phase).toBe('confirmed'); expect(preparePayment).not.toHaveBeenCalled()
  })
  it('does not confirm from browser success; waits for backend success', async () => {
    vi.useFakeTimers()
    await mount(<Harness id={41} />)
    vi.mocked(getOrder).mockResolvedValueOnce({ ...pendingOrder, payment: { status: 'PROCESSING', paidAt: null } }).mockResolvedValue(paidOrder)
    await act(async () => { void current.verify() })
    expect(current.phase).toBe('waiting')
    await act(async () => vi.advanceTimersByTimeAsync(1000))
    expect(current.phase).toBe('confirmed'); expect(current.secret).toBeNull()
  })
  it('bounds polling and permits a safe recheck without a new order', async () => {
    vi.useFakeTimers(); await mount(<Harness id={41} />)
    await act(async () => { void current.verify() })
    await act(async () => vi.advanceTimersByTimeAsync(29000))
    expect(current.phase).toBe('pending'); expect(getOrder).toHaveBeenCalledTimes(8)
    vi.mocked(getOrder).mockResolvedValue(paidOrder)
    await act(async () => current.verify())
    expect(current.phase).toBe('confirmed'); expect(createOrder).not.toHaveBeenCalled()
  })
  it.each(['CONFIRMED', 'DISPATCHED', 'COMPLETED'])('explicit recovery recognizes paid %s without a new order, intent or key', async status => {
    saveAttempt(1, { key: 'original-key', input })
    const uuid = vi.spyOn(crypto, 'randomUUID')
    vi.mocked(recoverPayment).mockResolvedValue({ ...paidOrder, status })
    await mount(<Harness id={41} />)
    expect(recoverPayment).not.toHaveBeenCalled()
    await act(async () => current.recheck())
    expect(recoverPayment).toHaveBeenCalledExactlyOnceWith('token', 41)
    expect(current.phase).toBe('confirmed'); expect(current.secret).toBeNull()
    expect(getOrder).toHaveBeenCalledTimes(1)
    await act(async () => current.recheck())
    expect(recoverPayment).toHaveBeenCalledTimes(1)
    expect(createOrder).not.toHaveBeenCalled(); expect(preparePayment).not.toHaveBeenCalled()
    expect(uuid).not.toHaveBeenCalled(); uuid.mockRestore()
    expect(readAttempt(1)).toEqual({ key: 'original-key', input })
  })
  it.each(['PENDING', 'PROCESSING', 'FAILED', 'SUCCEEDED'])('does not confirm a non-success %s recovery response or offer another payment', async status => {
    vi.mocked(recoverPayment).mockResolvedValue({ ...pendingOrder, payment: { status, paidAt: null } })
    await mount(<Harness id={41} />); await act(async () => current.recheck())
    expect(current.phase).toBe('pending'); expect(current.order?.payment?.status).toBe(status)
    expect(current.secret).toBeNull(); expect(preparePayment).not.toHaveBeenCalled()
    await act(async () => current.recheck())
    expect(recoverPayment).toHaveBeenCalledTimes(2); expect(createOrder).not.toHaveBeenCalled()
  })
  it.each(['CANCELED', 'expired'])('stops %s authoritative recovery without restarting payment', async status => {
    vi.mocked(recoverPayment).mockResolvedValue(status === 'expired' ? { ...pendingOrder, status: 'EXPIRED' } : { ...pendingOrder, payment: { status, paidAt: null } })
    await mount(<Harness id={41} />); await act(async () => current.recheck())
    expect(current.phase).toBe('terminal'); await act(async () => current.recheck())
    expect(recoverPayment).toHaveBeenCalledTimes(1); expect(preparePayment).not.toHaveBeenCalled()
  })
  it.each([new Error('offline'), new CheckoutApiError(503), new CheckoutApiError(409, 'STRIPE_RECOVERY_UNAVAILABLE'), new CheckoutApiError(409, 'STRIPE_RECOVERY_MISMATCH')])('keeps recovery failures retryable without creation or payment setup: %s', async reason => {
    saveAttempt(1, { key: 'original-key', input })
    vi.mocked(recoverPayment).mockRejectedValueOnce(reason).mockResolvedValue(paidOrder)
    await mount(<Harness id={41} />); await act(async () => current.recheck())
    expect(current.phase).toBe('pending'); expect(current.message).toBeTruthy(); expect(current.secret).toBeNull()
    expect(readAttempt(1)).toEqual({ key: 'original-key', input })
    await act(async () => current.recheck())
    expect(current.phase).toBe('confirmed'); expect(current.message).toBeNull()
    expect(createOrder).not.toHaveBeenCalled(); expect(preparePayment).not.toHaveBeenCalled()
  })
  it.each([401, 403, 404])('preserves recovery authentication/ownership failures (%s)', async status => {
    vi.mocked(recoverPayment).mockRejectedValue(new CheckoutApiError(status))
    await mount(<Harness id={41} />); await act(async () => current.recheck())
    expect(current.phase).toBe(status === 404 ? 'terminal' : 'auth')
    expect(createOrder).not.toHaveBeenCalled(); expect(preparePayment).not.toHaveBeenCalled()
  })
  it('locks duplicate rechecks until the existing recovery completes', async () => {
    let finish!: (order: Order) => void
    vi.mocked(recoverPayment).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    await mount(<Harness id={41} />)
    await act(async () => { void current.recheck(); void current.recheck() })
    expect(current.phase).toBe('waiting'); expect(recoverPayment).toHaveBeenCalledTimes(1)
    await act(async () => finish(paidOrder)); expect(current.phase).toBe('confirmed')
  })
  it('does not recover during normal order reads, polling or redirect return', async () => {
    vi.mocked(getOrder).mockResolvedValue(paidOrder)
    history.replaceState({}, '', '/checkout/orders/41?payment_intent=pi_mock')
    await mount(<Harness id={41} />); await act(async () => current.reloadOrder()); await act(async () => current.verify())
    expect(recoverPayment).not.toHaveBeenCalled()
  })
  it('resolves the non-payable initiation race through authoritative confirmation', async () => {
    await mount(<Harness id={41} />)
    vi.mocked(getOrder).mockResolvedValueOnce(pendingOrder).mockResolvedValue(paidOrder)
    vi.mocked(preparePayment).mockRejectedValue(new CheckoutApiError(409, 'ORDER_NOT_PAYABLE'))
    await act(async () => current.prepare())
    expect(getOrder).toHaveBeenCalledTimes(3); expect(current.phase).toBe('confirmed')
    expect(current.secret).toBeNull(); expect(current.message).toBeNull(); expect(recoverPayment).not.toHaveBeenCalled()
  })
  it('does not reread or conceal unrelated payment initiation errors', async () => {
    await mount(<Harness id={41} />)
    vi.mocked(preparePayment).mockRejectedValue(new CheckoutApiError(409, 'OTHER_CONFLICT'))
    await act(async () => current.prepare())
    expect(getOrder).toHaveBeenCalledTimes(2); expect(current.phase).toBe('failure')
    expect(current.message).toBeTruthy()
  })
  it('stops expired orders and never starts Stripe', async () => {
    vi.mocked(getOrder).mockResolvedValue({ ...pendingOrder, status: 'EXPIRED' })
    await mount(<Harness id={41} />); await act(async () => current.prepare())
    expect(current.phase).toBe('terminal'); expect(preparePayment).not.toHaveBeenCalled()
  })
  it('stops an open payment form when its reservation expires', async () => {
    vi.useFakeTimers()
    vi.mocked(getOrder).mockResolvedValue({ ...pendingOrder, reservationExpiresAt: new Date(Date.now() + 1000).toISOString() })
    vi.mocked(preparePayment).mockResolvedValue('secret')
    await mount(<Harness id={41} />); await act(async () => current.prepare())
    expect(current.phase).toBe('payment')
    await act(async () => vi.advanceTimersByTimeAsync(1000))
    expect(current.phase).toBe('terminal'); expect(current.secret).toBeNull()
  })
  it('verifies a Stripe redirect return and strips provider parameters', async () => {
    history.replaceState({}, '', '/checkout/orders/41?payment_intent=pi_test&payment_intent_client_secret=secret&redirect_status=succeeded')
    vi.mocked(getOrder).mockResolvedValueOnce(pendingOrder).mockResolvedValue(paidOrder)
    await mount(<Harness id={41} />)
    expect(current.phase).toBe('confirmed'); expect(location.search).toBe(''); expect(createOrder).not.toHaveBeenCalled()
  })
  it('preserves authentication failures during verification', async () => {
    await mount(<Harness id={41} />)
    vi.mocked(getOrder).mockRejectedValue(new CheckoutApiError(401, 'SESSION_INVALID'))
    await act(async () => current.verify())
    expect(current.phase).toBe('auth')
  })
  it('maps a non-payable backend order to a terminal state', async () => {
    await mount(<Harness id={41} />)
    vi.mocked(preparePayment).mockRejectedValue(new CheckoutApiError(409, 'ORDER_NOT_PAYABLE'))
    await act(async () => current.prepare())
    expect(current.phase).toBe('terminal'); expect(current.secret).toBeNull(); expect(current.message).toContain('no longer available'); expect(getOrder).toHaveBeenCalledTimes(3)
  })
  it('retains the original identity after a definite verification rejection and blocks another order POST', async () => {
    vi.mocked(createOrder).mockRejectedValue(new CheckoutApiError(403, 'EMAIL_VERIFICATION_REQUIRED'))
    await mount(<Harness />); await act(async () => current.create(input))
    expect(current.phase).toBe('verification')
    const saved = readAttempt(1)!
    expect(saved).toMatchObject({ input, rejection: 'EMAIL_VERIFICATION_REQUIRED' })
    await act(async () => current.create(input)); expect(createOrder).toHaveBeenCalledTimes(1)
    await act(async () => root.unmount()); await mount(<Harness />)
    vi.mocked(getCurrentUser).mockRejectedValue(new AuthApiError(403, 'Verify', 'New wording', 'EMAIL_VERIFICATION_REQUIRED'))
    await act(async () => current.create(input))
    expect(current.phase).toBe('verification'); expect(createOrder).toHaveBeenCalledTimes(1)
    expect(readAttempt(1)?.key).toBe(saved.key)
  })
  it('continues the original request after verification and retains ambiguous recovery on a subsequent timeout', async () => {
    saveAttempt(1, { key: 'original-key', input, rejection: 'EMAIL_VERIFICATION_REQUIRED' })
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 1, email: 'test@example.com', firstName: null, lastName: null, phone: null })
    vi.mocked(createOrder).mockRejectedValueOnce(new Error('Response lost')).mockResolvedValue({ id: 41 })
    await mount(<Harness />); await act(async () => current.create({ items: [{ productListingId: 999, quantity: 3 }] }))
    expect(current.phase).toBe('failure'); expect(readAttempt(1)).toEqual({ key: 'original-key', input })
    await act(async () => current.create(input))
    expect(createOrder).toHaveBeenNthCalledWith(1, 'token', input, 'original-key')
    expect(createOrder).toHaveBeenNthCalledWith(2, 'token', input, 'original-key')
    expect(location.pathname).toBe('/checkout/orders/41')
  })
  it('handles idempotency mismatch intentionally', async () => {
    vi.mocked(createOrder).mockRejectedValue(new CheckoutApiError(409, 'ORDER_IDEMPOTENCY_MISMATCH'))
    await mount(<Harness />); await act(async () => current.create(input))
    expect(current.phase).toBe('terminal'); expect(current.message).toContain('request changed')
  })
  it('re-reads an already-completed payment rather than offering another charge', async () => {
    await mount(<Harness id={41} />)
    vi.mocked(getOrder).mockResolvedValueOnce(pendingOrder).mockResolvedValue(paidOrder)
    vi.mocked(preparePayment).mockRejectedValue(new CheckoutApiError(409, 'PAYMENT_ALREADY_COMPLETED'))
    await act(async () => current.prepare())
    expect(current.phase).toBe('confirmed'); expect(current.secret).toBeNull()
  })
})

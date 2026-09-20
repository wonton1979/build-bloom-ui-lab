import { requestJson } from '../auth/api'

export type Address = {
  id: number
  recipientName: string
  line1: string
  line2: string | null
  city: string
  postcode: string
  country: string
  phone: string | null
  isDefaultShipping: boolean
  isDefaultBilling: boolean
}

export type AddressInput = {
  recipientName: string
  line1: string
  line2?: string | null
  city: string
  postcode: string
  country: string
  phone?: string | null
  isDefaultShipping?: boolean
  isDefaultBilling?: boolean
}

export type AddressUpdate = Partial<AddressInput>

export function getAddresses(token: string) {
  return requestJson<Address[]>('/users/me/addresses', { method: 'GET' }, token)
}

export function createAddress(token: string, address: AddressInput) {
  return requestJson<Address>('/users/me/addresses', { method: 'POST', body: JSON.stringify(address) }, token)
}

export function updateAddress(token: string, id: number, address: AddressUpdate) {
  return requestJson<Address>(`/users/me/addresses/${id}`, { method: 'PATCH', body: JSON.stringify(address) }, token)
}

export function deleteAddress(token: string, id: number) {
  return requestJson<void>(`/users/me/addresses/${id}`, { method: 'DELETE' }, token)
}

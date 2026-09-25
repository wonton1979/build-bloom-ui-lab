import { useEffect, useState } from 'react'
import type { CatalogueProduct } from './api'
import { getVehicles } from './vehicles'

export type VehiclesState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; products: CatalogueProduct[] }

export function useVehicles(enabled: boolean) {
  const [state, setState] = useState<VehiclesState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    getVehicles(controller.signal).then(
      (products) => { if (!controller.signal.aborted) setState({ status: 'ready', products }) },
      () => { if (!controller.signal.aborted) setState({ status: 'error' }) },
    )
    return () => controller.abort()
  }, [enabled, attempt])
  const retry = () => {
    setState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }
  return { state, retry }
}

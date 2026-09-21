import { createContext, useContext } from 'react'

export const LeafletActions = createContext<{ leave: (complete: () => void) => Promise<void>; closing: boolean } | null>(null)

export function useLeafletActions() {
  const actions = useContext(LeafletActions)
  if (!actions) throw new Error('Leaflet content must be inside LeafletShell')
  return actions
}

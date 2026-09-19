import './CustomerInformationFallback.css'

type CustomerInformationFallbackProps = {
  onActivate?: () => void
}

/** A small tabletop reminder for widths where the environmental notebook is cropped. */
export function CustomerInformationFallback({ onActivate }: CustomerInformationFallbackProps) {
  return (
    <button
      className="customer-information-fallback"
      type="button"
      aria-label="Customer Information"
      onClick={onActivate}
    >
      Customer Information →
    </button>
  )
}

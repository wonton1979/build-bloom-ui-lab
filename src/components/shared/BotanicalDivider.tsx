import leaf from '../../assets/shared/hr-leaf.png'
import './BotanicalDivider.css'

export function BotanicalDivider() {
  return <div className="botanical-divider" aria-hidden="true"><img src={leaf} alt="" width={120} height={122} /></div>
}

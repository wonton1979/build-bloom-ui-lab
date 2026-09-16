import { useEffect, useRef, useState } from 'react'
import idle from '../../assets/homepage/tabletop/cart/cart-idle.png'
import pop02 from '../../assets/homepage/tabletop/cart/cart-pop-02.png'
import pop03 from '../../assets/homepage/tabletop/cart/cart-pop-03.png'
import pop04 from '../../assets/homepage/tabletop/cart/cart-pop-04.png'
import pop05 from '../../assets/homepage/tabletop/cart/cart-pop-05.png'
import pop06 from '../../assets/homepage/tabletop/cart/cart-pop-06.png'
import pop07 from '../../assets/homepage/tabletop/cart/cart-pop-07.png'
import pop08 from '../../assets/homepage/tabletop/cart/cart-pop-08.png'
import './BookOwnedCart.css'
const frames = [idle, pop02, pop03, pop04, pop05, pop06, pop07, pop08]
export function BookOwnedCart({ onGuestClick }: { onGuestClick?: () => void }) { const [frame, setFrame] = useState(0); const running = useRef(false); const timers = useRef<number[]>([]); useEffect(() => () => timers.current.forEach(window.clearTimeout), []); const pop = () => { if (running.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; running.current = true; timers.current = frames.slice(1).map((_, i) => window.setTimeout(() => { setFrame(i + 1); if (i === frames.length - 2) running.current = false }, (i + 1) * 80)) }; return <button className="stage-cart" type="button" aria-label="Open your cart" onClick={onGuestClick} onMouseEnter={pop} onFocus={pop}><img src={frames[frame]} alt="" width={1536} height={1024} /></button> }

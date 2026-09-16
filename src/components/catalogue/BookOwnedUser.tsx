import { useEffect, useRef, useState } from 'react'
import idle from '../../assets/homepage/tabletop/user/user-idle.png'
import wave02 from '../../assets/homepage/tabletop/user/user-wave-02.png'
import wave03 from '../../assets/homepage/tabletop/user/user-wave-03.png'
import wave04 from '../../assets/homepage/tabletop/user/user-wave-04.png'
import wave05 from '../../assets/homepage/tabletop/user/user-wave-05.png'
import wave06 from '../../assets/homepage/tabletop/user/user-wave-06.png'
import wave07 from '../../assets/homepage/tabletop/user/user-wave-07.png'
import wave08 from '../../assets/homepage/tabletop/user/user-wave-08.png'
import './BookOwnedUser.css'

const frames = [idle,wave02,wave03,wave04,wave05,wave06,wave07,wave08,wave07,wave06,wave05,wave04,wave03,wave02,idle]
export function BookOwnedUser({ onOpenAccount, onGuestHint }: { onOpenAccount: () => void; onGuestHint?: () => void }) {
  const [frame,setFrame]=useState(0); const running=useRef(false); const timers=useRef<number[]>([])
  useEffect(()=>()=>timers.current.forEach(window.clearTimeout),[])
  const wave=()=>{if(running.current||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return; running.current=true; timers.current=frames.slice(1).map((_,i)=>window.setTimeout(()=>{setFrame(i+1);if(i===frames.length-2)running.current=false},(i+1)*100))}
  return <button className="stage-user" type="button" aria-label="Open your account" onClick={onOpenAccount} onMouseEnter={() => { wave(); onGuestHint?.() }} onFocus={() => { wave(); onGuestHint?.() }}>
    <img src={frames[frame]} alt="" width={270} height={378} />
  </button>
}

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import type { RefObject } from 'react'
import { motion } from './tokens'
import { useReducedMotion } from './reducedMotion'

export function useNavigationMotion(scope: RefObject<HTMLElement | null>, key: string) {
  const reduced = useReducedMotion()
  useGSAP(() => {
    const active = scope.current?.querySelector('.active')
    if (reduced || !active) return
    return gsap.fromTo(active, { x: -4, autoAlpha: 0.7 }, { x: 0, autoAlpha: 1, duration: motion.standard, ease: motion.ease, clearProps: 'transform,visibility' })
  }, { scope, dependencies: [key, reduced], revertOnUpdate: true })
}

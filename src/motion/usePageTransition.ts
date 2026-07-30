import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import type { RefObject } from 'react'
import { motion } from './tokens'
import { useReducedMotion } from './reducedMotion'

export function usePageTransition(scope: RefObject<HTMLElement | null>, key: string | undefined) {
  const reduced = useReducedMotion()
  useGSAP(() => {
    if (reduced || !scope.current) return
    return gsap.fromTo(scope.current, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: motion.standard, ease: motion.ease, clearProps: 'transform,visibility' })
  }, { scope, dependencies: [key, reduced], revertOnUpdate: true })
}

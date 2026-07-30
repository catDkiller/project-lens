import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import type { RefObject } from 'react'
import { motion } from './tokens'
import { useReducedMotion } from './reducedMotion'

gsap.registerPlugin(useGSAP)

export function useEntranceMotion(scope: RefObject<HTMLElement | null>, key: string, selector = '[data-motion-enter]') {
  const reduced = useReducedMotion()
  useGSAP(() => {
    const targets = scope.current ? [...scope.current.querySelectorAll<HTMLElement>(selector)] : []
    if (reduced) return gsap.set(targets, { autoAlpha: 1, clearProps: 'transform,visibility' })
    return gsap.fromTo(targets, { autoAlpha: 0, y: motion.distance }, { autoAlpha: 1, y: 0, duration: motion.page, ease: motion.ease, stagger: motion.stagger, clearProps: 'transform,visibility' })
  }, { scope, dependencies: [key, reduced], revertOnUpdate: true })
}

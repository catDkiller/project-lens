import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import type { RefObject } from 'react'
import { motion } from './tokens'
import { useReducedMotion } from './reducedMotion'

export function useControlMotion(scope: RefObject<HTMLElement | null>) {
  const reduced = useReducedMotion()
  useGSAP((_, contextSafe) => {
    if (reduced) return
    const safe = contextSafe ?? ((callback: (event: Event) => void) => callback)
    const controls = scope.current ? [...scope.current.querySelectorAll<HTMLElement>('button:not(:disabled), summary')] : []
    const enter = safe((event: Event) => gsap.to(event.currentTarget, { y: -1, duration: motion.fast, ease: motion.ease, overwrite: 'auto' }))
    const leave = safe((event: Event) => gsap.to(event.currentTarget, { y: 0, scale: 1, duration: motion.fast, ease: motion.ease, overwrite: 'auto' }))
    const down = safe((event: Event) => gsap.to(event.currentTarget, { scale: 0.985, duration: motion.fast, ease: motion.ease, overwrite: 'auto' }))
    controls.forEach((item) => { item.addEventListener('pointerenter', enter); item.addEventListener('pointerleave', leave); item.addEventListener('pointerdown', down); item.addEventListener('pointerup', leave) })
    return () => controls.forEach((item) => { item.removeEventListener('pointerenter', enter); item.removeEventListener('pointerleave', leave); item.removeEventListener('pointerdown', down); item.removeEventListener('pointerup', leave) })
  }, { scope, dependencies: [reduced], revertOnUpdate: true })
}

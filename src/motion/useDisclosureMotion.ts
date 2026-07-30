import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import type { RefObject } from 'react'
import { motion } from './tokens'
import { useReducedMotion } from './reducedMotion'

export function useDisclosureMotion(scope: RefObject<HTMLElement | null>) {
  const reduced = useReducedMotion()
  useGSAP((_, contextSafe) => {
    const safe = contextSafe ?? ((callback: (event: Event) => void) => callback)
    const details = [...(scope.current?.matches('details') ? [scope.current as HTMLDetailsElement] : []), ...(scope.current ? [...scope.current.querySelectorAll<HTMLDetailsElement>('details:not(.theme-menu)')] : [])]
    const onToggle = safe((event: Event) => {
      const target = event.currentTarget as HTMLDetailsElement
      if (reduced || !target.open) return
      const content = [...target.children].filter((child) => child.tagName !== 'SUMMARY')
      gsap.fromTo(content, { autoAlpha: 0, y: 4 }, { autoAlpha: 1, y: 0, duration: motion.standard, ease: motion.ease, stagger: 0.03, clearProps: 'transform,visibility' })
    })
    const onSummaryClick = safe((event: Event) => {
      const detailsElement = (event.currentTarget as HTMLElement).parentElement as HTMLDetailsElement | null
      if (reduced || !detailsElement?.open) return
      event.preventDefault()
      const content = [...detailsElement.children].filter((child) => child.tagName !== 'SUMMARY')
      gsap.to(content, { autoAlpha: 0, y: -4, duration: motion.standard, ease: motion.ease, stagger: 0.02, onComplete: () => { detailsElement.open = false } })
    })
    details.forEach((item) => item.addEventListener('toggle', onToggle))
    details.forEach((item) => item.querySelector('summary')?.addEventListener('click', onSummaryClick))
    return () => details.forEach((item) => { item.removeEventListener('toggle', onToggle); item.querySelector('summary')?.removeEventListener('click', onSummaryClick) })
  }, { scope, dependencies: [reduced], revertOnUpdate: true })
}

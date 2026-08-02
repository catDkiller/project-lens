import { useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ReportDemo } from './components/ReportDemo'
import { DemoVideo } from './components/DemoVideo'

gsap.registerPlugin(useGSAP, ScrollTrigger)

const github = 'https://github.com/catDkiller/project-lens'
const repositoryFiles = ['app/', 'api/', 'services/', 'config/', 'tests/', 'package.json']
const process = ['Select a local project', 'Stage an isolated snapshot', 'Analyse it with Codex', 'Generate persistent artifacts', 'Explore the structured guide']

export function App() {
  const root = useRef<HTMLElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [transformView, setTransformView] = useState<'files' | 'understanding'>('files')

  useGSAP(() => {
    const media = gsap.matchMedia()
    media.add({ desktop: '(min-width: 850px)', motion: '(prefers-reduced-motion: no-preference)' }, (context) => {
      const { desktop, motion } = context.conditions as { desktop: boolean; motion: boolean }
      if (!motion) return

      gsap.from('.hero-copy > *', { y: 18, autoAlpha: 0, duration: 0.75, stagger: 0.09, ease: 'power2.out' })
      if (desktop) {
        gsap.set('.hero-video', { filter: 'brightness(1) saturate(1)' })
        gsap.timeline({
          scrollTrigger: {
            id: 'hero-sea-transition', trigger: '.hero-stage', start: 'top top', end: '+=75%', pin: true, scrub: 1.05,
          },
        })
          .to('.hero-shade', { opacity: 0.93, duration: 1, ease: 'none' }, 0)
          .to('.hero-video', { scale: 1.045, filter: 'brightness(.34) saturate(.58)', duration: 0.95, ease: 'none' }, 0)
          .to('.hero-copy', { yPercent: -16, autoAlpha: 0.18, duration: 0.75, ease: 'none' }, 0.22)
          .to('.hero-afterglow', { autoAlpha: 1, duration: 0.42, ease: 'none' }, 0.55)
          .to('.hero-video', { autoAlpha: 0, duration: 0.18, ease: 'none' }, 0.82)
      }
      gsap.utils.toArray<HTMLElement>('.reveal').forEach((element) => gsap.from(element, {
        y: 22, autoAlpha: 0, duration: 0.65, ease: 'power2.out', scrollTrigger: { trigger: element, start: 'top 84%', once: true },
      }))
    })
    return () => media.revert()
  }, { scope: root })

  const setPlaybackRate = () => {
    if (!video.current) return
    video.current.defaultPlaybackRate = 0.76
    video.current.playbackRate = 0.76
  }
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })

  return <main ref={root}>
    <a className="skip-link" href="#story">Skip cinematic introduction</a>
    <section className="hero-stage" aria-labelledby="hero-title">
      <video ref={video} className="hero-video" autoPlay muted loop playsInline preload="metadata" poster="/media/project-lens-poster.svg" aria-hidden="true" onLoadedMetadata={setPlaybackRate} onPlay={setPlaybackRate}>
        <source src="/media/project-lens-sea.mp4" type="video/mp4" />
      </video>
      <div className="hero-shade" /><div className="hero-afterglow" aria-hidden="true" />
      <header className="site-header"><a href="#top" className="wordmark">Project Lens</a><a href={github} target="_blank" rel="noreferrer">GitHub ↗</a></header>
      <div className="hero-copy" id="top">
        <p className="eyebrow">Project Lens</p><h1 id="hero-title">See the system<br />beneath the files.</h1>
        <p>Project Lens turns unfamiliar codebases into clear, evidence-backed guides.</p>
        <div className="hero-actions"><button onClick={() => jump('demo')}>Watch the demo</button><button className="quiet" onClick={() => jump('transform')}>See how it works</button></div>
        <button className="scroll-cue" onClick={() => jump('story')}>Scroll to continue <span>↓</span></button>
      </div>
    </section>
    <div className="story" id="story">
      <section className="problem reveal"><p className="eyebrow">The problem</p><h2>Opening a repository is easy. <em>Understanding it is not.</em></h2><p className="body-copy">A folder tree shows where files live. It does not explain where execution begins, how responsibilities connect, or what a developer should inspect first.</p></section>
      <section className="transform reveal" id="transform" aria-labelledby="transform-title"><div className="section-intro"><p className="eyebrow">How Project Lens turns files into understanding</p><h2 id="transform-title">A repository is more than a list of paths.</h2></div><div className="transform-toggle" role="group" aria-label="Repository transformation preview"><button className={transformView === 'files' ? 'selected' : ''} aria-pressed={transformView === 'files'} onClick={() => setTransformView('files')}>Files</button><button className={transformView === 'understanding' ? 'selected' : ''} aria-pressed={transformView === 'understanding'} onClick={() => setTransformView('understanding')}>Understanding</button></div><div className="transform-panel">{transformView === 'files' ? <div className="repository-tree" aria-label="Conceptual raw repository"><p>RAW REPOSITORY</p>{repositoryFiles.map((file) => <code key={file}>{file}</code>)}</div> : <div className="understanding-grid" aria-label="Conceptual Project Lens output">{['Purpose', 'Flow', 'Areas', 'Reading path', 'Evidence'].map((item) => <div key={item}><span>{item}</span><p>{item === 'Purpose' ? 'What the project does.' : item === 'Flow' ? 'How information moves.' : item === 'Areas' ? 'Where responsibility lives.' : item === 'Reading path' ? 'What to inspect first.' : 'Which files support each explanation.'}</p></div>)}</div>}</div></section>
      <section className="flow-section reveal" aria-labelledby="flow-title"><p className="eyebrow">The Project Lens process</p><h2 id="flow-title">A deliberate path from files to a guide.</h2><ol className="flow">{process.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, '0')}</span><p>{step}</p></li>)}</ol></section>
      <ReportDemo />
      <DemoVideo />
      <section className="artifact-section reveal"><p className="eyebrow">Artifact-first</p><h2>A guide you can return to.</h2><p className="body-copy">Project Lens creates persistent artifacts with evidence and known uncertainty, rather than leaving project knowledge in a temporary conversation.</p></section>
      <section className="codex-section reveal"><p className="eyebrow">Built with Codex</p><h2>Human direction. Agentic execution.</h2><p>Codex supported planning, implementation, testing, and self-review throughout Project Lens.</p><a href={github} target="_blank" rel="noreferrer">View on GitHub ↗</a></section>
      <section className="trust-section reveal"><p className="eyebrow">Local-first privacy and limits</p><h2>Built to inspect without taking over.</h2><div><p>Projects are staged locally for analysis. Project Lens is designed to preserve originals and distinguish confirmed evidence from uncertainty.</p><p>Static analysis is bounded, and generated explanations still deserve developer review.</p></div></section>
    </div>
    <footer className="final-cta"><p className="eyebrow">Project Lens</p><h2>Understand the project<br />before changing it.</h2><div className="hero-actions"><button onClick={() => jump('demo')}>Watch the demo</button><button className="quiet" onClick={() => jump('transform')}>See how it works</button></div><a href={github} target="_blank" rel="noreferrer">View on GitHub ↗</a></footer>
  </main>
}

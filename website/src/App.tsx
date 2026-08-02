import { useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { DepthCanvas } from './components/DepthCanvas'
import { ReportDemo } from './components/ReportDemo'
import { DemoVideo } from './components/DemoVideo'

gsap.registerPlugin(useGSAP, ScrollTrigger)

const github = 'https://github.com/catDkiller/project-lens'
const steps = [
  ['Local project', 'Select the codebase you want to understand.'],
  ['Isolated snapshot', 'Project Lens stages a bounded working copy without modifying the original.'],
  ['Codex analysis', 'Codex inspects project structure and relevant evidence.'],
  ['Persistent artifacts', 'An Overview and Complete Guide are written as Markdown.'],
  ['Structured understanding', 'Validated evidence becomes a guided report.']
]
const fragments = ['src/App.tsx', 'routes', 'package.json', 'imports', 'align_faces.py', 'entrypoint', 'components/']

export function App() {
  const root = useRef<HTMLElement>(null); const [exampleView, setExampleView] = useState<'raw' | 'lens'>('raw')
  useGSAP(() => {
    const media = gsap.matchMedia()
    media.add({ desktop: '(min-width: 850px)', motion: '(prefers-reduced-motion: no-preference)' }, (context) => {
      const { desktop, motion } = context.conditions as { desktop: boolean; motion: boolean }
      if (!motion) return
      gsap.from('.hero-copy > *', { y: 22, autoAlpha: 0, duration: .8, stagger: .1, ease: 'power3.out' })
      if (desktop) gsap.timeline({ scrollTrigger: { trigger: '.hero-stage', start: 'top top', end: '+=1050', scrub: .7, pin: true } })
        .to('.hero-video', { filter: 'brightness(.24) saturate(.45) blur(2px)', scale: 1.08 }, 0)
        .to('.hero-copy', { yPercent: -25, autoAlpha: .15 }, 0)
        .to('.underwater-intro', { autoAlpha: 1, y: 0 }, .36)
        .to('.depth-layer', { autoAlpha: 1 }, .45)
      gsap.utils.toArray<HTMLElement>('.reveal').forEach((element) => gsap.from(element, { y: 28, autoAlpha: 0, duration: .7, ease: 'power2.out', scrollTrigger: { trigger: element, start: 'top 82%', once: true } }))
    })
    return () => media.revert()
  }, { scope: root })
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  return <main ref={root}>
    <a className="skip-link" href="#story">Skip cinematic introduction</a>
    <section className="hero-stage" aria-labelledby="hero-title">
      <video className="hero-video" autoPlay muted loop playsInline preload="metadata" poster="/media/project-lens-poster.svg" aria-hidden="true"><source src="/media/project-lens-sea.mp4" type="video/mp4" /></video>
      <div className="hero-shade" /><div className="caustic" aria-hidden="true" />
      <div className="depth-layer" aria-hidden="true"><DepthCanvas /></div>
      <div className="underwater-intro" aria-hidden="true">Files become relationships.</div>
      <header className="site-header"><a href="#top" className="wordmark">Project Lens</a><a href={github} target="_blank" rel="noreferrer">GitHub ↗</a></header>
      <div className="hero-copy" id="top"><p className="eyebrow">Built for the ChatGPT Codex India Hackathon 2026</p><h1 id="hero-title">See the system<br />beneath the files.</h1><p>Project Lens turns unfamiliar codebases into clear, evidence-backed guides.</p><div className="hero-actions"><button onClick={() => jump('demo')}>Watch the demo</button><button className="quiet" onClick={() => jump('report')}>Explore a real report</button></div><button className="scroll-cue" onClick={() => jump('story')}>Follow the flow <span>↓</span></button></div>
    </section>
    <div className="story" id="story">
      <section className="problem reveal"><p className="eyebrow">The problem</p><h2>Opening a repository is easy.<br /><em>Understanding how it works is not.</em></h2><div className="fragment-field" aria-label="Examples of disconnected project elements">{fragments.map((fragment) => <span key={fragment}>{fragment}</span>)}</div><p className="body-copy">Folder trees show where files are stored. They rarely explain how the project fits together, where execution begins, or what a new developer should inspect first.</p></section>
      <section className="flow-section reveal" aria-labelledby="flow-title"><p className="eyebrow">The mental model</p><h2 id="flow-title">Follow the current from code to clarity.</h2><ol className="flow">{steps.map(([title, detail], index) => <li key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{title}</h3><p>{detail}</p></div></li>)}</ol></section>
      <section className="example reveal" aria-labelledby="example-title"><div><p className="eyebrow">A real project example</p><h2 id="example-title">Face Averaging</h2><p>A small computer-vision pipeline that turns input photographs into a composite face.</p><div className="toggle" role="group" aria-label="Example view"><button className={exampleView === 'raw' ? 'selected' : ''} onClick={() => setExampleView('raw')}>Raw files</button><button className={exampleView === 'lens' ? 'selected' : ''} onClick={() => setExampleView('lens')}>Project Lens view</button></div></div><div className="example-flow">{exampleView === 'raw' ? <><code>images/</code><i>?</i><code>align_faces.py</code><i>?</i><code>average_faces.py</code></> : <><span>Input photographs</span><i>→</i><span>Eye-based alignment</span><i>→</i><span>Normalized faces</span><i>→</i><span>Composite face</span></>}</div><p className="example-proof">Evidence: Face Averaging/face_landmark_extractor.py · Face Averaging/align_faces.py · Face Averaging/average_faces.py</p></section>
      <ReportDemo />
      <DemoVideo />
      <section className="artifact-section reveal"><p className="eyebrow">Why artifact-first</p><h2>Not another temporary AI conversation.</h2><div className="comparison"><div><span>Temporary response</span><p>Hard to revisit, hard to verify, easy to lose.</p></div><div><span>Persistent project understanding</span><p>Markdown artifacts, evidence-backed references, clear uncertainty, and two reading depths.</p></div></div></section>
      <section className="codex-section reveal"><p className="eyebrow">Built with Codex</p><h2>Human direction. Agentic execution.</h2><p>Codex supported architecture planning, CLI integration, event streaming, artifact validation, recovery flows, accessibility iteration, testing, and release auditing.</p><p className="workflow">Plan <b>→</b> Implement <b>→</b> Run <b>→</b> Inspect <b>→</b> Fix <b>→</b> Validate</p><a href={github} target="_blank" rel="noreferrer">View the public repository ↗</a></section>
      <section className="trust-section reveal"><div><p className="eyebrow">Local-first by design</p><h2>Built to inspect without taking over.</h2><p>Project files are staged locally and analysed through the user’s authenticated Codex CLI session.</p></div><ul><li>Original project files are not modified.</li><li>Generated references are validated before presentation.</li><li>Runtime folders remain local and excluded from Git.</li></ul></section>
      <section className="status-section reveal"><p className="eyebrow">Current status</p><h2>Made for a local workflow.</h2><div className="status-columns"><div><h3>Working now</h3><p>Folder selection, Codex model discovery, isolated snapshots, validated Overview and Complete Guide artifacts, preserved-run reopening, and local rechecking.</p></div><div><h3>Limits to keep in mind</h3><p>New analysis runs locally, inspection is bounded, static-analysis depth varies by language, and inferred setup details may need verification.</p></div></div></section>
    </div>
    <footer className="final-cta"><p className="eyebrow">Project Lens</p><h2>Understand the project<br />before changing it.</h2><div className="hero-actions"><button onClick={() => jump('demo')}>Watch the demo</button><button className="quiet" onClick={() => jump('report')}>Explore a real report</button></div><a href={github} target="_blank" rel="noreferrer">View Project Lens on GitHub ↗</a><small>Run Project Lens locally with your authenticated Codex CLI session.</small></footer>
  </main>
}

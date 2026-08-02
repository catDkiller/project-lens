import { useEffect, useState } from 'react'

const source = import.meta.env.VITE_DEMO_VIDEO_URL || '/media/project-lens-demo.mp4'

export function DemoVideo() {
  const [open, setOpen] = useState(false); const [missing, setMissing] = useState(false)
  const close = () => setOpen(false)
  useEffect(() => { if (!open) return; const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }; addEventListener('keydown', escape); return () => removeEventListener('keydown', escape) }, [open])
  return <section className="demo-video" id="demo" aria-labelledby="demo-title"><div className="section-intro"><p className="eyebrow">Product walkthrough</p><h2 id="demo-title">See the workflow in motion.</h2></div><button className="video-poster" disabled={missing} onClick={() => !missing && setOpen(true)} aria-label={missing ? 'Demo video will be added here' : 'Play Project Lens product walkthrough'}><span>Project Lens product walkthrough</span><strong>{missing ? 'Demo video will be added here' : 'Watch the demo'}</strong></button><video className="video-probe" src={source} preload="metadata" onError={() => setMissing(true)} onLoadedMetadata={() => setMissing(false)} aria-hidden="true" />{open && <div className="video-modal" role="dialog" aria-modal="true" aria-label="Project Lens product walkthrough"><button className="modal-close" onClick={close}>Close video</button><video src={source} controls autoPlay playsInline onEnded={close}><track kind="captions" /></video></div>}</section>
}

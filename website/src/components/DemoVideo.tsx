const source = import.meta.env.VITE_DEMO_VIDEO_URL || '/media/project-lens-demo.mp4'

export function DemoVideo() {
  return <section className="demo-video reveal" id="demo" aria-labelledby="demo-title">
    <div className="section-intro">
      <p className="eyebrow">Product walkthrough</p>
      <h2 id="demo-title">Project Lens walkthrough</h2>
      <p>The full product demo will appear here.</p>
    </div>
    <div className="video-placeholder" role="note">
      <span>Demo video</span>
      <p>Available soon</p>
    </div>
    <video className="video-probe" src={source} preload="metadata" aria-hidden="true" />
  </section>
}

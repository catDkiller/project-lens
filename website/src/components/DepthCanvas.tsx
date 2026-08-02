import { useEffect, useRef, useState } from 'react'

const labels = [
  { name: 'src/App.tsx', x: '11%', y: '23%' },
  { name: 'align_faces.py', x: '38%', y: '57%' },
  { name: 'imports', x: '68%', y: '20%' },
  { name: 'routes', x: '73%', y: '69%' },
  { name: 'average_faces.py', x: '16%', y: '72%' },
  { name: 'evidence', x: '51%', y: '17%' },
  { name: 'LoginForm.tsx', x: '42%', y: '78%' },
]

const vertexSource = `attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`

const fragmentSource = `precision mediump float;
uniform vec2 resolution;
uniform vec2 pointer;
uniform float time;

float line(vec2 point, vec2 start, vec2 end) {
  vec2 segment = end - start;
  float distanceAlong = clamp(dot(point - start, segment) / dot(segment, segment), 0.0, 1.0);
  return 1.0 - smoothstep(0.001, 0.005, length(point - (start + segment * distanceAlong)));
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  vec2 lens = pointer * 2.0 - 1.0;
  lens.x *= resolution.x / resolution.y;
  float influence = 1.0 - smoothstep(0.06, 0.33, length(p - lens));
  float current = time * 0.00018;
  vec2 a = vec2(-0.71 + sin(current) * 0.025, -0.43);
  vec2 b = vec2(-0.12, 0.15 + cos(current * 1.3) * 0.03);
  vec2 c = vec2(0.55, 0.47);
  vec2 d = vec2(0.72, -0.34);
  float network = line(p, a, b) + line(p, b, c) + line(p, b, d) + line(p, a, d) * 0.52;
  float nodes = 0.0;
  nodes += 1.0 - smoothstep(0.009, 0.028, length(p - a));
  nodes += 1.0 - smoothstep(0.009, 0.028, length(p - b));
  nodes += 1.0 - smoothstep(0.009, 0.028, length(p - c));
  nodes += 1.0 - smoothstep(0.009, 0.028, length(p - d));
  float ripple = sin((p.x + p.y) * 16.0 + current * 9.0) * 0.035 + 0.035;
  vec3 base = vec3(0.015, 0.065, 0.085);
  vec3 connection = vec3(0.19, 0.78, 0.72) * (network * (0.24 + influence * 0.76));
  vec3 points = vec3(0.73, 1.0, 0.93) * nodes * (0.4 + influence * 0.6);
  gl_FragColor = vec4(base + connection + points + ripple * influence, 0.94);
}`

function makeShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
}

export function DepthCanvas() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [available, setAvailable] = useState(true)

  useEffect(() => {
    const element = canvas.current
    if (!element || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const gl = element.getContext('webgl', { alpha: true, antialias: false })
    if (!gl) { setAvailable(false); return }
    const vertex = makeShader(gl, gl.VERTEX_SHADER, vertexSource)
    const fragment = makeShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
    if (!vertex || !fragment) { setAvailable(false); return }
    const program = gl.createProgram()
    if (!program) { setAvailable(false); return }
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { setAvailable(false); return }
    const buffer = gl.createBuffer()
    if (!buffer) { setAvailable(false); return }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
    gl.useProgram(program)
    const position = gl.getAttribLocation(program, 'position')
    const resolution = gl.getUniformLocation(program, 'resolution')
    const pointerLocation = gl.getUniformLocation(program, 'pointer')
    const time = gl.getUniformLocation(program, 'time')
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    let pointerX = -2; let pointerY = -2; let frame = 0
    const resize = () => { const box = element.getBoundingClientRect(); const ratio = Math.min(devicePixelRatio, 1.5); element.width = Math.max(1, Math.round(box.width * ratio)); element.height = Math.max(1, Math.round(box.height * ratio)); gl.viewport(0, 0, element.width, element.height) }
    const draw = (now: number) => { if (!document.hidden) { gl.uniform2f(resolution, element.width, element.height); gl.uniform2f(pointerLocation, pointerX, pointerY); gl.uniform1f(time, now); gl.drawArrays(gl.TRIANGLES, 0, 6) }; frame = requestAnimationFrame(draw) }
    const move = (event: PointerEvent) => { const box = element.getBoundingClientRect(); pointerX = (event.clientX - box.left) / box.width; pointerY = 1 - (event.clientY - box.top) / box.height }
    resize(); const observer = new ResizeObserver(resize); observer.observe(element); element.addEventListener('pointermove', move); frame = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(frame); observer.disconnect(); element.removeEventListener('pointermove', move); gl.deleteBuffer(buffer); gl.deleteProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment) }
  }, [])

  return <div className={`depth-field${available ? '' : ' depth-field--fallback'}`} aria-hidden="true"><canvas ref={canvas} className="depth-canvas" /><div className="depth-labels">{labels.map((label) => <span key={label.name} style={{ left: label.x, top: label.y }}>{label.name}</span>)}</div></div>
}

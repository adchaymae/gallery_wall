import { useEffect, useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'

type ImageItem = { id: string; name: string; url: string; width: number; height: number }
type Frame = { id: string; x: number; y: number; width: number; height: number; imageId?: string; zoom: number; offsetX: number; offsetY: number }
type Project = { wallWidth: number; wallHeight: number; dpi: number; frames: Frame[]; images: ImageItem[] }

const initial: Project = { wallWidth: 300, wallHeight: 250, dpi: 300, frames: [], images: [] }
const cmToPx = (cm: number, dpi: number) => Math.round(cm / 2.54 * dpi)
const quality = (image: ImageItem, frame: Frame, dpi: number) => {
  const required = Math.max(cmToPx(frame.width, dpi), cmToPx(frame.height, dpi))
  const available = Math.max(image.width, image.height)
  const ratio = available / required
  return ratio >= 1.2 ? 'Excellent' : ratio >= .85 ? 'Good' : ratio >= .55 ? 'Medium' : 'Low'
}

async function generatePrintImage(image: ImageItem, frame: Frame, dpi: number): Promise<Blob> {
  const targetW = cmToPx(frame.width, dpi), targetH = cmToPx(frame.height, dpi)
  const source = await loadImage(image.url)
  const canvas = document.createElement('canvas'); canvas.width = targetW; canvas.height = targetH
  const ctx = canvas.getContext('2d')!
  const targetRatio = targetW / targetH, sourceRatio = source.width / source.height
  let cropW = source.width, cropH = source.height
  if (sourceRatio > targetRatio) cropW = source.height * targetRatio; else cropH = source.width / targetRatio
  const scale = frame.zoom
  cropW /= scale; cropH /= scale
  const maxX = source.width - cropW, maxY = source.height - cropH
  const sx = Math.max(0, Math.min(maxX, maxX / 2 + frame.offsetX * maxX / 2))
  const sy = Math.max(0, Math.min(maxY, maxY / 2 + frame.offsetY * maxY / 2))
  ctx.imageSmoothingQuality = 'high'; ctx.drawImage(source, sx, sy, cropW, cropH, 0, 0, targetW, targetH)
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to encode image')), 'image/jpeg', .94))
}
const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src })
const download = (blob: Blob, name: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000) }

export default function App() {
  const [project, setProject] = useState<Project>(() => { try { return JSON.parse(localStorage.getItem('framefolk-project') || '') || initial } catch { return initial } })
  const [selected, setSelected] = useState<string>()
  const [view, setView] = useState<'home' | 'editor'>('home')
  const [notice, setNotice] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const selectedFrame = project.frames.find(f => f.id === selected)
  const selectedImage = selectedFrame?.imageId ? project.images.find(i => i.id === selectedFrame.imageId) : undefined
  const scale = Math.min(720 / project.wallWidth, 560 / project.wallHeight)
  useEffect(() => localStorage.setItem('framefolk-project', JSON.stringify(project)), [project])
  const update = (patch: Partial<Project>) => setProject(p => ({ ...p, ...patch }))
  const updateFrame = (patch: Partial<Frame>) => selected && setProject(p => ({ ...p, frames: p.frames.map(f => f.id === selected ? { ...f, ...patch } : f) }))
  const addFrame = () => { const frame: Frame = { id: crypto.randomUUID(), x: 20 + project.frames.length * 8, y: 20 + project.frames.length * 8, width: 40, height: 60, zoom: 1, offsetX: 0, offsetY: 0 }; setProject(p => ({ ...p, frames: [...p.frames, frame] })); setSelected(frame.id) }
  const importImages = async (files: FileList | null) => { if (!files) return; const additions: ImageItem[] = []; for (const file of Array.from(files)) { if (!file.type.startsWith('image/')) continue; const url = URL.createObjectURL(file); const img = await loadImage(url); additions.push({ id: crypto.randomUUID(), name: file.name, url, width: img.naturalWidth, height: img.naturalHeight }) } update({ images: [...project.images, ...additions] }); setNotice(`${additions.length} image(s) added`) }
  const assign = (imageId: string) => selected && updateFrame({ imageId })
  const exportOne = async (frame: Frame) => { const image = project.images.find(i => i.id === frame.imageId); if (!image) return; const blob = await generatePrintImage(image, frame, project.dpi); download(blob, `frame-${frame.width}x${frame.height}cm-${project.dpi}dpi.jpg`) }
  const exportAll = async () => { const zip = new JSZip(); let count = 0; for (const frame of project.frames) { if (!frame.imageId) continue; const image = project.images.find(i => i.id === frame.imageId); if (!image) continue; zip.file(`frame-${frame.width}x${frame.height}cm-${project.dpi}dpi.jpg`, await generatePrintImage(image, frame, project.dpi)); count++ } if (!count) { setNotice('Assign an image to at least one frame first'); return } download(await zip.generateAsync({ type: 'blob' }), 'gallery-wall-prints.zip') }

  if (view === 'home') return <main className="landing"><nav><strong>FRAMEFOLK</strong><span>Gallery wall studio</span><button onClick={() => setView('editor')}>Open studio →</button></nav><section className="hero"><div><p className="eyebrow">DESIGN · PREPARE · PRINT</p><h1>Your wall,<br /><em>beautifully composed.</em></h1><p className="lead">Arrange your frames in real-world dimensions, then download every photograph perfectly cropped and sized for print.</p><button className="primary" onClick={() => setView('editor')}>Create your gallery wall <span>↗</span></button></div><div className="hero-art"><div className="art-frame art-a"/><div className="art-frame art-b"/><div className="art-frame art-c"/><div className="art-frame art-d"/></div></section><section className="steps">{[['01','Design','Set the exact dimensions of your wall.'],['02','Compose','Place and tune every frame visually.'],['03','Print','Export high-resolution files, ready to hang.']].map(x => <article key={x[0]}><small>{x[0]}</small><h3>{x[1]}</h3><p>{x[2]}</p></article>)}</section></main>

  return <main className="app"><header className="topbar"><button className="wordmark" onClick={() => setView('home')}>FRAMEFOLK</button><div className="project-name"><span>UNTITLED WALL</span><small>Saved locally</small></div><div className="top-actions"><button onClick={() => { localStorage.removeItem('framefolk-project'); setProject(initial); setSelected(undefined) }}>New</button><button onClick={() => { const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }); download(blob, 'gallery-wall-project.json') }}>Export JSON</button><button className="primary small" onClick={exportAll}>Download all</button></div></header><div className="workspace"><aside className="sidebar left"><div className="panel-title">PROJECT</div><label>Wall width <input type="number" value={project.wallWidth} onChange={e => update({ wallWidth: Math.max(20, +e.target.value) })} /> <b>cm</b></label><label>Wall height <input type="number" value={project.wallHeight} onChange={e => update({ wallHeight: Math.max(20, +e.target.value) })} /> <b>cm</b></label><label>Print DPI <select value={project.dpi} onChange={e => update({ dpi: +e.target.value })}><option>150</option><option>200</option><option>300</option></select></label><hr /><div className="panel-title">IMAGES</div><button className="dropzone" onClick={() => fileRef.current?.click()}>＋ Add images<span>JPG, PNG, WEBP</span></button><input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => importImages(e.target.files)} />{project.images.map(image => <button className={'thumb ' + (selectedImage?.id === image.id ? 'active' : '')} key={image.id} onClick={() => assign(image.id)}><img src={image.url} /><span>{image.name}</span></button>)}</aside><section className="canvas-area"><div className="canvas-toolbar"><span>{project.wallWidth} × {project.wallHeight} cm</span><button onClick={addFrame}>＋ Add frame</button></div><div className="wall" style={{ width: project.wallWidth * scale, height: project.wallHeight * scale }}>{project.frames.map(frame => <button key={frame.id} className={'frame ' + (selected === frame.id ? 'selected' : '')} onClick={() => setSelected(frame.id)} style={{ left: frame.x * scale, top: frame.y * scale, width: frame.width * scale, height: frame.height * scale }}>{frame.imageId ? <img src={project.images.find(i => i.id === frame.imageId)?.url} /> : <span>＋<small>place image</small></span>}<i>{Math.round(frame.width)} × {Math.round(frame.height)}</i></button>)}</div>{notice && <div className="notice" onClick={() => setNotice('')}>{notice}</div>}</section><aside className="sidebar right"><div className="panel-title">{selectedFrame ? 'SELECTED FRAME' : 'FRAME PROPERTIES'}</div>{selectedFrame ? <><div className="field-grid"><label>Width<input type="number" value={selectedFrame.width} onChange={e => updateFrame({ width: Math.max(1, +e.target.value) })} /></label><label>Height<input type="number" value={selectedFrame.height} onChange={e => updateFrame({ height: Math.max(1, +e.target.value) })} /></label><label>X position<input type="number" value={selectedFrame.x} onChange={e => updateFrame({ x: Math.max(0, +e.target.value) })} /></label><label>Y position<input type="number" value={selectedFrame.y} onChange={e => updateFrame({ y: Math.max(0, +e.target.value) })} /></label></div><div className="inspector"><b>IMAGE</b><p>{selectedImage ? `${selectedImage.width} × ${selectedImage.height} px` : 'No image assigned'}</p><label>Zoom<input type="range" min="1" max="3" step=".01" value={selectedFrame.zoom} onChange={e => updateFrame({ zoom: +e.target.value })} /></label><label>Horizontal crop<input type="range" min="-1" max="1" step=".01" value={selectedFrame.offsetX} onChange={e => updateFrame({ offsetX: +e.target.value })} /></label><label>Vertical crop<input type="range" min="-1" max="1" step=".01" value={selectedFrame.offsetY} onChange={e => updateFrame({ offsetY: +e.target.value })} /></label></div>{selectedImage && <div className="print-card"><b>PRINT SIZE</b><strong>{cmToPx(selectedFrame.width, project.dpi)} × {cmToPx(selectedFrame.height, project.dpi)} px</strong><span>@ {project.dpi} DPI · {quality(selectedImage, selectedFrame, project.dpi)}</span>{quality(selectedImage, selectedFrame, project.dpi) === 'Low' && <p>⚠ This image may not have enough resolution for a high-quality print.</p>}<button className="primary full" onClick={() => exportOne(selectedFrame)}>Download image</button></div>}<div className="row-buttons"><button onClick={() => { const copy = { ...selectedFrame, id: crypto.randomUUID(), x: selectedFrame.x + 10, y: selectedFrame.y + 10 }; setProject(p => ({ ...p, frames: [...p.frames, copy] })); setSelected(copy.id) }}>Duplicate</button><button onClick={() => { setProject(p => ({ ...p, frames: p.frames.filter(f => f.id !== selected) })); setSelected(undefined) }}>Delete</button></div></> : <div className="empty">Select a frame to edit its exact size, position and crop.</div>}</aside></div></main>
}

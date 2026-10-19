import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowRight, Battery, Check, Cpu, Download, HardDrive, Loader2, Pause, ShieldCheck, Smartphone, Trash2, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import type { PluginListenerHandle } from '@capacitor/core'
import { Button, Modal } from '../components/ui'
import { useApp } from '../context/AppContext'
import { OfflineAI, supportsNativeOffline } from '../lib/offline'
import type { OfflineProgress, OfflineStatus } from '../lib/offline'
import { errorMessage } from '../lib/utils'

const size = (bytes: number) => `${(bytes / 1_000_000).toFixed(0)} MB`
export function OfflinePage() {
  const { offlineAI, setOfflineAI, profile } = useApp()
  const navigate = useNavigate()
  const native = supportsNativeOffline()
  const [status, setStatus] = useState<OfflineStatus>()
  const [progress, setProgress] = useState<OfflineProgress>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  useEffect(() => {
    if (!native) return
    let active = true
    let listener: PluginListenerHandle | undefined
    void OfflineAI.getStatus().then(value => { if (active) setStatus(value) }).catch(value => { if (active) setError(errorMessage(value)) })
    void OfflineAI.addListener('progress', value => { if (active) setProgress(value) }).then(value => { if (active) listener = value; else void value.remove() }).catch(() => {})
    return () => { active = false; void listener?.remove() }
  }, [native])
  // A native operation can outlive this React page. Refresh until it is idle
  // when returning to setup, rather than leaving stale Downloading/Busy flags.
  useEffect(() => {
    if (!native || busy || !status?.busy) return
    let active = true
    const timer = window.setInterval(() => { void OfflineAI.getStatus().then(value => { if (active) setStatus(value) }).catch(() => {}) }, 1000)
    return () => { active = false; window.clearInterval(timer) }
  }, [native, busy, status?.busy])
  const download = async () => {
    setBusy(true); setError(''); setProgress({ stage: 'downloading', bytes: status?.bytesDownloaded || 0 })
    try {
      const next = await OfflineAI.download()
      setStatus({ ...next, downloading: false, busy: false }); setProgress({ stage: 'ready', bytes: next.modelBytes })
      toast.success('Model verified. Your offline world is ready.')
    } catch (value) {
      setError(errorMessage(value)); setProgress(undefined)
      try { setStatus(await OfflineAI.getStatus()) } catch { /* Keep the actionable download error. */ }
    } finally { setBusy(false) }
  }
  const activate = async () => {
    setBusy(true); setError(''); setProgress({ stage: 'loading', bytes: status?.modelBytes || 0 })
    try {
      await OfflineAI.loadModel()
      setOfflineAI(true)
      if (profile?.id === 'demo' && profile.adult_confirmed) void navigate({ to: '/' })
      else void navigate({ to: '/onboarding', search: { demo: true } })
      toast.success('Offline AI is on. Replies are generated on this phone.')
    } catch (value) { setError(errorMessage(value)) } finally { setBusy(false); setProgress(undefined) }
  }
  const remove = async () => {
    setBusy(true); setError('')
    try { setStatus(await OfflineAI.deleteModel()); setProgress(undefined); setOfflineAI(false); setDeleteOpen(false); toast.success('Model removed. Your local stories are still saved.') }
    catch (value) { setError(errorMessage(value)) } finally { setBusy(false) }
  }
  const total = status?.modelBytes || 0
  const downloaded = progress?.bytes ?? status?.bytesDownloaded ?? 0
  const downloading = busy && progress?.stage === 'downloading' || status?.downloading
  const percent = total ? Math.min(100, Math.round(downloaded / total * 100)) : 0
  const stage = progress?.stage === 'verifying' ? 'Verifying the download…' : progress?.stage === 'loading' ? 'Loading your local model…' : 'Downloading your local model…'
  return <div className="offline-page page-enter">
    <section className="offline-hero"><div className="offline-orbit"><Cpu size={36}/><span><WifiOff size={16}/></span></div><span className="eyebrow">YOUR WORLD. ON YOUR PHONE.</span><h2>A little magic.<br/><span>No connection needed.</span></h2><p>Real AI replies, generated right on your Android phone. Download a small model once, then take your stories offline.</p><div className="offline-chips"><span><ShieldCheck size={13}/> No API key</span><span><WifiOff size={13}/> No API usage fees</span><span><HardDrive size={13}/> Device-only chats</span></div></section>
    <div className="offline-grid"><section className="offline-model-card">
      <div className="offline-card-heading"><span className="offline-card-icon"><Cpu size={23}/></span><div><span className="eyebrow">LIGHTWEIGHT LOCAL MODEL</span><h3>DreamSoul Light <small>0.5B</small></h3><p>Qwen2.5-0.5B Instruct · Q4_K_M</p></div>{status?.downloaded && <span className="offline-installed"><Check size={13}/> Installed</span>}</div>
      <div className="offline-specs"><div><Smartphone size={17}/><strong>4–6 GB RAM</strong><span>64-bit Android</span></div><div><Download size={17}/><strong>{total ? size(total) : '~491 MB'}</strong><span>one-time download</span></div><div><HardDrive size={17}/><strong>~1 GB free</strong><span>recommended storage</span></div></div>
      {native ? <>
        {status && <p className="offline-device">Your device: {status.ramGB.toFixed(1)} GB RAM · {status.freeGB.toFixed(1)} GB free{status.ramGB < 3.5 && <span> · Low memory: close other apps before using AI.</span>}</p>}
        {(busy || status?.downloading) && <div className="offline-progress" role="status"><div><span><Loader2 size={14} className="spin"/> {stage}</span><strong>{progress?.stage === 'downloading' ? `${percent}%` : ''}</strong></div><progress value={downloaded} max={total || 1} aria-label="Model download progress"/><p>{size(downloaded)}{total ? ` / ${size(total)}` : ''} · Keep DreamSoul open</p></div>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="offline-actions">{status?.downloaded ? <Button onClick={() => void activate()} loading={busy} disabled={!status.supported}>{offlineAI ? 'Continue offline' : 'Use Offline AI'}<ArrowRight size={16}/></Button> : downloading ? <Button variant="secondary" onClick={() => void OfflineAI.pauseDownload().then(() => toast.info('Pausing download. You can resume it later.')).catch(value => setError(errorMessage(value)))}><Pause size={16}/> Pause download</Button> : <Button loading={busy || !status} disabled={!status?.supported} onClick={() => void download()}><Download size={17}/>{downloaded ? 'Resume model download' : 'Download free model'}</Button>}
          {status?.downloaded && <button className="icon-button" aria-label="Remove local model" onClick={() => setDeleteOpen(true)} disabled={busy}><Trash2 size={17}/></button>}</div>
        {status && !status.supported && <p className="form-error">This build needs a 64-bit Android device (arm64 or x86_64). The engine is unavailable on this device.</p>}
        {!status?.downloaded && <p className="offline-fineprint">Use Wi-Fi for the initial download. Interrupted downloads can resume. The file is verified with SHA-256 before use. Normal mobile data charges may apply.</p>}
      </> : <div className="offline-web-notice"><Smartphone size={23}/><h4>Built for the Android app</h4><p>Your browser can explore DreamSoul, but this local engine needs the updated 64-bit Android APK.</p><a className="button button-primary" href="https://github.com/s1po0/Dream-soul-/releases" target="_blank" rel="noreferrer">Get the Android APK <Download size={16}/></a></div>}
      {offlineAI && <div className="offline-active"><WifiOff size={16}/><div><strong>Offline AI is on</strong><p>Cloud auth, character discovery, and chat requests are paused. Existing cloud data is unchanged.</p><button className="text-link" disabled={busy} onClick={() => { setOfflineAI(false); toast.info('Online mode restored. Cloud AI needs a configured provider with available credit.') }}>Return to online / demo mode</button></div></div>}
    </section><aside className="offline-explainer"><h3>Small model. Honest expectations.</h3><div><Cpu size={19}/><p><strong>Real replies, not the demo.</strong>The local model uses your character’s personality and recent messages. It’s less capable than cloud AI and can repeat itself or make mistakes.</p></div><div><Battery size={19}/><p><strong>A little patience helps.</strong>Speed varies by phone. Replies are capped at 256 tokens with a 2,048-token context. Generation uses battery and can warm your phone.</p></div><div><ShieldCheck size={19}/><p><strong>Your stories stay here.</strong>Offline chats, profiles, and characters are local only, not backed up. Uninstalling or clearing app data removes them. The model download contacts Hugging Face; conversations don’t.</p></div><div><WifiOff size={19}/><p><strong>Choose your mode.</strong>Offline AI, cloud AI, and the scripted local demo are distinct. Local failures show an error—never a pretend AI response. Content filters are best-effort on a small model; adults 18+ only.</p></div></aside></div>
    <p className="offline-attribution">Powered by <a href="https://github.com/ggml-org/llama.cpp" target="_blank" rel="noreferrer">llama.cpp</a> (MIT) and <a href="https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF" target="_blank" rel="noreferrer">Qwen2.5</a> (Apache 2.0). <a href="/licenses/llama-cpp.txt" target="_blank" rel="noreferrer">Engine license</a> · <a href="/licenses/Apache-2.0.txt" target="_blank" rel="noreferrer">Model license</a> · <Link to="/privacy">Privacy details</Link></p>
    <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Remove the local model?"><p className="muted">This frees the model’s storage and switches out of Offline AI. Local chats and characters stay on this device. You’ll need to download the model again to generate offline replies.</p><div className="modal-actions"><Button variant="secondary" onClick={() => setDeleteOpen(false)}>Keep model</Button><Button variant="danger" loading={busy} onClick={() => void remove()}>Remove model <Trash2 size={15}/></Button></div></Modal>
  </div>
}

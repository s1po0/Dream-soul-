import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowRight, Cpu, Check, CheckCircle2, Eye, EyeOff, ImagePlus, Mail, ShieldCheck, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, Button, Logo } from '../components/ui'
import { useApp } from '../context/AppContext'
import { supabase, supabaseKey, supabaseUrl, uploadAvatar } from '../lib/supabase'
import { cn, errorMessage } from '../lib/utils'
import { authRedirect, isNativeApp, openNativeOAuth } from '../lib/native'

export function AuthPage() {
  const { user, profile, authLoading, offlineAI, setOfflineAI } = useApp()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (user && profile) void navigate({ to: profile.onboarding_completed ? '/' : '/onboarding' })
  }, [user, profile, navigate])
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setLoading(true)
    try {
      if (!supabase) throw new Error('Connect Supabase to sign in, or try the local demo below.')
      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: authRedirect('/reset-password') })
        if (error) throw error
        setSent(true)
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: authRedirect('/onboarding') } })
        if (error) throw error
        if (!data.session) setSent(true)
        else void navigate({ to: '/onboarding' })
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (error) { setError(errorMessage(error)) }
    finally { setLoading(false) }
  }
  const googleSignIn = async () => {
    if (!supabase) { toast.error('Connect Supabase to use Google sign-in. The local demo is ready to explore.'); return }
    setLoading(true)
    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabaseKey! }, signal: AbortSignal.timeout(6000) })
      if (!response.ok) throw new Error('We couldn’t reach sign-in. Try email or explore the local demo.')
      const settings = await response.json()
      if (!settings.external?.google) throw new Error('Google sign-in needs to be enabled in Supabase Auth. You can use email or explore the local demo.')
      const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: authRedirect('/onboarding'), skipBrowserRedirect: isNativeApp() } })
      if (error) throw error
      if (isNativeApp() && data.url) { await openNativeOAuth(data.url); setLoading(false) }
    } catch (error) { setError(errorMessage(error)); setLoading(false) }
  }
  if (offlineAI) return <div className="centered-page"><section className="onboarding-card"><Logo/><Cpu size={32}/><h2>Your world is offline.</h2><p>Offline AI doesn’t need a cloud account. Create a local profile, or explicitly switch back online to sign in.</p><Link to="/offline" className="button button-primary">Offline AI setup <ArrowRight size={16}/></Link><Link to="/onboarding" search={{ demo: true }} className="text-link">Create your local 18+ profile</Link><Button variant="secondary" onClick={() => setOfflineAI(false)}>Switch online to sign in</Button></section></div>
  return <div className="auth-page page-enter"><div className="auth-visual"><div className="auth-visual-shade"/><div><span className="eyebrow"><Sparkles size={14}/> A WORLD THAT GETS YOU</span><h2>Every great story<br/>starts with<br/><span>a connection.</span></h2><p>Find your people. Create your characters.<br/>Make a little room for the extraordinary.</p><div className="auth-character-quote"><Avatar name="Luna" src="/images/luna.webp"/><span>“There you are. I was hoping<br/>the moon would bring you here.”<small>— Luna Evermore</small></span></div></div></div><section className="auth-card"><Logo/><span className="eyebrow auth-eyebrow">YOUR NEXT CHAPTER</span><h2>{sent ? 'A little note in your inbox.' : mode === 'signup' ? 'Your world is waiting.' : mode === 'reset' ? 'Let’s get you back in.' : 'Good to see you, dreamer.'}</h2><p>{sent ? `We’ve sent a ${mode === 'reset' ? 'password reset' : 'confirmation'} link to ${email}. Check your inbox and spam folder.` : mode === 'signup' ? 'Create an account. Find a connection that’s yours.' : mode === 'reset' ? 'Enter your email and we’ll send you a reset link.' : 'Sign in and pick up where your imagination left off.'}</p>
      {sent ? <div className="email-sent"><Mail size={42}/><Button variant="secondary" onClick={() => { setSent(false); setMode('signin') }}>Back to sign in <ArrowRight size={16}/></Button></div> : <>
        {mode !== 'reset' && <><Button variant="secondary" className="google-button" onClick={() => void googleSignIn()} disabled={loading || authLoading}><GoogleIcon/>Continue with Google</Button><div className="auth-divider"><span/>or continue with email<span/></div></>}
        <form onSubmit={event => void submit(event)} className="auth-form"><label className="field-label" htmlFor="auth-email">Email address</label><div className="input-icon-wrap"><Mail size={17}/><input id="auth-email" type="email" autoComplete="email" placeholder="you@yourworld.com" required value={email} onChange={e => setEmail(e.target.value)} maxLength={254}/></div>
          {mode !== 'reset' && <><div className="label-row"><label className="field-label" htmlFor="auth-password">Password</label>{mode === 'signin' && <button type="button" className="text-link" onClick={() => { setMode('reset'); setError('') }}>Forgot password?</button>}</div><div className="input-icon-wrap password-wrap"><input id="auth-password" type={passwordVisible ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your secret, kept safe'} required minLength={mode === 'signup' ? 8 : 1} maxLength={128} value={password} onChange={e => setPassword(e.target.value)}/><button type="button" onClick={() => setPasswordVisible(!passwordVisible)} aria-label={passwordVisible ? 'Hide password' : 'Show password'}>{passwordVisible ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></>}
          {error && <p className="form-error" role="alert">{error}</p>}<Button className="w-full" type="submit" loading={loading} disabled={authLoading}>{mode === 'signup' ? 'Create my account' : mode === 'reset' ? 'Send reset link' : 'Step into your world'}<ArrowRight size={17}/></Button>
        </form>
        <p className="auth-switch">{mode === 'signup' ? 'Already part of the story?' : mode === 'reset' ? 'Remember your password?' : 'New around here?'} <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError('') }}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</button></p>
      </>}
      <div className="demo-divider"/><Link to="/offline" className="button button-secondary w-full"><Cpu size={16}/> Use real Offline AI on Android</Link><Link to="/onboarding" search={{ demo: true }} className="demo-link">Just looking around? <span>Try a local demo <ArrowUpRightIcon/></span></Link><p className="auth-legal"><ShieldCheck size={13}/> Adults 18+ only. By continuing, you agree to our <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.</p></section></div>
}
function ArrowUpRightIcon() { return <ArrowRight size={14} style={{ transform: 'rotate(-35deg)' }}/> }
function GoogleIcon() { return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 6 1.2 8.1 3.2l5.7-5.7A19.9 19.9 0 0 0 24 4C13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5Z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 6 1.2 8.1 3.2l5.7-5.7A19.9 19.9 0 0 0 24 4C16.2 4 9.4 8.4 6.3 14.7Z"/><path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.3l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44Z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.3 5.2C41.4 35.1 44 30 44 24c0-1.3-.1-2.4-.4-3.5Z"/></svg> }

export function OnboardingPage({ demo = false }: { demo?: boolean }) {
  const { user, profile, startDemo, saveProfile, authLoading, offlineAI } = useApp()
  const navigate = useNavigate()
  const [username, setUsername] = useState(profile?.username.startsWith('dreamer_') ? '' : profile?.username || '')
  const [avatar, setAvatar] = useState(profile?.avatar_url || '/images/luna.webp')
  const [adult, setAdult] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const avatars = ['luna', 'akira', 'kai', 'seraphina', 'atlas', 'milo']
  useEffect(() => { if (user && profile?.onboarding_completed) void navigate({ to: '/' }) }, [user, profile, navigate])
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (!adult) { setError('Please confirm you’re 18 or older to continue.'); return }
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) { setError('Use 3–24 letters, numbers, or underscores.'); return }
    setSaving(true)
    try {
      if ((demo || offlineAI) && !user) startDemo(username, avatar)
      else if (user) await saveProfile({ username, avatar_url: avatar, adult_confirmed: true, onboarding_completed: true, nsfw_enabled: false })
      else throw new Error('Sign in to finish your profile, or choose the local demo.')
      void navigate({ to: '/' })
    } catch (error) { setError(errorMessage(error).includes('unique') ? 'That username already has a story. Try a different one.' : errorMessage(error)) }
    finally { setSaving(false) }
  }
  const upload = async (file?: File) => {
    if (!file) return
    setUploading(true)
    try { setAvatar(await uploadAvatar(file, user?.id || 'demo')) } catch (error) { toast.error(errorMessage(error)) }
    finally { setUploading(false) }
  }
  if (!authLoading && !user && !demo && !offlineAI) return <div className="centered-page"><section className="onboarding-card"><Logo/><h2>Let’s make this world yours.</h2><p>Sign in to finish your profile and save your stories across devices.</p><Link to="/auth" className="button button-primary">Sign in <ArrowRight size={16}/></Link><Link to="/onboarding" search={{ demo: true }} className="text-link">Or explore a local demo</Link></section></div>
  return <div className="centered-page page-enter"><form className="onboarding-card" onSubmit={event => void submit(event)}><Logo/><div className="onboarding-step"><span className="step-done"><Check size={12}/></span><span/><i>2</i></div><span className="eyebrow">A LITTLE INTRODUCTION</span><h2>Every soul needs a name.</h2><p>Let’s make your corner of this world feel like you.</p>{(demo || offlineAI) && !user && <div className="demo-notice"><Sparkles size={16}/><span>{offlineAI ? 'Offline AI · Real on-device replies · No cloud account' : 'Local demo · Scripted replies · Saved in this browser'}</span></div>}
    <div className="onboarding-avatar"><Avatar src={avatar} name="Your chosen avatar"/><label className="upload-avatar-button" aria-label="Upload your avatar"><ImagePlus size={16}/><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => void upload(e.target.files?.[0])} disabled={uploading}/></label></div><span className="avatar-caption">Choose a face for your adventures</span><div className="avatar-picker">{avatars.map(name => <button type="button" key={name} onClick={() => setAvatar(`/images/${name}.webp`)} className={cn(avatar === `/images/${name}.webp` && 'selected')} aria-label={`Choose ${name} avatar`} aria-pressed={avatar === `/images/${name}.webp`}><Avatar src={`/images/${name}.webp`} name={name}/>{avatar === `/images/${name}.webp` && <CheckCircle2 size={16}/>}</button>)}</div>
    <label className="field-label" htmlFor="username">Your username</label><div className="input-icon-wrap"><span className="at-symbol">@</span><input id="username" autoComplete="username" placeholder="a_little_stardust" required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]{3,24}" value={username} onChange={e => setUsername(e.target.value)}/></div><small className="field-hint">3–24 letters, numbers, and underscores. Entirely you.</small>
    <label className="checkbox-label adult-checkbox"><input type="checkbox" checked={adult} onChange={e => setAdult(e.target.checked)} required/><span>I confirm I am <strong>18 or older</strong> and agree to the <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.</span></label>{error && <p className="form-error" role="alert">{error}</p>}<Button type="submit" className="w-full" loading={saving || uploading} disabled={authLoading}>Make myself at home <ArrowRight size={17}/></Button><div className="onboarding-safety"><ShieldCheck size={14}/> A safe space. Content filters on by default.</div>
  </form></div>
}

export function ResetPasswordPage() {
  const { offlineAI } = useApp()
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true)
    try {
      if (offlineAI) throw new Error('Switch out of Offline AI before changing a cloud password.')
      if (!supabase) throw new Error('Supabase is not connected.')
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      toast.success('Your password is updated. A fresh start awaits.'); void navigate({ to: '/' })
    } catch (error) { setError(errorMessage(error)) } finally { setSaving(false) }
  }
  return <div className="centered-page"><form className="onboarding-card" onSubmit={event => void submit(event)}><Logo/><h2>A fresh start.</h2><p>Choose a new password to keep your world safe.</p><label className="field-label" htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)} required/>{error && <p className="form-error" role="alert">{error}</p>}<Button type="submit" loading={saving}>Update password <Check size={17}/></Button></form></div>
}

import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, Check, ChevronDown, Eye, Globe2, ImagePlus, Lightbulb, LockKeyhole, MessageCircle, Plus, Save, ShieldCheck, Sparkles, Trash2, WandSparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, Button, EmptyState, Modal } from '../components/ui'
import { useApp } from '../context/AppContext'
import { uploadAvatar } from '../lib/supabase'
import { CATEGORIES } from '../lib/types'
import type { CharacterInput } from '../lib/types'
import { cn, errorMessage, readLocal, writeLocal } from '../lib/utils'

const blankCharacter: CharacterInput = { name: '', avatar_url: '/images/luna.webp', tagline: '', description: '', greeting: '', example_dialogue: '', voice_style: 'Warm & friendly', categories: ['Friends'], visibility: 'public' }
export function CreatePage({ characterId }: { characterId?: string }) {
  const { profile, user, characters, charactersLoading, saveCharacter, deleteCharacter, isDemo } = useApp()
  const navigate = useNavigate()
  const existing = characters.find(c => c.id === characterId)
  const [form, setForm] = useState<CharacterInput>(() => characterId && existing ? existing : readLocal('character-draft', blankCharacter))
  const initialized = useRef(existing?.id)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [portraitOpen, setPortraitOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [formError, setFormError] = useState('')
  useEffect(() => { if (existing && initialized.current !== existing.id) { setForm(existing); initialized.current = existing.id } }, [existing])
  useEffect(() => { if (!characterId) writeLocal('character-draft', form) }, [form, characterId])
  const update = <K extends keyof CharacterInput>(field: K, value: CharacterInput[K]) => setForm(current => ({ ...current, [field]: value }))
  const toggleCategory = (name: typeof CATEGORIES[number]) => {
    const next = form.categories.includes(name) ? form.categories.filter(c => c !== name) : [...form.categories, name]
    if (!next.length) { toast.info('Choose at least one category for your character.'); return }
    update('categories', next)
  }
  const upload = async (file?: File) => {
    if (!file) return
    setUploading(true)
    try { update('avatar_url', await uploadAvatar(file, user?.id || 'demo')); toast.success('A face for your imagination.') }
    catch (error) { toast.error(errorMessage(error)) }
    finally { setUploading(false) }
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setFormError('')
    if (!profile) { toast.info('Sign in, or start a local demo, to save your character. Your draft is kept here.'); void navigate({ to: '/auth' }); return }
    if (!profile.onboarding_completed || !profile.adult_confirmed) { void navigate({ to: '/onboarding' }); return }
    if (form.description.trim().length < 20) { setFormError('Give them a little more personality — at least 20 characters.'); return }
    setSaving(true)
    try {
      const character = await saveCharacter({ ...form, name: form.name.trim(), tagline: form.tagline.trim(), description: form.description.trim(), greeting: form.greeting.trim() }, characterId)
      if (!characterId) writeLocal('character-draft', blankCharacter)
      toast.success(characterId ? 'Their story just got a little better.' : isDemo ? 'Your character is alive in this local demo.' : 'A new soul has entered the world.')
      void navigate({ to: '/chat/$characterId', params: { characterId: character.id } })
    } catch (error) { setFormError(errorMessage(error)) }
    finally { setSaving(false) }
  }
  const remove = async () => {
    if (!characterId) return
    setSaving(true)
    try { await deleteCharacter(characterId); toast.success('Character deleted. There’s always another story.'); void navigate({ to: '/profile' }) }
    catch (error) { toast.error(errorMessage(error)) }
    finally { setSaving(false); setDeleteOpen(false) }
  }
  if (characterId && !charactersLoading && (!existing || existing.creator_id !== profile?.id)) return <EmptyState title="This story isn’t yours to edit." description="You can only edit characters you created."><Link to="/create" className="button button-primary">Create your own <Plus size={16}/></Link></EmptyState>
  const preview = <div className="live-preview-content"><div className="live-character-card"><div className="live-preview-image"><img src={form.avatar_url} alt="Character live preview"/><div/><span><Sparkles size={12}/> YOUR CREATION</span></div><div className="live-preview-details"><h3>{form.name || 'Someone extraordinary'}</h3><p>{form.tagline || 'Their story starts with your imagination.'}</p><span>by @{profile?.username || 'you'} <i>·</i> {form.categories[0]}</span></div></div><div className="preview-greeting"><Avatar src={form.avatar_url} name={form.name || 'Your character'}/><div><span>{form.name || 'Your character'}</span><p>{form.greeting || 'Their first words are waiting to be written. Make them a little unforgettable.'}</p></div></div><div className="preview-tip"><Lightbulb size={18}/><p><strong>A little tip</strong>Characters with a distinctive personality and an inviting greeting make the best connections.</p></div></div>
  return <div className="create-page page-enter"><div className="create-intro"><Link to="/" className="back-link"><ArrowLeft size={15}/> Back to your world</Link><div className="eyebrow"><WandSparkles size={14}/> A LITTLE IMAGINATION, ALL YOURS</div><h2>{characterId ? 'Every soul has room to grow.' : 'Dream up someone extraordinary.'}</h2><p>{characterId ? 'Refine their voice. Add a little depth. Make the next chapter even better.' : 'A name. A personality. A world of possibilities. Who will you create?'}</p></div>{isDemo && <div className="demo-notice"><Sparkles size={15}/> Local demo — characters and uploads are saved only in this browser, not published.</div>}
    <form className="create-layout" onSubmit={event => void submit(event)}><div className="create-form-column"><section className="form-section"><div className="form-section-heading"><span>01</span><div><h3>A face. A name. A first impression.</h3><p>The little things that make someone, someone.</p></div></div><div className="character-avatar-field"><div className="create-avatar"><Avatar src={form.avatar_url} name="Character avatar"/><label className="upload-avatar-button" aria-label="Upload character avatar"><ImagePlus size={15}/><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={e => void upload(e.target.files?.[0])}/></label></div><div><strong>Give them a face</strong><p>JPG, PNG or WebP. Up to 5 MB.</p><button className="text-link" type="button" onClick={() => setPortraitOpen(true)}>Or choose a starter portrait <ArrowRight size={13}/></button></div></div>
      <div className="form-field"><div className="label-row"><label htmlFor="character-name">Character name <em>*</em></label><span>{form.name.length}/50</span></div><input id="character-name" placeholder="What should we call them?" value={form.name} onChange={e => update('name', e.target.value)} required minLength={2} maxLength={50}/></div>
      <div className="form-field"><div className="label-row"><label htmlFor="character-tagline">Their one-liner <em>*</em></label><span>{form.tagline.length}/100</span></div><input id="character-tagline" placeholder="A little hint of who they are…" value={form.tagline} onChange={e => update('tagline', e.target.value)} required maxLength={100}/><small className="field-hint">A short tagline that makes someone stop scrolling.</small></div>
    </section><section className="form-section"><div className="form-section-heading"><span>02</span><div><h3>The soul of your character.</h3><p>This is where your imagination comes alive.</p></div></div>
      <div className="form-field"><div className="label-row"><label htmlFor="character-personality">Personality & backstory <em>*</em></label><span>{form.description.length}/6000</span></div><textarea id="character-personality" rows={6} placeholder="Who are they? What makes them laugh? What world do they live in? Describe their personality, quirks, and the way they connect with others…" value={form.description} onChange={e => update('description', e.target.value)} required minLength={20} maxLength={6000}/><small className="field-hint">The more specific you are, the more alive they’ll feel. All characters must be adults.</small></div>
      <div className="form-field"><div className="label-row"><label htmlFor="character-greeting">Their first hello <em>*</em></label><span>{form.greeting.length}/1500</span></div><textarea id="character-greeting" rows={4} placeholder={'*They look up, a small smile forming.*\n\n“Hey. I had a feeling you’d find your way here.”'} value={form.greeting} onChange={e => update('greeting', e.target.value)} required minLength={5} maxLength={1500}/><small className="field-hint">Set the scene and give someone a reason to reply.</small></div>
      <div className="form-field"><div className="label-row"><label htmlFor="character-dialogue">Example dialogue <span className="optional-label">optional</span></label><span>{form.example_dialogue.length}/3000</span></div><textarea id="character-dialogue" rows={4} placeholder={'User: Tell me something about yourself.\nCharacter: Well, that depends. Do you want the interesting answer or the honest one?'} value={form.example_dialogue} onChange={e => update('example_dialogue', e.target.value)} maxLength={3000}/><small className="field-hint">A little sample helps your character find their voice.</small></div>
      <div className="form-field"><label htmlFor="voice-style">Voice & conversation style</label><div className="select-wrap"><select id="voice-style" value={form.voice_style} onChange={e => update('voice_style', e.target.value)}>{['Warm & friendly', 'Soft & soothing', 'Calm & mysterious', 'Playful & witty', 'Warm & enchanting', 'Warm & wise', 'Friendly & comforting', 'Bold & adventurous'].map(voice => <option key={voice}>{voice}</option>)}</select><ChevronDown size={16}/></div><small className="field-hint">Sets the tone of their writing, not an audio voice.</small></div>
    </section><section className="form-section"><div className="form-section-heading"><span>03</span><div><h3>A place in your world.</h3><p>Help the right people find the right soul.</p></div></div><div className="form-field"><label>Categories <em>*</em></label><div className="form-category-chips">{CATEGORIES.map(category => <button type="button" key={category} onClick={() => toggleCategory(category)} className={cn('category-chip', form.categories.includes(category) && 'category-chip-active')} aria-pressed={form.categories.includes(category)}>{form.categories.includes(category) ? <Check size={13}/> : <Plus size={13}/>} {category}</button>)}</div></div>
      <div className="form-field"><label>Who can meet them?</label><div className="visibility-options"><button type="button" aria-pressed={form.visibility === 'public'} className={cn(form.visibility === 'public' && 'selected')} onClick={() => update('visibility', 'public')}><Globe2 size={19}/><span><strong>Open to the world</strong><small>Anyone can discover and chat.</small></span><span className="radio-circle">{form.visibility === 'public' && <i/>}</span></button><button type="button" aria-pressed={form.visibility === 'private'} className={cn(form.visibility === 'private' && 'selected')} onClick={() => update('visibility', 'private')}><LockKeyhole size={19}/><span><strong>Just between you two</strong><small>Your own private connection.</small></span><span className="radio-circle">{form.visibility === 'private' && <i/>}</span></button></div></div><div className="form-safety"><ShieldCheck size={18}/><p>Keep it kind. Keep it safe. Characters must follow our <Link to="/terms">community guidelines</Link>. Explicit sexual content and characters depicting minors in adult situations are never allowed.</p></div>
    </section>{formError && <p className="form-error" role="alert">{formError}</p>}<div className="create-form-actions">{characterId ? <Button type="button" variant="danger" onClick={() => setDeleteOpen(true)}><Trash2 size={16}/>Delete</Button> : <span><Save size={13}/> Draft saved on this device</span>}<Button type="button" variant="secondary" className="mobile-preview-button" onClick={() => setPreviewOpen(true)}><Eye size={16}/>Preview</Button><Button type="submit" loading={saving || uploading}>{characterId ? 'Save their story' : 'Bring them to life'}<Sparkles size={16}/></Button></div></div><aside className="create-preview"><div className="preview-heading"><span><Eye size={15}/> LIVE PREVIEW</span><span className="online-dot"/></div>{preview}<p className="preview-disclaimer"><MessageCircle size={12}/> A little glimpse of your next great connection.</p></aside></form>
    <Modal open={portraitOpen} onClose={() => setPortraitOpen(false)} title="A face for your imagination"><p className="modal-subtitle">A starting point. You can always upload your own.</p><div className="starter-portraits">{['luna', 'akira', 'kai', 'seraphina', 'atlas', 'milo'].map(name => <button key={name} className={cn(form.avatar_url === `/images/${name}.webp` && 'selected')} aria-label={`Choose ${name} portrait`} onClick={() => { update('avatar_url', `/images/${name}.webp`); setPortraitOpen(false) }}><img src={`/images/${name}.webp`} alt={name}/>{form.avatar_url === `/images/${name}.webp` && <Check size={19}/>}</button>)}</div></Modal>
    <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="A little preview">{preview}</Modal>
    <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Say goodbye to this character?"><p className="modal-subtitle">This permanently deletes {form.name}, their conversations, and favorites. This chapter can’t be brought back.</p><div className="modal-actions"><Button variant="secondary" onClick={() => setDeleteOpen(false)}>Keep them</Button><Button variant="danger" loading={saving} onClick={() => void remove()}>Delete character <Trash2 size={16}/></Button></div></Modal>
  </div>
}

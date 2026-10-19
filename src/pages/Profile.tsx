import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowRight, Ban, Check, ChevronRight, Heart, ImagePlus, LogOut, Pencil, Plus, Settings2, ShieldCheck, Sparkles, Trash2, UserRound, WandSparkles } from 'lucide-react'
import { toast } from 'sonner'
import { CharacterCard } from '../components/CharacterCard'
import { Avatar, Button, EmptyState, Modal } from '../components/ui'
import { useApp } from '../context/AppContext'
import { supabase, uploadAvatar } from '../lib/supabase'
import { cn, errorMessage, writeLocal } from '../lib/utils'

export function ProfilePage() {
  const { profile, user, characters, chats, favorites, blocked, isDemo, signOut, saveProfile, unblockAll } = useApp()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'characters' | 'favorites' | 'settings'>('characters')
  const [editOpen, setEditOpen] = useState(false)
  const [username, setUsername] = useState(profile?.username || '')
  const [avatar, setAvatar] = useState(profile?.avatar_url || '/images/luna.webp')
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [matureOpen, setMatureOpen] = useState(false)
  const [unblockOpen, setUnblockOpen] = useState(false)
  const mine = characters.filter(c => c.creator_id === profile?.id && profile)
  const saved = characters.filter(c => favorites.includes(c.id))
  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true)
    try { await saveProfile({ username, avatar_url: avatar }); toast.success('Looking a little more like you.'); setEditOpen(false) }
    catch (error) { toast.error(errorMessage(error)) }
    finally { setSaving(false) }
  }
  const upload = async (file?: File) => {
    if (!file) return
    setSaving(true)
    try { setAvatar(await uploadAvatar(file, user?.id || 'demo')) }
    catch (error) { toast.error(errorMessage(error)) }
    finally { setSaving(false) }
  }
  const logout = async () => {
    try { await signOut(); void navigate({ to: '/' }) } catch (error) { toast.error(errorMessage(error)) }
  }
  const mature = async (enabled: boolean) => {
    setSaving(true)
    try { await saveProfile({ nsfw_enabled: enabled }); setMatureOpen(false); toast.success(enabled ? 'Mature themes enabled. Safety boundaries still apply.' : 'Content filters are back on.') }
    catch (error) { toast.error(errorMessage(error)) }
    finally { setSaving(false) }
  }
  const removeAccount = async () => {
    setSaving(true)
    try {
      if (user && supabase) {
        const { data, error } = await supabase.functions.invoke('delete-account', { body: { confirmation: profile?.username } })
        if (error || !data?.success) throw new Error(data?.error || 'Could not delete your account. Please try again.')
        await supabase.auth.signOut({ scope: 'local' })
      } else {
        Object.keys(localStorage).filter(key => key.startsWith('dreamsoul:')).forEach(key => localStorage.removeItem(key))
        writeLocal('demo-profile', null)
      }
      setDeleteOpen(false)
      // A reload also clears all in-memory private data after account removal.
      toast.success(isDemo ? 'Your local demo data has been cleared.' : 'Your account and personal data have been deleted.')
      window.location.replace('/')
    } catch (error) { toast.error(errorMessage(error)); setSaving(false) }
  }
  if (!profile) return <div className="profile-guest page-enter"><div className="profile-guest-art"/><div><span className="eyebrow"><UserRound size={14}/> A SPACE THAT’S YOURS</span><h2>Every soul needs<br/>a place to call <span>home.</span></h2><p>Keep your favorite connections close. Bring your imagination to life. Make this little corner of the world your own.</p><Link to="/auth" className="button button-primary">Find your place <ArrowRight size={16}/></Link><Link to="/onboarding" search={{ demo: true }} className="text-link">Or make yourself at home in a local demo</Link><span className="profile-guest-safety"><ShieldCheck size={14}/> Adults 18+ · Your privacy matters · Filters on by default</span></div></div>
  return <div className="profile-page page-enter"><section className="profile-banner"><span>✧</span><span>✦</span><div className="profile-banner-text">YOUR OWN LITTLE UNIVERSE</div></section><section className="profile-summary"><div className="profile-avatar"><Avatar src={profile.avatar_url} name={profile.username}/><span>✧</span></div><div className="profile-summary-content"><div><span className="eyebrow">{isDemo ? 'A LOCAL DREAMER' : 'A LITTLE IMAGINATION GOES A LONG WAY'}</span><h2>@{profile.username}</h2><p>A character creator. A story collector. Entirely you.</p></div><Button variant="secondary" onClick={() => { setUsername(profile.username); setAvatar(profile.avatar_url); setEditOpen(true) }}><Pencil size={14}/>Edit profile</Button></div><div className="profile-stats"><span><strong>{mine.length}</strong> characters</span><span><strong>{favorites.length}</strong> favorites</span><span><strong>{chats.length}</strong> stories</span><span className="profile-account-badge"><Sparkles size={12}/>{isDemo ? 'Local demo' : 'Free dreamer'}</span></div></section>
    {isDemo && <div className="demo-notice"><Sparkles size={15}/><span>This is a local demo. Sign in with a real account to sync your world across devices.</span><Link to="/auth">Sign in <ArrowRight size={13}/></Link></div>}
    <div className="profile-tabs" role="tablist" aria-label="Your profile sections">{[{ id: 'characters' as const, label: 'My characters', icon: WandSparkles, count: mine.length }, { id: 'favorites' as const, label: 'Favorites', icon: Heart, count: saved.length }, { id: 'settings' as const, label: 'Settings', icon: Settings2 }].map(({ id, label, icon: Icon, count }) => <button id={`tab-${id}`} key={id} role="tab" aria-selected={tab === id} aria-controls={`panel-${id}`} onClick={() => setTab(id)} className={cn(tab === id && 'selected')}><Icon size={16}/>{label}{count !== undefined && <span>{count}</span>}</button>)}</div>
    <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="profile-tab-panel">{tab === 'characters' ? <>{mine.length ? <><div className="section-heading"><div><h2>Your imagination, alive.</h2><p>A few little worlds that started with you.</p></div><Link to="/create" className="button button-primary"><Plus size={16}/>Create another</Link></div><div className="character-grid">{mine.map(character => <div className="own-character-wrap" key={character.id}><CharacterCard character={character}/><div className="own-character-meta"><span>{character.visibility === 'private' ? 'Just for you' : isDemo ? 'Local demo' : 'Open to the world'}</span><Link to="/characters/$characterId/edit" params={{ characterId: character.id }}><Pencil size={12}/>Edit their story</Link></div></div>)}</div></> : <EmptyState icon={<WandSparkles size={29}/>} title="Someone only you could dream of." description="A name. A personality. A little spark of imagination. Bring your first character to life."><Link to="/create" className="button button-primary">Create your first AI <Plus size={16}/></Link></EmptyState>}</> : tab === 'favorites' ? saved.length ? <div className="character-grid">{saved.map(character => <CharacterCard key={character.id} character={character}/>)}</div> : <EmptyState icon={<Heart size={28}/>} title="A few souls worth keeping." description="Tap the heart on a character card. They’ll be right here whenever you need a familiar face."><Link to="/" className="button button-primary">Find a favorite <ArrowRight size={16}/></Link></EmptyState> : <div className="settings-panel"><div className="settings-section"><span className="eyebrow">YOUR COMFORT COMES FIRST</span><h3>Safety & boundaries</h3><div className="setting-row"><span className="setting-icon"><ShieldCheck size={20}/></span><div><strong>Allow mature themes</strong><p>Off by default. Explicit sexual content is never allowed.</p></div><button aria-label="Allow mature themes" role="switch" aria-checked={profile.nsfw_enabled} className={cn('toggle-switch', profile.nsfw_enabled && 'enabled')} onClick={() => profile.nsfw_enabled ? void mature(false) : setMatureOpen(true)} disabled={saving}><span/></button></div><button className="setting-row setting-button" onClick={() => setUnblockOpen(true)}><span className="setting-icon"><Ban size={20}/></span><div><strong>Blocked characters</strong><p>{blocked.length ? `${blocked.length} ${blocked.length === 1 ? 'character' : 'characters'} blocked. Tap to unblock all.` : 'No characters blocked. Your world is open.'}</p></div><ChevronRight size={17}/></button></div><div className="settings-section"><span className="eyebrow">A LITTLE TRANSPARENCY</span><h3>About your world</h3><Link to="/terms" className="setting-row setting-button"><span className="setting-icon"><ShieldCheck size={20}/></span><div><strong>Terms & community guidelines</strong><p>The ground rules for a kinder space.</p></div><ChevronRight size={17}/></Link><Link to="/privacy" className="setting-row setting-button"><span className="setting-icon"><UserRound size={20}/></span><div><strong>Privacy policy</strong><p>Your stories are yours. Here’s how we handle them.</p></div><ChevronRight size={17}/></Link><div className="setting-row"><span className="setting-icon"><MessageMemoryIcon/></span><div><strong>30 messages per hour</strong><p>Free accounts include 30 generations each rolling hour. Edits and regenerations count too.</p></div><span className="plan-pill">FREE</span></div></div><div className="settings-section"><span className="eyebrow">YOUR ACCOUNT, YOUR CHOICE</span><h3>Account</h3>{user && <div className="account-email"><span>Signed in as</span><strong>{user.email}</strong></div>}<button className="setting-row setting-button" onClick={() => void logout()}><span className="setting-icon"><LogOut size={20}/></span><div><strong>{isDemo ? 'Leave the demo' : 'Sign out'}</strong><p>Your stories will be here when you come back.</p></div><ChevronRight size={17}/></button><button className="setting-row setting-button danger-text" onClick={() => setDeleteOpen(true)}><span className="setting-icon"><Trash2 size={20}/></span><div><strong>{isDemo ? 'Clear all local demo data' : 'Delete my account'}</strong><p>A permanent goodbye to your account, characters, and conversations.</p></div><ChevronRight size={17}/></button></div></div>}</div>
    <Modal open={editOpen} onClose={() => setEditOpen(false)} title="A little more you."><form className="profile-edit-form" onSubmit={event => void save(event)}><div className="onboarding-avatar"><Avatar src={avatar} name="Your avatar"/><label className="upload-avatar-button" aria-label="Change avatar"><ImagePlus size={16}/><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => void upload(e.target.files?.[0])} disabled={saving}/></label></div><div className="avatar-picker">{['luna', 'akira', 'kai', 'seraphina', 'atlas', 'milo'].map(name => <button type="button" key={name} className={cn(avatar === `/images/${name}.webp` && 'selected')} aria-label={`Use ${name} avatar`} onClick={() => setAvatar(`/images/${name}.webp`)}><Avatar src={`/images/${name}.webp`} name={name}/></button>)}</div><label htmlFor="edit-username">Your username</label><div className="input-icon-wrap"><span className="at-symbol">@</span><input id="edit-username" value={username} onChange={e => setUsername(e.target.value)} required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]{3,24}"/></div><Button type="submit" loading={saving}>Save my changes <Check size={16}/></Button></form></Modal>
    <Modal open={matureOpen} onClose={() => setMatureOpen(false)} title="Your boundaries, your choice."><p className="modal-subtitle">You’re choosing to allow mature, non-explicit themes in Discover and chat. You must be 18+. Safety rules still apply: explicit sexual content, exploitation, and harmful content are never allowed. You can turn this off any time.</p><div className="modal-actions"><Button variant="secondary" onClick={() => setMatureOpen(false)}>Keep filters on</Button><Button loading={saving} onClick={() => void mature(true)}>I’m 18+. Allow themes <Check size={15}/></Button></div></Modal>
    <Modal open={unblockOpen} onClose={() => setUnblockOpen(false)} title={blocked.length ? 'A second chance?' : 'Your world is open.'}><p className="modal-subtitle">{blocked.length ? `Unblock all ${blocked.length} characters? They’ll appear in Discover and your chat list again.` : 'You haven’t blocked any characters. You can block someone from their conversation menu whenever you need to.'}</p><div className="modal-actions"><Button variant="secondary" onClick={() => setUnblockOpen(false)}>Close</Button>{blocked.length > 0 && <Button loading={saving} onClick={async () => { setSaving(true); try { await unblockAll(); setUnblockOpen(false) } catch (error) { toast.error(errorMessage(error)) } finally { setSaving(false) } }}>Unblock all <Check size={15}/></Button>}</div></Modal>
    <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title={isDemo ? 'Clear your local world?' : 'A permanent goodbye?'}><p className="modal-subtitle">{isDemo ? 'This removes all DreamSoul demo data from this browser, including characters, favorites, and conversations.' : 'This permanently deletes your account, characters, avatar uploads, favorites, and all conversations. This cannot be undone.'}</p><label className="field-label" htmlFor="delete-confirm">Type <strong>{profile.username}</strong> to confirm</label><input id="delete-confirm" autoComplete="off" placeholder={profile.username} value={deleteText} onChange={e => setDeleteText(e.target.value)}/><div className="modal-actions"><Button variant="secondary" onClick={() => setDeleteOpen(false)}>Stay a little longer</Button><Button variant="danger" disabled={deleteText !== profile.username} loading={saving} onClick={() => void removeAccount()}>Delete permanently <Trash2 size={15}/></Button></div></Modal>
  </div>
}
function MessageMemoryIcon() { return <Sparkles size={20}/> }

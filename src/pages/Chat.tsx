import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, ArrowUp, Ban, ChevronDown, Copy, Flag, Heart, Info, Loader2, MessageCircle, MoreHorizontal, Pencil, RefreshCw, RotateCcw, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, Button, EmptyState, Modal } from '../components/ui'
import { useApp } from '../context/AppContext'
import { greetingMessage, getDemoReply, loadConversation, reserveDemoRequest, streamChat, streamDemoReply } from '../lib/chat'
import type { ChatMode } from '../lib/chat'
import { streamOfflineReply } from '../lib/offline'
import { supabase } from '../lib/supabase'
import type { Character, Message } from '../lib/types'
import { cn, compactNumber, errorMessage, readLocal, writeLocal } from '../lib/utils'

function MessageText({ content }: { content: string }) {
  return <>{content.split(/(\*[^*]+\*)/g).map((part, index) => part.startsWith('*') && part.endsWith('*') ? <em key={index}>{part.slice(1, -1)}</em> : <span key={index}>{part}</span>)}</>
}
export function ChatPage({ characterId }: { characterId: string }) {
  const { characters, charactersLoading, profile, user, isDemo, offlineAI, favorites, toggleFavorite, blockCharacter, refreshChats, updateLocalChats } = useApp()
  const navigate = useNavigate()
  const storagePrefix = offlineAI ? 'offline:' : ''
  const character = characters.find(c => c.id === characterId)
  const [messages, setMessages] = useState<Message[]>([])
  const [composer, setComposer] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [editing, setEditing] = useState<Message | null>(null)
  const [editContent, setEditContent] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [restartOpen, setRestartOpen] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reason, setReason] = useState('Inappropriate content')
  const [reportDetails, setReportDetails] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [showScrollDown, setShowScrollDown] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const busyRef = useRef(false)
  const nearBottom = useRef(true)
  const regeneration = useRef(0)

  const load = useCallback(async () => {
    if (!character) { if (!charactersLoading) setLoading(false); return }
    setLoading(true); setLoadError('')
    try {
      const result = profile ? await loadConversation(character, user?.id, offlineAI) : { messages: [greetingMessage(character)] }
      setMessages(result.messages)
    } catch (error) { setLoadError(errorMessage(error)) }
    finally { setLoading(false) }
  }, [character, charactersLoading, profile?.id, user?.id, offlineAI]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    controllerRef.current?.abort(); busyRef.current = false; setSending(false); setSendError(''); setEditing(null)
    setComposer(readLocal(`${offlineAI ? 'offline:' : ''}draft:${characterId}`, ''))
    void load()
    return () => { controllerRef.current?.abort() }
  }, [characterId, user?.id, profile?.id, load])
  useEffect(() => {
    if (nearBottom.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, loading])
  useEffect(() => { writeLocal(`${offlineAI ? 'offline:' : ''}draft:${characterId}`, composer) }, [composer, characterId, offlineAI])
  useEffect(() => {
    if (!menuOpen) return
    const handler = () => setMenuOpen(false)
    const timer = window.setTimeout(() => document.addEventListener('click', handler), 0)
    return () => { window.clearTimeout(timer); document.removeEventListener('click', handler) }
  }, [menuOpen])

  const send = async (mode: ChatMode = 'send', content = composer) => {
    if (!character || busyRef.current) return
    if (!profile?.adult_confirmed || !profile.onboarding_completed) { setAuthOpen(true); return }
    if (mode !== 'regenerate' && !content.trim()) return
    busyRef.current = true
    setSending(true); setSendError(''); nearBottom.current = true
    const previous = messages
    const lastUserIndex = messages.findLastIndex(m => m.role === 'user')
    let localSaved = false
    let next = [...messages]
    const now = new Date().toISOString()
    const chatId = `local-${character.id}`
    const temporaryId = crypto.randomUUID()
    const controller = new AbortController(); controllerRef.current = controller
    try {
      if (!user && !offlineAI) reserveDemoRequest()
      if (mode === 'regenerate') {
        if (lastUserIndex < 0) return
        next = next.slice(0, lastUserIndex + 1)
        content = next[lastUserIndex].content
        regeneration.current += 1
      } else if (mode === 'edit' && editing) {
        next = next.slice(0, lastUserIndex + 1).map(m => m.id === editing.id ? { ...m, content: content.trim() } : m)
      } else {
        next.push({ id: crypto.randomUUID(), chat_id: chatId, role: 'user', content: content.trim(), created_at: now })
      }
      if (offlineAI) {
        writeLocal(`${storagePrefix}messages:${characterId}`, next, true); localSaved = true
        updateLocalChats({ id: chatId, user_id: 'demo', character_id: characterId, updated_at: now, last_message: content })
      }
      const placeholder: Message = { id: temporaryId, chat_id: chatId, role: 'assistant', content: '', created_at: now }
      setMessages([...next, placeholder]); if (mode === 'send') setComposer('')
      const editId = editing?.id; setEditing(null)
      const onDelta = (delta: string) => setMessages(current => current.map(m => m.id === temporaryId ? { ...m, content: m.content + delta } : m))
      if (user) {
        await streamChat({ characterId, content, mode, editId, signal: controller.signal,
          onStart: (_chatId, userMessage) => {
            if (userMessage?.id) setMessages(current => {
              const index = current.findLastIndex(m => m.role === 'user')
              return current.map((m, i) => i === index ? userMessage : m)
            })
          },
          onDelta,
          onDone: message => { setMessages(current => current.map(m => m.id === temporaryId ? message : m)) },
        })
        await refreshChats()
      } else {
        const text = offlineAI
          ? await streamOfflineReply(character, next, profile.nsfw_enabled, onDelta, controller.signal)
          : getDemoReply(character, content, next.filter(m => m.role === 'user').length - 1 + regeneration.current)
        if (!offlineAI) await streamDemoReply(text, onDelta, controller.signal)
        const complete = [...next, { ...placeholder, content: text }]
        setMessages(complete); writeLocal(`${storagePrefix}messages:${characterId}`, complete, offlineAI)
        updateLocalChats({ id: chatId, user_id: 'demo', character_id: characterId, updated_at: new Date().toISOString(), last_message: text })
      }
    } catch (error) {
      if (controller.signal.aborted) { if (offlineAI) { setMessages(next); setSendError('Reply stopped. You can try the reply again when you’re ready.') } return }
      if (offlineAI && localSaved) { setMessages(next); setSendError(errorMessage(error)); return }
      setMessages(previous)
      let restoreComposer = mode === 'send'
      if (user) {
        try {
          const result = await loadConversation(character, user.id)
          setMessages(result.messages)
          if (result.messages.at(-1)?.role === 'user') restoreComposer = false
        } catch { /* Keep the last known conversation on network failure. */ }
      }
      if (restoreComposer) setComposer(content)
      setSendError(errorMessage(error))
    } finally {
      if (controllerRef.current === controller) { busyRef.current = false; setSending(false); composerRef.current?.focus() }
    }
  }
  const restart = async () => {
    if (!character) return
    setActionLoading(true)
    try {
      if (user) await streamChat({ characterId, mode: 'restart', content: '', onStart: () => {}, onDelta: () => {}, onDone: () => {} })
      else {
        writeLocal(`${storagePrefix}messages:${characterId}`, [greetingMessage(character)], offlineAI)
        updateLocalChats({ id: `local-${characterId}`, user_id: 'demo', character_id: characterId, updated_at: new Date().toISOString(), last_message: '' })
      }
      setMessages([greetingMessage(character)]); setSendError(''); setRestartOpen(false); toast.success('A fresh page. The same extraordinary soul.')
      if (user) await refreshChats()
    } catch (error) { toast.error(errorMessage(error)) }
    finally { setActionLoading(false) }
  }
  const block = async () => {
    setActionLoading(true)
    try { await blockCharacter(characterId); setBlockOpen(false); void navigate({ to: '/' }) }
    catch (error) { toast.error(errorMessage(error)) }
    finally { setActionLoading(false) }
  }
  const report = async (event: FormEvent) => {
    event.preventDefault(); setActionLoading(true)
    try {
      if (user && supabase) {
        const { error } = await supabase.from('reports').insert({ user_id: user.id, character_id: characterId, reason, details: reportDetails })
        if (error) throw error
        toast.success('Report submitted. Thank you for keeping this space safe.')
      } else {
        writeLocal('demo-reports', [...readLocal<unknown[]>('demo-reports', []), { character_id: characterId, reason, details: reportDetails, created_at: new Date().toISOString() }])
        toast.info(offlineAI ? 'Saved on this device only. Switch online and sign in to submit to moderation.' : 'Saved locally for this demo. Sign in to submit reports to moderation.')
      }
      setReportOpen(false); setReportDetails('')
    } catch (error) { toast.error(errorMessage(error)) }
    finally { setActionLoading(false) }
  }
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success('A little piece of the story, copied.') }
    catch { toast.error('Copy isn’t available in this browser.') }
  }

  if (!character && !charactersLoading) return <div className="chat-not-found"><EmptyState title="This soul is a little out of reach." description="This character may be private, blocked, or no longer available."><Link to="/" className="button button-primary">Find a new connection <ArrowRight size={16}/></Link></EmptyState></div>
  if (!character) return <div className="chat-initial-loading"><Loader2 className="spin" size={25}/></div>
  const lastUserIndex = messages.findLastIndex(m => m.role === 'user')
  const lastAssistantIndex = messages.findLastIndex(m => m.role === 'assistant')
  const favorite = favorites.includes(character.id)
  const details = <CharacterDetails character={character} footer={<><div className="memory-note"><Sparkles size={16}/><div><strong>A little memory goes a long way.</strong><p>{offlineAI ? 'Local replies use your character and recent messages that fit the 2,048-token context. Older messages are trimmed from the prompt, not your history.' : 'Each reply remembers the last 20 messages and your character’s personality.'}</p></div></div><p className="character-ai-disclaimer"><ShieldCheck size={13}/> A fictional AI character, not a real person.</p></>}/>

  return <div className="chat-page page-enter"><section className="chat-main"><header className="chat-header"><Link to="/chats" className="icon-button chat-back" aria-label="Back to chats"><ArrowLeft size={21}/></Link><button className="chat-header-character" onClick={() => setDetailOpen(true)}><div className="chat-avatar-wrap"><Avatar src={character.avatar_url} name={character.name}/><span className="online-dot"/></div><span><strong>{character.name}<i>AI</i></strong><small>{sending ? 'Dreaming up a reply…' : 'A little connection. Endless possibilities.'}</small></span></button><div className="chat-header-actions"><button className={cn('icon-button', favorite && 'is-favorite')} onClick={() => void toggleFavorite(character.id)} aria-label={favorite ? 'Remove favorite' : 'Save favorite'}><Heart size={20} fill={favorite ? 'currentColor' : 'none'}/></button><button className="icon-button chat-info-toggle" aria-label="About this character" onClick={() => setDetailOpen(true)}><Info size={20}/></button><div className="chat-menu-wrap"><button className="icon-button" aria-label="Conversation options" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><MoreHorizontal size={23}/></button>{menuOpen && <div className="dropdown-menu"><button onClick={() => setDetailOpen(true)}><Info size={15}/>About this character</button>{character.creator_id === profile?.id && <Link to="/characters/$characterId/edit" params={{ characterId }}><Pencil size={15}/>Edit character</Link>}<button disabled={sending} onClick={() => setRestartOpen(true)}><RotateCcw size={15}/>Start a new chapter</button><span/><button onClick={() => setReportOpen(true)}><Flag size={15}/>Report character</button><button className="danger-text" onClick={() => setBlockOpen(true)}><Ban size={15}/>Block character</button></div>}</div></div></header>
      {!user && <div className="chat-demo-bar"><Sparkles size={12}/><span>{offlineAI ? 'Offline AI · Generated on your phone · Device-only history' : isDemo ? 'Local demo · Scripted replies · Saved on this device' : 'Preview their first hello. Sign in or try a local demo to reply.'}</span>{!profile && !offlineAI && <Link to="/auth">Sign in <ArrowRight size={12}/></Link>}</div>}
      <div className="conversation-scroll" ref={scrollRef} onScroll={e => { const el = e.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160; setShowScrollDown(!nearBottom.current) }}>
        <div className="conversation-inner"><div className="chat-welcome"><div className="chat-welcome-avatar"><img src={character.avatar_url} alt={character.name}/><span>✧</span></div><h2>{character.name}</h2><p>{character.tagline}</p><div>{character.categories.map(category => <span key={category}>{category}</span>)}</div><span className="conversation-beginning">EVERY STORY STARTS SOMEWHERE</span></div>
          {loading ? <div className="message-loading" aria-label="Loading conversation"><div className="skeleton"/><div className="skeleton"/><div className="skeleton"/></div> : loadError ? <div className="chat-error" role="alert"><p>{loadError}</p><Button variant="secondary" onClick={() => void load()}>Try again <RefreshCw size={15}/></Button></div> : <div className="messages-list" aria-live="polite" aria-relevant="additions text">{messages.map((message, index) => <div key={message.id} className={cn('message-row', message.role === 'user' && 'message-row-user')}>
            {message.role === 'assistant' && <Avatar src={character.avatar_url} name={character.name}/>}<div className="message-content"><div className="message-label">{message.role === 'assistant' ? character.name : 'You'} <span>{new Date(message.created_at).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}</span></div><div className={cn('message-bubble', message.role === 'user' && 'message-bubble-user')}>{message.content ? <MessageText content={message.content}/> : <span className="typing-indicator" aria-label={`${character.name} is typing`}><i/><i/><i/></span>}</div>
            {message.content && !sending && <div className="message-actions">{message.role === 'assistant' && <button aria-label="Copy reply" onClick={() => void copy(message.content)}><Copy size={13}/></button>}{message.role === 'assistant' && index === lastAssistantIndex && lastUserIndex >= 0 && index > lastUserIndex && <button aria-label="Regenerate reply" onClick={() => void send('regenerate')}><RefreshCw size={13}/><span>Try a different reply</span></button>}{message.role === 'user' && index === lastUserIndex && <button aria-label="Edit last message" onClick={() => { setEditing(message); setEditContent(message.content) }}><Pencil size={13}/><span>Edit</span></button>}</div>}</div>
          </div>)}</div>}
          {offlineAI && !sending && !sendError && messages.at(-1)?.role === 'user' && <div className="chat-error"><p>Your last message is saved on this device.</p><Button variant="secondary" onClick={() => void send('regenerate')}>Continue local reply <RefreshCw size={14}/></Button></div>}
          {sendError && <div className="chat-error" role="alert"><span>A little pause in the story.</span><p>{sendError}</p><div>{messages.at(-1)?.role === 'user' && <Button variant="secondary" onClick={() => void send('regenerate')}>Try the reply again <RefreshCw size={14}/></Button>}{offlineAI && <Link to="/offline" className="text-link">Offline AI setup</Link>}<button className="text-link" onClick={() => setSendError('')}>Dismiss</button></div></div>}
        </div>
      </div>
      {showScrollDown && <button className="scroll-to-bottom" onClick={() => { nearBottom.current = true; scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }} aria-label="Scroll to latest message"><ChevronDown size={19}/></button>}
      <div className="composer-area">{messages.length <= 1 && !loading && <div className="conversation-starters"><span>A LITTLE INSPIRATION</span><div>{['Tell me your story', 'Let’s go on an adventure', 'How was your day?'].map(prompt => <button key={prompt} disabled={sending} onClick={() => void send('send', prompt)}>{prompt}<ArrowUp size={12}/></button>)}</div></div>}<form className="composer" onSubmit={event => { event.preventDefault(); void send() }}><button type="button" className="composer-sparkle" aria-label="Suggest a conversation starter" onClick={() => { setComposer(['What is a little thing that makes you happy?', 'If we could go anywhere, where would you take me?', 'Tell me a secret about your world.'][Math.floor(Math.random() * 3)]); composerRef.current?.focus() }}><WandSparkles size={21}/></button><textarea ref={composerRef} aria-label="Your message" placeholder={`Say a little hello to ${character.name.split(' ')[0]}…`} value={composer} rows={1} maxLength={4000} onChange={event => { setComposer(event.target.value); event.target.style.height = 'auto'; event.target.style.height = `${Math.min(event.target.scrollHeight, 128)}px` }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send() } }} disabled={sending || loading}/>{offlineAI && sending ? <button type="button" className="send-button" aria-label="Stop reply" onClick={() => controllerRef.current?.abort()}>■</button> : <button type="submit" className="send-button" disabled={sending || !composer.trim() || loading} aria-label="Send message">{sending ? <Loader2 className="spin" size={19}/> : <ArrowUp size={22}/>}</button>}</form><div className="composer-footer"><span>AI, a little imagination, and you. Remember, characters aren’t real people.</span>{composer.length > 3500 ? <span>{composer.length}/4000</span> : <span className="composer-enter">↵ to send</span>}</div></div>
    </section><aside className="chat-character-sidebar"><div className="details-eyebrow"><span>THE SOUL BEHIND THE CHAT</span><Sparkles size={13}/></div>{details}</aside>
    <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="A little about this soul" className="character-details-modal">{details}</Modal>
    <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="A little rewrite?"><p className="modal-subtitle">Edit your last message and let the story take a different turn. The reply after it will be replaced.</p><form onSubmit={event => { event.preventDefault(); void send('edit', editContent) }}><textarea aria-label="Edit your last message" className="edit-message-input" rows={5} value={editContent} maxLength={4000} required onChange={e => setEditContent(e.target.value)}/><div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Keep the original</Button><Button type="submit" disabled={!editContent.trim()} loading={sending}>Save & get a reply <ArrowRight size={15}/></Button></div></form></Modal>
    <Modal open={restartOpen} onClose={() => setRestartOpen(false)} title="A fresh chapter?"><p className="modal-subtitle">This clears your conversation with {character.name} and starts with their first hello. Your previous messages can’t be recovered.</p><div className="modal-actions"><Button variant="secondary" onClick={() => setRestartOpen(false)}>Keep our story</Button><Button onClick={() => void restart()} loading={actionLoading}>Start fresh <RotateCcw size={15}/></Button></div></Modal>
    <Modal open={blockOpen} onClose={() => setBlockOpen(false)} title={`Block ${character.name}?`}><p className="modal-subtitle">They’ll disappear from Discover and your chat list. You can unblock characters in your profile settings.</p><div className="modal-actions"><Button variant="secondary" onClick={() => setBlockOpen(false)}>Never mind</Button><Button variant="danger" loading={actionLoading} onClick={() => void block()}>Block character <Ban size={15}/></Button></div></Modal>
    <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Help keep this space kind"><p className="modal-subtitle">Tell us what’s wrong with {character.name}. Reports are private.{!user && ' This local mode saves reports on this device only. Sign in to send a report to moderation.'}</p><form className="report-form" onSubmit={event => void report(event)}><label htmlFor="report-reason">What happened?</label><select id="report-reason" value={reason} onChange={e => setReason(e.target.value)}>{['Inappropriate content', 'Harmful behavior', 'Impersonation', 'Other'].map(item => <option key={item}>{item}</option>)}</select><label htmlFor="report-details">A little more detail <span className="optional-label">optional</span></label><textarea id="report-details" rows={4} placeholder="Help us understand what happened…" maxLength={2000} value={reportDetails} onChange={e => setReportDetails(e.target.value)}/><Button type="submit" loading={actionLoading}>{user ? 'Submit report' : offlineAI ? 'Save local report' : 'Save demo report'}<Flag size={15}/></Button></form></Modal>
    <Modal open={authOpen} onClose={() => setAuthOpen(false)} title="Make this story yours."><div className="chat-auth-prompt"><div className="empty-icon"><MessageCircle size={28}/></div><p>{offlineAI ? 'Create your local profile and confirm you’re 18 or older before chatting. No cloud account is needed for offline AI.' : 'Sign in to keep your conversations across devices, or explore a local demo with scripted replies. DreamSoul is for adults 18+.'}</p><Link to={offlineAI ? '/onboarding' : user ? '/onboarding' : '/auth'} search={offlineAI ? { demo: true } : {}} className="button button-primary">{offlineAI ? 'Create local profile' : user ? 'Finish your profile' : 'Sign in to connect'}<ArrowRight size={16}/></Link>{!user && !offlineAI && <Link to="/onboarding" search={{ demo: true }} className="button button-secondary">Explore a local demo <Sparkles size={16}/></Link>}<span>Your draft stays right here, waiting for you.</span></div></Modal>
  </div>
}

function CharacterDetails({ character, footer }: { character: Character; footer: ReactNode }) {
  return <div className="character-detail-content"><div className="detail-portrait"><img src={character.avatar_url} alt={character.name}/><div/><span><Sparkles size={11}/> A SOUL WORTH KNOWING</span><h2>{character.name}</h2></div><p className="detail-tagline">{character.tagline}</p><div className="detail-creator">Created with imagination by <strong>@{character.creator_name}</strong></div><div className="detail-stats"><span><MessageCircle size={14}/>{compactNumber(character.chat_count)} chats</span><span className="detail-rating">★ {character.rating > 0 ? character.rating.toFixed(1) : 'New soul'}</span></div><div className="detail-category-list">{character.categories.map(c => <span key={c}>{c}</span>)}</div><div className="detail-bio"><h3>A little about them</h3><p>{character.description}</p><div><span>CONVERSATION STYLE</span><strong>{character.voice_style}</strong></div></div>{footer}</div>
}

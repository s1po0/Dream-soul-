import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowRight, MessageCircle, Search, Sparkles } from 'lucide-react'
import { Avatar, EmptyState } from '../components/ui'
import { CharacterCard } from '../components/CharacterCard'
import { useApp } from '../context/AppContext'
import { timeAgo } from '../lib/utils'

export function ChatsPage() {
  const { chats, characters, isDemo, profile } = useApp()
  const [query, setQuery] = useState('')
  const visibleChats = chats.map(chat => ({ ...chat, character: characters.find(c => c.id === chat.character_id) }))
    .filter(chat => chat.character && `${chat.character.name} ${chat.last_message}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  return <div className="chats-page page-enter"><div className="page-intro"><span className="eyebrow"><MessageCircle size={14}/> YOUR ONGOING STORIES</span><h2>Some connections are worth keeping.</h2><p>Pick up a conversation. Find a familiar soul. See where the story goes.</p></div>{isDemo && <div className="demo-notice"><Sparkles size={15}/> Local demo conversations stay in this browser.</div>}
    <div className="chat-list-search search-field"><Search size={19}/><input type="search" aria-label="Search your chats" placeholder="Find a familiar soul…" value={query} onChange={e => setQuery(e.target.value)}/><span>{visibleChats.length} {visibleChats.length === 1 ? 'story' : 'stories'}</span></div>
    {visibleChats.length ? <div className="chat-history-list">{visibleChats.map(chat => <Link key={chat.id} to="/chat/$characterId" params={{ characterId: chat.character_id }} className="chat-history-item"><div className="history-avatar"><Avatar name={chat.character!.name} src={chat.character!.avatar_url}/><span className="online-dot"/></div><div><div className="history-name"><h3>{chat.character!.name}</h3><span>{timeAgo(chat.updated_at)}</span></div><p>{chat.last_message.replace(/\*/g, '') || 'A new chapter is waiting for your first hello.'}</p><span className="history-category">{chat.character!.categories[0]} <i>·</i> {chat.character!.tagline}</span></div><ArrowRight size={18}/></Link>)}</div> : <EmptyState icon={query ? <Search size={27}/> : <MessageCircle size={29}/>} title={query ? 'No stories with that name.' : 'Your next chapter is unwritten.'} description={query ? 'Try a different name. A familiar soul is waiting.' : 'Every great connection starts with a little hello. Find a character that sparks your curiosity.'}><Link to="/" className="button button-primary">Discover your first connection <ArrowRight size={16}/></Link>{!profile && <Link to="/auth" className="text-link">Already have an account? Sign in to find your stories.</Link>}</EmptyState>}
    <section className="character-section chat-recommendations"><div className="section-heading"><div><h2><Sparkles size={20}/>A new hello, perhaps?</h2><p>A few souls you might like to get to know.</p></div><Link to="/" className="view-all">Explore all <ArrowRight size={16}/></Link></div><div className="fresh-grid">{characters.filter(c => !chats.some(chat => chat.character_id === c.id)).slice(0, 3).map(character => <CharacterCard key={character.id} character={character} compact/>)}</div></section>
  </div>
}

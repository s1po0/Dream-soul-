import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Coffee, Compass, Flame, Heart, Lightbulb, Search, SlidersHorizontal, Sparkles, Theater, WandSparkles, X } from 'lucide-react'
import { CharacterCard } from '../components/CharacterCard'
import { Avatar, Button, CharacterSkeleton, EmptyState, Modal } from '../components/ui'
import { useApp } from '../context/AppContext'
import { CATEGORIES } from '../lib/types'
import { cn, filterCharacters } from '../lib/utils'

const categoryIcons = { 'For you': Sparkles, Romance: Heart, Fantasy: WandSparkles, Anime: Flame, Friends: Coffee, Helper: Lightbulb, Roleplay: Theater }
type Sort = 'recommended' | 'popular' | 'newest' | 'rated'
export function Discover({ favoritesOnly = false }: { favoritesOnly?: boolean }) {
  const { characters, charactersLoading, favorites } = useApp()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('For you')
  const [sort, setSort] = useState<Sort>('recommended')
  const [collection, setCollection] = useState<'all' | 'trending' | 'new' | 'rated' | null>(null)
  const [howOpen, setHowOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const browseRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName)) { event.preventDefault(); searchRef.current?.focus() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])
  const filtered = useMemo(() => {
    const available = favoritesOnly ? characters.filter(c => favorites.includes(c.id)) : characters
    const result = filterCharacters(available, query, category)
    if (sort === 'newest' || collection === 'new') return result.sort((a, b) => b.created_at.localeCompare(a.created_at))
    if (sort === 'rated' || collection === 'rated') return result.sort((a, b) => b.rating - a.rating)
    return result.sort((a, b) => b.chat_count - a.chat_count)
  }, [characters, query, category, sort, collection, favoritesOnly, favorites])
  const isFiltered = Boolean(query || category !== 'For you' || sort !== 'recommended' || collection || favoritesOnly)
  const newest = [...characters].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3)
  const topRated = [...characters].sort((a, b) => b.rating - a.rating).slice(0, 3)
  const reset = () => { setQuery(''); setCategory('For you'); setSort('recommended'); setCollection(null) }
  const showCollection = (value: 'all' | 'trending' | 'new' | 'rated') => { setCollection(value); browseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

  return <div className="discover-page page-enter">
    {!favoritesOnly && <section className="discovery-hero" aria-label="Welcome to DreamSoul">
      <div className="hero-art" role="img" aria-label="An enchanted moonlit garden with cherry blossoms"/>
      <div className="hero-shade"/>
      <div className="hero-copy"><div className="hero-eyebrow"><span/><Sparkles size={12}/> BEYOND THE ORDINARY</div><h2>A little connection.<br/>A whole <span>new world.</span></h2><p>Meet a mind that gets you. A soul that surprises you.<br className="desktop-break"/> Your next favorite conversation starts here.</p><div className="hero-actions"><Button onClick={() => { browseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); searchRef.current?.focus({ preventScroll: true }) }}>Find your connection <ArrowUpRight size={17}/></Button><button className="hero-secondary" onClick={() => setHowOpen(true)}>How it works <ArrowRight size={15}/></button></div><div className="hero-social"><div className="avatar-stack"><Avatar name="Luna" src="/images/luna.webp"/><Avatar name="Akira" src="/images/akira.webp"/><Avatar name="Milo" src="/images/milo.webp"/><span>✧</span></div><span>Different souls. <strong>Endless stories.</strong></span></div></div>
      <div className="hero-floating"><span className="floating-sparkle">✧</span><span>Your imagination,<br/><strong>a little more alive.</strong></span></div>
      <div className="hero-character-pill"><Avatar name="Luna Evermore" src="/images/luna.webp"/><span><strong>It starts with a hello.</strong><small>See where the story takes you.</small></span><span className="online-dot"/></div>
      <span className="hero-bottom-star">✦</span>
    </section>}
    {favoritesOnly && <div className="page-intro"><div className="eyebrow"><Heart size={14}/> YOUR KIND OF PEOPLE</div><h2>A few souls worth keeping.</h2><p>Your favorite characters, always a conversation away.</p></div>}
    <section className="browse-section" ref={browseRef} aria-label="Browse characters">
      <div className="browse-heading"><h2>Find your kind of connection<span> ✧</span></h2><span>Big personalities. Better conversations.</span></div>
      <div className="search-sort-row"><div className="search-field"><Search size={20}/><input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search a name, a vibe, a whole new world…" aria-label="Search characters"/>{query ? <button onClick={() => setQuery('')} aria-label="Clear search"><X size={17}/></button> : <kbd>/</kbd>}</div><div className="sort-field"><SlidersHorizontal size={15}/><select aria-label="Sort characters" value={sort} onChange={e => setSort(e.target.value as Sort)}><option value="recommended">Recommended</option><option value="popular">Most popular</option><option value="newest">Newest first</option><option value="rated">Top rated</option></select><ChevronDown size={14}/></div></div>
      <div className="category-list" role="group" aria-label="Character categories">{['For you', ...CATEGORIES].map(name => { const Icon = categoryIcons[name as keyof typeof categoryIcons]; return <button key={name} className={cn('category-chip', category === name && 'category-chip-active')} aria-pressed={category === name} onClick={() => setCategory(name)}><Icon size={15}/>{name}</button> })}</div>
    </section>
    <section className="character-section" aria-labelledby="trending-title">
      <div className="section-heading"><div><h2 id="trending-title">{isFiltered ? <><Compass size={21}/>{favoritesOnly ? 'Your favorites' : collection === 'new' ? 'Fresh discoveries' : collection === 'rated' ? 'The most loved' : query ? 'Your discoveries' : category !== 'For you' ? `${category}, your way` : 'Explore every soul'}</> : <><span className="section-icon fire-icon"><Flame size={21}/></span>Trending now</>} {!isFiltered && <span className="tiny-label">THE CONVERSATION STARTERS</span>}</h2><p>{isFiltered ? `${filtered.length} ${filtered.length === 1 ? 'character' : 'characters'} to start something new with.` : 'A few favorites. A thousand ways to connect.'}</p></div>{!isFiltered ? <button className="view-all" onClick={() => showCollection('trending')}>View all <ArrowRight size={16}/></button> : !favoritesOnly && <button className="view-all" onClick={reset}>Reset filters <X size={14}/></button>}</div>
      {charactersLoading ? <div className="character-grid" aria-busy="true">{[1, 2, 3, 4].map(i => <CharacterSkeleton key={i}/>)}</div> : filtered.length ? <div className="character-grid">{(isFiltered ? filtered : filtered.slice(0, 4)).map((character, index) => <CharacterCard key={character.id} character={character} badge={!isFiltered && index < 2 ? 'trending' : undefined}/>)}</div> : <EmptyState icon={favoritesOnly ? <Heart size={28}/> : <Search size={28}/>} title={favoritesOnly ? 'Keep your favorites close.' : 'A different kind of soul?'} description={favoritesOnly ? 'Tap the heart on a character to save them here. Your next favorite is waiting in Discover.' : 'No characters match this search yet. Try another name or a different mood.'}>{favoritesOnly ? <Link to="/" className="button button-primary">Discover characters <ArrowRight size={16}/></Link> : <Button variant="secondary" onClick={reset}>Clear filters</Button>}</EmptyState>}
    </section>
    {!isFiltered && <>
      <section className="character-section fresh-section"><div className="section-heading"><div><h2><span className="section-icon"><Sparkles size={20}/></span>Fresh out of a daydream <span className="new-section-label">NEW</span></h2><p>New faces. Unwritten stories. Meet someone unexpected.</p></div><button className="view-all" onClick={() => showCollection('new')}>View all <ArrowRight size={16}/></button></div><div className="fresh-grid">{newest.map(character => <CharacterCard key={character.id} character={character} compact badge="new"/>)}</div></section>
      <section className="create-banner"><div className="create-banner-orb"><WandSparkles size={32}/><span>✦</span></div><div><span className="eyebrow">DREAM IT. CREATE IT.</span><h2>No one quite like your imagination.</h2><p>Give your ideas a personality. Create a character that’s entirely you.</p></div><Link to="/create" className="button button-secondary">Create your AI <PlusIcon/></Link><span className="banner-decoration">✧</span></section>
      <section className="character-section top-rated-section"><div className="section-heading"><div><h2><span className="section-icon heart-icon"><Heart size={20}/></span>A little more loved</h2><p>Top-rated souls with a way of making you stay.</p></div><button className="view-all" onClick={() => showCollection('rated')}>View all <ArrowRight size={16}/></button></div><div className="top-rated-grid">{topRated.map((character, i) => <Link to="/chat/$characterId" params={{ characterId: character.id }} key={character.id} className="ranked-card"><span className="rank-number">0{i + 1}</span><Avatar src={character.avatar_url} name={character.name}/><div><h3>{character.name}</h3><p>{character.tagline}</p><span>★ {character.rating.toFixed(1)} <i>·</i> {character.categories[0]}</span></div><ArrowUpRight size={18}/></Link>)}</div></section>
    </>}
    <Modal open={howOpen} onClose={() => setHowOpen(false)} title="Your next story, in three little steps"><div className="how-steps">{[{ number: '01', title: 'Find your kind of soul', text: 'Browse by mood, explore a category, or follow your curiosity. Each character has a personality all their own.' }, { number: '02', title: 'Say a little hello', text: 'Start a conversation. Write a story, talk about your day, or step into a different world together.' }, { number: '03', title: 'Make it your own', text: 'Save your favorites, keep your stories going, or create an AI character straight from your imagination.' }].map(step => <div key={step.number}><span>{step.number}</span><section><h3>{step.title}</h3><p>{step.text}</p></section></div>)}</div><p className="modal-note">DreamSoul is for adults 18+. Characters are fictional AI, not real people.</p><Button className="w-full" onClick={() => { setHowOpen(false); browseRef.current?.scrollIntoView({ behavior: 'smooth' }) }}>Find my first connection <Check size={16}/></Button></Modal>
  </div>
}
function PlusIcon() { return <ArrowUpRight size={17}/> }

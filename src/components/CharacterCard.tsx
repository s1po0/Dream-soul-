import { Link } from '@tanstack/react-router'
import { Heart, MessageCircle, ArrowUpRight, Star, Sparkles, Flame } from 'lucide-react'
import { useApp } from '../context/AppContext'
import type { Character } from '../lib/types'
import { cn, compactNumber } from '../lib/utils'

export function CharacterCard({ character, compact = false, badge }: { character: Character; compact?: boolean; badge?: 'trending' | 'new' }) {
  const { favorites, toggleFavorite } = useApp()
  const favorite = favorites.includes(character.id)
  return <article className={cn('character-card group', compact && 'character-card-compact')}>
    <div className="character-image-wrap">
      <Link to="/chat/$characterId" params={{ characterId: character.id }} className="character-image-link" aria-label={`Meet ${character.name}`}>
        <img src={character.avatar_url} alt={character.name} className="character-image" loading="lazy"/>
        <div className="character-image-shade"/>
        <div className="character-start">Start a conversation <ArrowUpRight size={16}/></div>
      </Link>
      {badge && <span className={cn('character-badge', badge === 'new' && 'badge-new')}>{badge === 'trending' ? <Flame size={11} fill="currentColor"/> : <Sparkles size={11}/>} {badge === 'trending' ? 'Trending' : 'New'}</span>}
      <button aria-label={favorite ? `Unfavorite ${character.name}` : `Favorite ${character.name}`} aria-pressed={favorite} className={cn('card-favorite', favorite && 'is-favorite')} onClick={() => void toggleFavorite(character.id)}><Heart size={16} fill={favorite ? 'currentColor' : 'none'}/></button>
      <span className="character-category">{character.categories[0]}</span>
    </div>
    <Link to="/chat/$characterId" params={{ characterId: character.id }} className="character-info">
      <div className="character-name-row"><h3>{character.name}</h3>{character.rating > 0 && <span className="character-rating"><Star size={11} fill="currentColor"/> {character.rating.toFixed(1)}</span>}</div>
      <p className="character-tagline">{character.tagline}</p>
      <div className="character-meta"><span><MessageCircle size={12}/>{compactNumber(character.chat_count)}</span><span className="character-creator">by @{character.creator_name}</span></div>
    </Link>
  </article>
}

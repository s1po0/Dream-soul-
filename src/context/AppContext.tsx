import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { SEED_CHARACTERS } from '../lib/characters'
import { supabase } from '../lib/supabase'
import type { Character, CharacterInput, Chat, Profile } from '../lib/types'
import { errorMessage, readLocal, writeLocal } from '../lib/utils'

interface AppContextValue {
  user: User | null
  profile: Profile | null
  authLoading: boolean
  characters: Character[]
  charactersLoading: boolean
  favorites: string[]
  blocked: string[]
  chats: Chat[]
  isDemo: boolean
  refreshCharacters: () => Promise<void>
  refreshChats: () => Promise<void>
  refreshProfile: () => Promise<void>
  startDemo: (username: string, avatar: string) => void
  signOut: () => Promise<void>
  saveProfile: (values: Partial<Profile>) => Promise<void>
  toggleFavorite: (id: string) => Promise<void>
  blockCharacter: (id: string) => Promise<void>
  unblockAll: () => Promise<void>
  saveCharacter: (values: CharacterInput, id?: string) => Promise<Character>
  deleteCharacter: (id: string) => Promise<void>
  updateLocalChats: (chat: Chat) => void
}
const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(() => readLocal<Profile | null>('demo-profile', null))
  const [authLoading, setAuthLoading] = useState(Boolean(supabase))
  const [remoteCharacters, setRemoteCharacters] = useState<Character[]>(SEED_CHARACTERS)
  const [localCharacters, setLocalCharacters] = useState<Character[]>(() => readLocal('characters', []))
  const [charactersLoading, setCharactersLoading] = useState(true)
  const [favorites, setFavorites] = useState<string[]>(() => readLocal('favorites', []))
  const [blocked, setBlocked] = useState<string[]>(() => readLocal('blocked', []))
  const [chats, setChats] = useState<Chat[]>(() => readLocal('chats', []))
  const isDemo = profile?.id === 'demo'

  const fetchProfile = useCallback(async (id: string) => {
    if (!supabase) return
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single()
    if (error) { toast.error('Could not load your profile. Please try signing in again.'); return }
    setProfile(data as Profile)
  }, [])
  const refreshProfile = useCallback(async () => { if (user) await fetchProfile(user.id) }, [user, fetchProfile])

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return }
    let active = true
    const timer = window.setTimeout(() => { if (active) setAuthLoading(false) }, 6000)
    const sync = async (next: User | null) => {
      if (!active) return
      setUser(next)
      if (next) await fetchProfile(next.id)
      else setProfile(readLocal<Profile | null>('demo-profile', null))
      if (active) setAuthLoading(false)
    }
    void supabase.auth.getSession().then(({ data }) => sync(data.session?.user ?? null)).catch(() => setAuthLoading(false))
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return
      queueMicrotask(() => void sync(session?.user ?? null))
    })
    return () => { active = false; window.clearTimeout(timer); data.subscription.unsubscribe() }
  }, [fetchProfile])

  const refreshCharacters = useCallback(async () => {
    if (!supabase) { setCharactersLoading(false); return }
    const skeletonTimer = window.setTimeout(() => setCharactersLoading(false), 500)
    try {
      const { data, error } = await supabase.from('characters').select('*').order('chat_count', { ascending: false }).abortSignal(AbortSignal.timeout(6000))
      if (!error && data) setRemoteCharacters(data as Character[])
    } catch { /* Curated offline previews stay available. Mutations never pretend to succeed offline. */ }
    finally { window.clearTimeout(skeletonTimer); setCharactersLoading(false) }
  }, [])
  useEffect(() => { void refreshCharacters() }, [refreshCharacters, user, profile?.nsfw_enabled])

  const refreshChats = useCallback(async () => {
    if (!supabase || !user) { setChats(readLocal('chats', [])); return }
    const { data, error } = await supabase.from('chats').select('*').eq('user_id', user.id).order('updated_at', { ascending: false })
    if (!error && data) setChats(data as Chat[])
  }, [user])
  useEffect(() => {
    void refreshChats()
    if (!supabase || !user) {
      setFavorites(readLocal('favorites', [])); setBlocked(readLocal('blocked', [])); return
    }
    void supabase.from('favorites').select('character_id').eq('user_id', user.id).then(({ data }) => setFavorites(data?.map(f => f.character_id) ?? []))
    void supabase.from('character_blocks').select('character_id').eq('user_id', user.id).then(({ data }) => setBlocked(data?.map(b => b.character_id) ?? []))
  }, [user, refreshChats])

  const characters = useMemo(() => [...(isDemo ? localCharacters : []), ...remoteCharacters]
    .filter(c => (c.visibility === 'public' || c.creator_id === profile?.id) && !blocked.includes(c.id) && (!c.is_nsfw || profile?.nsfw_enabled)), [localCharacters, remoteCharacters, blocked, profile?.id, profile?.nsfw_enabled, isDemo])

  const startDemo = (username: string, avatar: string) => {
    if (user) return
    const demo: Profile = { id: 'demo', username, avatar_url: avatar, adult_confirmed: true, nsfw_enabled: false, onboarding_completed: true }
    writeLocal('demo-profile', demo); setProfile(demo)
    toast.success('Your local world is ready. Nothing leaves this browser.')
  }
  const signOut = async () => {
    if (user && supabase) { const { error } = await supabase.auth.signOut(); if (error) throw error }
    writeLocal('demo-profile', null); setUser(null); setProfile(null)
    setChats(readLocal('chats', [])); setFavorites(readLocal('favorites', [])); setBlocked(readLocal('blocked', []))
    toast.success('You’re signed out. See you in another story.')
  }
  const saveProfile = async (values: Partial<Profile>) => {
    if (!profile && !user) throw new Error('Please sign in first.')
    const allowed = { ...values }; delete allowed.id
    if (user && supabase) {
      const { data, error } = await supabase.from('profiles').update(allowed).eq('id', user.id).select().single()
      if (error) throw error
      setProfile(data as Profile)
    } else if (profile) {
      const next = { ...profile, ...allowed }; setProfile(next); writeLocal('demo-profile', next)
    }
  }
  const toggleFavorite = async (id: string) => {
    const wasFavorite = favorites.includes(id)
    const next = wasFavorite ? favorites.filter(f => f !== id) : [...favorites, id]
    setFavorites(next)
    try {
      if (user && supabase) {
        const { error } = wasFavorite
          ? await supabase.from('favorites').delete().eq('user_id', user.id).eq('character_id', id)
          : await supabase.from('favorites').insert({ user_id: user.id, character_id: id })
        if (error) throw error
      } else writeLocal('favorites', next)
      toast.success(wasFavorite ? 'Removed from your favorites' : 'A new favorite. A new possibility.')
    } catch (error) { setFavorites(current => wasFavorite ? [...current, id] : current.filter(f => f !== id)); toast.error(errorMessage(error)) }
  }
  const blockCharacter = async (id: string) => {
    if (user && supabase) {
      const { error } = await supabase.from('character_blocks').insert({ user_id: user.id, character_id: id })
      if (error) throw error
    }
    const next = [...new Set([...blocked, id])]; setBlocked(next)
    if (!user) writeLocal('blocked', next)
    toast.success('Character blocked. You won’t see them in Discover.')
  }
  const unblockAll = async () => {
    if (user && supabase) {
      const { error } = await supabase.from('character_blocks').delete().eq('user_id', user.id)
      if (error) throw error
    }
    setBlocked([]); if (!user) writeLocal('blocked', [])
    toast.success('All characters unblocked')
  }
  const saveCharacter = async (values: CharacterInput, id?: string) => {
    if (!profile?.adult_confirmed) throw new Error('Complete your profile to create a character.')
    if (user && supabase) {
      const fields = { name: values.name, avatar_url: values.avatar_url, tagline: values.tagline, description: values.description, greeting: values.greeting, example_dialogue: values.example_dialogue, voice_style: values.voice_style, categories: values.categories, visibility: values.visibility, creator_id: user.id, creator_name: profile.username }
      if (fields.avatar_url.startsWith('data:')) throw new Error('Please upload your portrait again now that you’re signed in, so we can save it securely.')
      const result = id
        ? await supabase.from('characters').update(fields).eq('id', id).eq('creator_id', user.id).select().single()
        : await supabase.from('characters').insert(fields).select().single()
      if (result.error) throw result.error
      const character = result.data as Character
      setRemoteCharacters(current => [character, ...current.filter(c => c.id !== character.id)])
      return character
    }
    const previous = localCharacters.find(c => c.id === id)
    const character: Character = { ...previous, ...values, id: id ?? crypto.randomUUID(), creator_id: 'demo', creator_name: profile.username, is_nsfw: false, chat_count: previous?.chat_count ?? 0, rating: previous?.rating ?? 0, featured: false, created_at: previous?.created_at ?? new Date().toISOString() }
    const next = [character, ...localCharacters.filter(c => c.id !== character.id)]
    writeLocal('characters', next); setLocalCharacters(next)
    return character
  }
  const deleteCharacter = async (id: string) => {
    if (user && supabase) {
      const { error } = await supabase.from('characters').delete().eq('id', id).eq('creator_id', user.id)
      if (error) throw error
      setRemoteCharacters(current => current.filter(c => c.id !== id))
    } else {
      const next = localCharacters.filter(c => c.id !== id); writeLocal('characters', next); setLocalCharacters(next)
      const nextChats = chats.filter(c => c.character_id !== id); writeLocal('chats', nextChats); setChats(nextChats)
      try { localStorage.removeItem(`dreamsoul:messages:${id}`); localStorage.removeItem(`dreamsoul:draft:${id}`) } catch { /* Storage may be disabled. */ }
    }
    setFavorites(current => { const next = current.filter(f => f !== id); if (!user) writeLocal('favorites', next); return next })
    setChats(current => current.filter(c => c.character_id !== id))
  }
  const updateLocalChats = (chat: Chat) => {
    setChats(current => {
      const next = [chat, ...current.filter(c => c.id !== chat.id)]
      writeLocal('chats', next); return next
    })
  }

  return <AppContext.Provider value={{ user, profile, authLoading, characters, charactersLoading, favorites, blocked, chats, isDemo, refreshCharacters, refreshChats, refreshProfile, startDemo, signOut, saveProfile, toggleFavorite, blockCharacter, unblockAll, saveCharacter, deleteCharacter, updateLocalChats }}>{children}</AppContext.Provider>
}
export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}

export const CATEGORIES = ['Romance', 'Fantasy', 'Anime', 'Friends', 'Helper', 'Roleplay'] as const
export type Category = typeof CATEGORIES[number]
export interface Character {
  id: string
  creator_id: string | null
  creator_name: string
  name: string
  avatar_url: string
  tagline: string
  description: string
  greeting: string
  example_dialogue: string
  voice_style: string
  categories: Category[]
  visibility: 'public' | 'private'
  is_nsfw: boolean
  chat_count: number
  rating: number
  featured: boolean
  created_at: string
}
export interface Profile {
  id: string
  username: string
  avatar_url: string
  adult_confirmed: boolean
  nsfw_enabled: boolean
  onboarding_completed: boolean
}
export interface Message {
  id: string
  chat_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}
export interface Chat {
  id: string
  user_id: string
  character_id: string
  updated_at: string
  last_message: string
}
export interface CharacterInput {
  name: string
  avatar_url: string
  tagline: string
  description: string
  greeting: string
  example_dialogue: string
  voice_style: string
  categories: Category[]
  visibility: 'public' | 'private'
}

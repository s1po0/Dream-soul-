import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
export function compactNumber(value: number) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}
export function timeAgo(date: string) {
  const diff = Math.max(0, Date.now() - new Date(date).getTime())
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}
export function readLocal<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(`dreamsoul:${key}`) || 'null') ?? fallback } catch { return fallback }
}
export function writeLocal(key: string, value: unknown, required = false) {
  try { localStorage.setItem(`dreamsoul:${key}`, JSON.stringify(value)) } catch { if (required) throw new Error('Device storage is full or unavailable. Free some space before saving your offline world.') }
}
export function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  return 'Something went wrong. Please try again.'
}
export function filterCharacters<T extends { name: string; tagline: string; categories: readonly string[] }>(characters: T[], query: string, category: string) {
  const search = query.toLocaleLowerCase().trim()
  return characters.filter(character =>
    (category === 'For you' || character.categories.includes(category)) &&
    (!search || `${character.name} ${character.tagline} ${character.categories.join(' ')}`.toLocaleLowerCase().includes(search)),
  )
}

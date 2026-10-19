import { describe, expect, it } from 'vitest'
import { compactNumber, errorMessage, filterCharacters, cn } from './utils'
import { SEED_CHARACTERS } from './characters'

describe('Discover filtering', () => {
  it('finds a character by name regardless of casing and whitespace', () => { expect(filterCharacters(SEED_CHARACTERS, '  miLO ', 'For you').map(c => c.name)).toEqual(['Milo']) })
  it('combines a category with search rather than replacing it', () => { expect(filterCharacters(SEED_CHARACTERS, 'Luna', 'Fantasy')).toHaveLength(1); expect(filterCharacters(SEED_CHARACTERS, 'Luna', 'Anime')).toHaveLength(0) })
  it('searches taglines and categories', () => { expect(filterCharacters(SEED_CHARACTERS, 'comfort', 'For you')[0].name).toBe('Milo'); expect(filterCharacters(SEED_CHARACTERS, 'Helper', 'For you')[0].name).toBe('Milo') })
  it('never changes the source catalog', () => { const ids = SEED_CHARACTERS.map(c => c.id); filterCharacters(SEED_CHARACTERS, '', 'Romance'); expect(SEED_CHARACTERS.map(c => c.id)).toEqual(ids) })
})
describe('presentation helpers', () => {
  it('formats compact counts', () => { expect(compactNumber(128400)).toBe('128.4K'); expect(compactNumber(0)).toBe('0') })
  it('normalizes errors without leaking object serialization', () => { expect(errorMessage(new Error('Offline'))).toBe('Offline'); expect(errorMessage({ message: 'Try again' })).toBe('Try again'); expect(errorMessage(null)).toContain('Something went wrong') })
  it('merges Tailwind classes predictably', () => { expect(cn('p-4', false && 'hidden', 'p-2')).toBe('p-2') })
  it('ships only safe adult public preview characters', () => { for (const c of SEED_CHARACTERS) { expect(c.is_nsfw).toBe(false); expect(c.visibility).toBe('public'); expect(c.description.length).toBeGreaterThan(20); expect(c.categories.length).toBeGreaterThan(0) } })
})

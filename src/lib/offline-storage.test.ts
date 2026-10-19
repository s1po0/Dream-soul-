import { afterEach, describe, expect, it, vi } from 'vitest'
import { SEED_CHARACTERS } from './characters'
import { writeLocal } from './utils'
const db = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: db, supabaseKey: 'public-test', supabaseUrl: 'https://example.supabase.co' }))
import { loadConversation } from './chat'
afterEach(() => vi.unstubAllGlobals())

describe('offline persistence', () => {
  it('reads a separate local conversation without touching the cloud client', async () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value) })
    const character = SEED_CHARACTERS[0]
    writeLocal(`messages:${character.id}`, [{ id: 'demo', role: 'assistant', content: 'scripted history' }])
    writeLocal(`offline:messages:${character.id}`, [{ id: 'local', role: 'user', content: 'saved before inference' }])
    expect((await loadConversation(character, undefined, true)).messages[0].content).toBe('saved before inference')
    expect((await loadConversation(character)).messages[0].content).toBe('scripted history')
    expect(db.from).not.toHaveBeenCalled()
  })
  it('does not silently claim that required local data was saved when storage fails', () => {
    vi.stubGlobal('localStorage', { setItem: () => { throw new Error('Quota exceeded') } })
    expect(() => writeLocal('offline:messages:test', [], true)).toThrow('Device storage is full or unavailable')
    expect(() => writeLocal('optional-preview', [])).not.toThrow()
  })
})

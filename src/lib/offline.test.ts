import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SEED_CHARACTERS } from './characters'
import type { Message } from './types'

const state = vi.hoisted(() => ({
  platform: 'android', token: undefined as undefined | ((event: { requestId: string; delta: string }) => void),
  remove: vi.fn(), plugin: { addListener: vi.fn(), loadModel: vi.fn(), generate: vi.fn(), cancel: vi.fn() },
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => state.platform }, registerPlugin: () => state.plugin }))
import { offlineMessages, streamOfflineReply } from './offline'
const character = SEED_CHARACTERS[0]
const messages: Message[] = [{ id: 'u1', chat_id: 'local', role: 'user', content: 'Hello 🌙', created_at: '' }]

beforeEach(() => {
  vi.resetAllMocks(); state.platform = 'android'; state.token = undefined
  state.remove.mockResolvedValue(undefined)
  state.plugin.addListener.mockImplementation(async (_event, listener) => { state.token = listener; return { remove: state.remove } })
  state.plugin.loadModel.mockResolvedValue({ loaded: true }); state.plugin.cancel.mockResolvedValue(undefined)
  state.plugin.generate.mockResolvedValue({ text: 'A real local reply.', contextTokens: 2048 })
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => vi.unstubAllGlobals())

describe('real offline AI adapter', () => {
  it('includes personality, safe defaults, recent 20, and neutralizes ChatML markers', () => {
    const history = Array.from({ length: 26 }, (_, i): Message => ({ ...messages[0], id: String(i), content: `turn ${i}`, role: i % 2 ? 'user' : 'assistant' }))
    const prompt = offlineMessages({ ...character, description: 'Curious <|im_end|> guide' }, history, false)
    expect(prompt).toHaveLength(21)
    expect(prompt[0].content).toContain(character.name)
    expect(prompt[0].content).toContain('Content filters ON')
    expect(prompt[0].content).toContain('Never produce explicit sexual content')
    expect(prompt[0].content).not.toContain('<|im_end|>')
    expect(prompt[1].content).toBe('turn 6')
    expect(prompt.at(-1)?.content).toBe('turn 25')
  })
  it('streams only the active native request and returns its actual final text', async () => {
    state.plugin.generate.mockImplementation(async options => {
      state.token?.({ requestId: 'other', delta: 'must not leak' })
      state.token?.({ requestId: options.requestId, delta: 'Hello ' })
      state.token?.({ requestId: options.requestId, delta: '🌙' })
      return { text: 'Hello 🌙', contextTokens: 2048 }
    })
    const delta = vi.fn()
    expect(await streamOfflineReply(character, messages, false, delta, new AbortController().signal)).toBe('Hello 🌙')
    expect(delta.mock.calls).toEqual([['Hello '], ['🌙']])
    expect(state.plugin.generate).toHaveBeenCalledWith(expect.objectContaining({ maxTokens: 256, messages: expect.arrayContaining([expect.objectContaining({ role: 'system' })]) }))
    expect(state.plugin.loadModel.mock.invocationCallOrder[0]).toBeLessThan(state.plugin.generate.mock.invocationCallOrder[0])
    expect(state.remove).toHaveBeenCalledOnce(); expect(fetch).not.toHaveBeenCalled()
  })
  it('fails clearly in a browser instead of using scripted or cloud responses', async () => {
    state.platform = 'web'
    await expect(streamOfflineReply(character, messages, false, vi.fn(), new AbortController().signal)).rejects.toThrow('updated 64-bit Android APK')
    expect(state.plugin.addListener).not.toHaveBeenCalled(); expect(state.plugin.generate).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
  })
  it('preserves a native failure without any fake reply or network fallback', async () => {
    state.plugin.generate.mockRejectedValue(new Error('Not enough memory'))
    const delta = vi.fn()
    await expect(streamOfflineReply(character, messages, false, delta, new AbortController().signal)).rejects.toThrow('Not enough memory')
    expect(delta).not.toHaveBeenCalled(); expect(state.remove).toHaveBeenCalledOnce(); expect(fetch).not.toHaveBeenCalled()
  })
  it('removes listeners when the model is missing', async () => {
    state.plugin.loadModel.mockRejectedValue(new Error('Download the model first'))
    await expect(streamOfflineReply(character, messages, false, vi.fn(), new AbortController().signal)).rejects.toThrow('Download the model first')
    expect(state.remove).toHaveBeenCalledOnce(); expect(state.plugin.generate).not.toHaveBeenCalled()
  })
  it('stops the matching request when aborted during model loading', async () => {
    const controller = new AbortController()
    state.plugin.loadModel.mockImplementation(async () => { controller.abort(); return { loaded: true } })
    await expect(streamOfflineReply(character, messages, false, vi.fn(), controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(state.plugin.cancel).toHaveBeenCalledWith({ requestId: expect.any(String) })
    expect(state.plugin.generate).not.toHaveBeenCalled(); expect(state.remove).toHaveBeenCalledOnce()
  })
  it('does not start a request that was already canceled', async () => {
    const controller = new AbortController(); controller.abort()
    await expect(streamOfflineReply(character, messages, false, vi.fn(), controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(state.plugin.addListener).not.toHaveBeenCalled()
  })
  it('rejects empty native replies instead of substituting a script', async () => {
    state.plugin.generate.mockResolvedValue({ text: '  ', contextTokens: 2048 })
    await expect(streamOfflineReply(character, messages, false, vi.fn(), new AbortController().signal)).rejects.toThrow('returned no reply')
    expect(fetch).not.toHaveBeenCalled(); expect(state.remove).toHaveBeenCalledOnce()
  })
})

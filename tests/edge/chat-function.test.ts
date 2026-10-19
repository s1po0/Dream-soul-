import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Exercise the real Edge Function with isolated env/auth/DB/provider adapters.
// These are test-only keys. No provider, account or network access is used.
const source = readFileSync(new URL('../../supabase/functions/chat/index.ts', import.meta.url), 'utf8').replace(/^import[^\n]*\n/, '')
const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
const characterId = '489adec6-8fee-458c-af74-d22a97e34106'
const userMessage = { id: 'test-user-message', role: 'user', content: 'Hello' }
const savedReply = { id: 'test-reply', role: 'assistant', content: 'Hello 🌙' }

function setup(keys: Record<string, string> = {}) {
  const env: Record<string, string> = { SUPABASE_URL: 'https://test.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', ...keys }
  const rpc = vi.fn(async (name: string) => ({ data: name === 'begin_chat_turn' ? { chat_id: 'test-chat', request_id: 'test-request', user_message: userMessage } : savedReply, error: null }))
  const admin = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'test-user' } }, error: null })) }, rpc,
    from: (table: string) => ({
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: table === 'characters' ? { name: 'Akira', description: 'Kind and curious', greeting: 'Hello', voice_style: 'Warm' } : { nsfw_enabled: false }, error: null }),
      limit: vi.fn().mockResolvedValue({ data: [{ role: 'user', content: 'Hello' }], error: null }),
    }),
  }
  let handler: (request: Request) => Promise<Response> = async () => { throw new Error('Handler not registered') }
  new Function('Deno', 'createClient', javascript)({ env: { get: (name: string) => env[name] }, serve: (callback: typeof handler) => { handler = callback } }, () => admin)
  const fetchMock = vi.fn().mockImplementation(async () => {
    const bytes = new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello 🌙"}}]}\r\n\r\ndata: [DONE]\r\n\r\n')
    return new Response(new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3)); controller.close() } }))
  })
  vi.stubGlobal('fetch', fetchMock)
  const request = (mode = 'send') => handler(new Request('https://test.invalid/functions/v1/chat', { method: 'POST', headers: { Origin: 'https://localhost', Authorization: 'Bearer test-session', 'Content-Type': 'application/json' }, body: JSON.stringify({ character_id: characterId, content: 'Hello', mode }) }))
  return { request, fetchMock, rpc }
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('deployed chat configuration contract', () => {
  it('uses the existing secret name, trims it, and streams/saves Unicode safely', async () => {
    const { request, fetchMock, rpc } = setup({ 'Dream soul ': '  sk-test-only-alias  ' })
    const response = await request()
    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://localhost')
    const events = await response.text()
    expect(events).toContain('event: done')
    expect(events).toContain('Hello 🌙')
    expect(events).not.toContain('sk-test-only')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer sk-test-only-alias')
    expect(rpc).toHaveBeenCalledWith('finish_chat_turn', expect.objectContaining({ p_content: 'Hello 🌙', p_failed: false }))
  })
  it('prefers the standard key over the existing alias', async () => {
    const { request, fetchMock } = setup({ LLM_API_KEY: '  sk-test-canonical  ', 'Dream soul ': 'sk-test-alias' })
    await (await request()).text()
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer sk-test-canonical')
  })
  it('rejects missing keys before reserving a turn or contacting a provider', async () => {
    const { request, fetchMock, rpc } = setup()
    expect((await request()).status).toBe(503)
    expect(rpc).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('does not send an unknown-provider alias to OpenAI', async () => {
    const { request, fetchMock } = setup({ 'Dream soul ': 'gsk-test-only' })
    const response = await request()
    expect(response.status).toBe(503)
    expect((await response.json()).error).toContain('LLM_BASE_URL')
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('allows an explicitly configured compatible provider', async () => {
    const { request, fetchMock } = setup({ 'Dream soul ': 'test-compatible-key', LLM_BASE_URL: 'https://provider.invalid/v1/', LLM_MODEL: 'test-model' })
    await (await request()).text()
    expect(fetchMock.mock.calls[0][0]).toBe('https://provider.invalid/v1/chat/completions')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe('test-model')
  })
  it.each([401, 429])('gives actionable provider status %s without leaking its response or key', async status => {
    const { request, fetchMock, rpc } = setup({ 'Dream soul ': 'sk-test-alias' })
    fetchMock.mockResolvedValueOnce(new Response('private provider response sk-test-alias', { status }))
    const response = await request()
    expect(response.status).toBe(502)
    const error = (await response.json()).error
    expect(error).toContain(status === 401 ? 'rejected' : 'rate-limit')
    expect(error).not.toContain('sk-test-alias')
    expect(error).not.toContain('private provider response')
    expect(rpc).toHaveBeenCalledWith('finish_chat_turn', expect.objectContaining({ p_failed: true }))
  })
  it.each([402, 429])('separates provider billing/quota status %s from temporary rate limits', async status => {
    const { request, fetchMock, rpc } = setup({ LLM_API_KEY: 'sk-test-only' })
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'insufficient_quota', message: 'Current quota exceeded; check billing. Private key sk-test-only' } }), { status }))
    const response = await request()
    const payload = await response.json()
    expect(payload.code).toBe('AI_PROVIDER_QUOTA')
    expect(payload.provider_status).toBe(status)
    expect(payload.error).toContain('API credits')
    expect(JSON.stringify(payload)).not.toContain('sk-test-only')
    expect(JSON.stringify(payload)).not.toContain('Current quota exceeded')
    expect(rpc).toHaveBeenCalledWith('finish_chat_turn', expect.objectContaining({ p_failed: true }))
  })
  it('keeps the app 30/hour cap distinct from the provider account quota', async () => {
    const { request, fetchMock, rpc } = setup({ LLM_API_KEY: 'sk-test-only' })
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'RATE_LIMIT' } } as never)
    const response = await request()
    expect(response.status).toBe(429)
    expect((await response.json()).error).toContain('30 messages this hour')
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('still allows restart without a provider key', async () => {
    const { request, fetchMock } = setup()
    expect((await request('restart')).status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

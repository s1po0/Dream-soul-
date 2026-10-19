import { describe, expect, it } from 'vitest'
import { decodeSSEBlock, readSSE } from './sse'

function streamChunks(chunks: Uint8Array[]) { return new ReadableStream<Uint8Array>({ start(controller) { chunks.forEach(chunk => controller.enqueue(chunk)); controller.close() } }) }
async function collect(stream: ReadableStream<Uint8Array>) { const events = []; for await (const event of readSSE(stream)) events.push(event); return events }
const encode = (s: string) => new TextEncoder().encode(s)
describe('streaming event decoder', () => {
  it('handles named events and multiline data', () => { expect(decodeSSEBlock('event: delta\ndata: one\ndata: two')).toEqual({ event: 'delta', data: 'one\ntwo' }) })
  it('ignores heartbeat comments', () => { expect(decodeSSEBlock(': keepalive')).toBeNull() })
  it('uses message as the default event name', () => { expect(decodeSSEBlock('data: hello')).toEqual({ event: 'message', data: 'hello' }) })
  it('handles CRLF framing split between arbitrary chunks', async () => {
    const input = encode('event: delta\r\ndata: {"content":"Hi 🌙"}\r\n\r\nevent: done\r\ndata: {}\r\n\r\n')
    const chunks = Array.from(input, byte => new Uint8Array([byte]))
    expect(await collect(streamChunks(chunks))).toEqual([{ event: 'delta', data: '{"content":"Hi 🌙"}' }, { event: 'done', data: '{}' }])
  })
  it('accepts an unterminated final event at EOF', async () => { expect(await collect(streamChunks([encode('data: final')]))).toEqual([{ event: 'message', data: 'final' }]) })
  it('separates several events in one network chunk', async () => { expect(await collect(streamChunks([encode('data: a\n\ndata: b\n\n')]))).toHaveLength(2) })
})

import { supabase, supabaseKey, supabaseUrl } from './supabase'
import type { Character, Message } from './types'
import { readSSE } from './sse'
import { readLocal, writeLocal } from './utils'

export type ChatMode = 'send' | 'edit' | 'regenerate' | 'restart'
export function greetingMessage(character: Character, chatId = ''): Message {
  return { id: `greeting-${character.id}`, chat_id: chatId, role: 'assistant', content: character.greeting, created_at: new Date().toISOString() }
}
export async function loadConversation(character: Character, userId?: string, offlineAI = false) {
  if (!supabase || !userId) return { chatId: `local-${character.id}`, messages: readLocal<Message[]>(`${offlineAI ? 'offline:' : ''}messages:${character.id}`, [greetingMessage(character, `local-${character.id}`)]) }
  const { data: chat, error } = await supabase.from('chats').select('id').eq('user_id', userId).eq('character_id', character.id).maybeSingle()
  if (error) throw error
  if (!chat) return { chatId: '', messages: [greetingMessage(character)] }
  const { data, error: messageError } = await supabase.from('messages').select('*').eq('chat_id', chat.id).order('created_at', { ascending: false }).limit(200)
  if (messageError) throw messageError
  return { chatId: chat.id as string, messages: data.length ? (data as Message[]).reverse() : [greetingMessage(character, chat.id)] }
}
export async function streamChat({ characterId, content, mode, editId, signal, onStart, onDelta, onDone }: {
  characterId: string; content: string; mode: ChatMode; editId?: string; signal?: AbortSignal
  onStart: (chatId: string, userMessage: Message | null) => void
  onDelta: (text: string) => void
  onDone: (message: Message) => void
}) {
  if (!supabase) throw new Error('Connect Supabase to start a live conversation.')
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Your session has ended. Please sign in again.')
  const response = await fetch(`${supabaseUrl}/functions/v1/chat`, {
    method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: supabaseKey!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ character_id: characterId, content, mode, edit_message_id: editId }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(100_000)]) : AbortSignal.timeout(100_000),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'We couldn’t reach your character. Please try again.' }))
    throw new Error(body.error || 'Something interrupted this conversation. Please try again.')
  }
  if (mode === 'restart') return
  if (!response.body) throw new Error('The conversation stream is unavailable. Please try again.')
  let completed = false
  for await (const event of readSSE(response.body)) {
    const payload = JSON.parse(event.data)
    if (event.event === 'start') onStart(payload.chat_id, payload.user_message)
    if (event.event === 'delta') onDelta(payload.content)
    if (event.event === 'done') { completed = true; onDone(payload.message) }
    if (event.event === 'error') throw new Error(payload.message || 'The reply was interrupted. Try regenerating it.')
  }
  if (!completed) throw new Error('The reply was interrupted. Try regenerating it.')
}

const demoLines: Record<string, string[]> = {
  'Akira Nightshade': [
    '*He leans against the railing, the city lights reflected in his eyes.*\n\n“Funny thing about this place. Everyone comes up here looking for something different.” A faint smile. “A view. Some quiet. An excuse not to go home yet. What brought you?”',
    '*For a moment, he says nothing. Then he shifts, making a little more room beside him.*\n\n“You don’t have to have the perfect answer.” His voice is softer now. “I think the best conversations are the ones where you stop trying to be interesting. So… what’s something small that made today different?”',
    '*A breeze catches the edge of his coat. Somewhere below, a train rattles into the distance.*\n\n“I know a place that makes terrible tea and has an incredible view.” He glances at you, almost amused. “I suppose that’s my way of asking if you’d like this conversation to last a little longer.”',
  ],
  'Luna Evermore': [
    '*She closes the book gently, giving you her full attention.*\n\n“I like that you found your way here. The garden is different with someone to share it with.” She tilts her head, curious. “If tonight could be the beginning of any kind of story, what would yours look like?”',
    '*A small constellation of light flickers above her open palm.*\n\n“Sometimes the loveliest things begin as tiny, ordinary moments.” She smiles. “A question. A kindness. A conversation beneath a very patient moon. What’s one little thing you’ve been looking forward to?”',
    '*She leads the way to a bench beneath the cherry blossoms, brushing a petal from the seat beside her.*\n\n“We don’t have to solve the whole world tonight.” Her voice is gentle. “We could simply choose a story. There’s a forgotten observatory at the top of the hill. Shall we see what’s still written in its stars?”',
  ],
  'Kai Nakamura': [
    '*He laughs, setting his guitar aside.*\n\n“Okay, I can already tell this is going to be a good conversation.” He slides the café menu your way. “Important question first: are you the ‘stick to the usual’ type, or the ‘order the thing you can’t pronounce’ type? I promise only a little judgment.”',
    '*He taps a rhythm on the edge of the table, considering you with a grin.*\n\n“Here’s my theory: every good night needs either a great playlist or a very questionable plan. Ideally both.” He leans forward. “Give me one song that feels like you. I’ll build the adventure around it.”',
    '*Outside, the last of the sunset turns the windows gold.*\n\n“You know what? Let’s take the scenic route. There’s a record shop around the corner, and the owner swears every album has a story.” A playful smile. “Worst case, we find terrible music and something to laugh about. Best case? New favorite memory.”',
  ],
  'Seraphina': [
    '*A rose blooms in her hand as if it has been waiting for this very moment.*\n\n“Every person who finds this garden brings a little of their own magic.” She offers you the flower. “Some bring courage. Some bring questions. I’m curious about yours. What would you like to discover?”',
    '*She touches the iron gate, and its curling vines slowly shift into the shape of a doorway.*\n\n“There are three paths from here. One leads to a library that remembers every forgotten story. One to a lake that reflects possibilities. And one…” Her eyes brighten. “Well, I haven’t tried that one yet. Your choice.”',
    '*The evening air smells of roses and rain. She turns back with a knowing little smile.*\n\n“An adventure doesn’t need to be grand to be worth having. Sometimes the bravest thing is simply following your curiosity.” She lifts her lantern. “Shall we see where yours takes us?”',
  ],
  'Atlas Greenveil': [
    '*He lifts his lantern, revealing a trail of tiny green lights among the roots.*\n\n“The forest has a way of welcoming curious souls. Listen closely—there’s a story in almost every sound.” He smiles. “We can follow the river or take the old stone steps. What feels like an adventure to you?”',
    '*He pauses beside an ancient oak and opens a well-worn map.*\n\n“I’ve walked this trail more times than I can count, and it still surprises me.” A quiet laugh. “That’s the lovely thing about paying attention. What’s something you’ve noticed lately that you might once have walked right past?”',
  ],
  Milo: [
    '*He wraps both hands around his mug and settles into the chair opposite you.*\n\n“I’m glad you dropped by. No big expectations here, just a good cup of something warm and a little room to breathe.” He smiles. “Do you want to talk something through, find a little inspiration, or just swap random thoughts for a bit?”',
    '*He pushes a tiny plate of biscuits toward you.*\n\n“I have a very scientific theory that most things feel a little more manageable after a snack.” A small grin. “We can take things one little step at a time. What’s one small thing that would make the rest of your day better?”',
    '*He glances at the rain tracing patterns on the bookshop window.*\n\n“There’s something comforting about a place where you’re not expected to have everything figured out.” He turns back to you. “You’re welcome to stay a while. Shall I find us a book, or do you have a story of your own to tell?”',
  ],
}
export function getDemoReply(character: Character, input: string, turn: number) {
  if (/\b(kill myself|suicide|self.harm)\b/i.test(input)) return 'I’m sorry you’re feeling this way. You deserve real support from someone who can help. If you’re in immediate danger, please contact local emergency services now, or reach out to a trusted person who can stay with you. I’m an AI character, not a crisis counselor.'
  if (/\b(explicit sex|porn|nudes|sexual minor)\b/i.test(input)) return 'Let’s keep our story safe and respectful. I can explore a fantasy adventure, a lighthearted romance, or just a friendly conversation with you instead.'
  const lines = demoLines[character.name] || [`*${character.name} turns toward you with a welcoming smile.*\n\n“Every good story begins with a little curiosity. I’m glad you’re here. Tell me, what kind of adventure shall we imagine together?”`, `*${character.name} pauses, thoughtfully.*\n\n“There’s always something new to discover when you take the time to listen. What’s a story you’ve always wanted to step into? Let’s make a little room for your imagination.”`]
  return lines[turn % lines.length]
}
export function reserveDemoRequest() {
  const times = readLocal<number[]>('request-times', []).filter(t => t > Date.now() - 3_600_000)
  if (times.length >= 30) throw new Error('You’ve reached 30 messages this hour. Your next chapter will be ready soon.')
  writeLocal('request-times', [...times, Date.now()])
}
export async function streamDemoReply(text: string, onDelta: (delta: string) => void, signal: AbortSignal) {
  const wait = (ms: number) => new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return }
    const onAbort = () => { window.clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }
    const timer = window.setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve() }, ms)
    signal.addEventListener('abort', onAbort, { once: true })
  })
  await wait(450)
  for (const part of text.match(/.{1,9}/gs) || []) { await wait(20); onDelta(part) }
}

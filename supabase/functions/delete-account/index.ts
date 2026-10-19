import { createClient } from 'npm:@supabase/supabase-js@2.95.0'

Deno.serve(async request => {
  const origin = request.headers.get('Origin') || ''
  const origins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(s => s.trim()).filter(Boolean)
  const allowed = !origin || (origins.length ? origins.includes(origin) : /^https:\/\/[a-z\d-]+\.e2b\.app$/i.test(origin) || /^https?:\/\/localhost(?::\d+)?$/.test(origin))
  const headers = { 'Access-Control-Allow-Origin': allowed && origin ? origin : 'null', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin' }
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers })
  if (!allowed) return json({ error: 'This origin is not allowed.' }, 403)
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405)
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return json({ error: 'The account service isn’t configured.' }, 503)
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Please sign in.' }, 401)
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return json({ error: 'Your session has ended. Please sign in again.' }, 401)
  try {
    const raw = await request.text()
    if (raw.length > 1000) return json({ error: 'Invalid confirmation.' }, 400)
    const { confirmation } = JSON.parse(raw)
    const { data: profile, error: profileError } = await admin.from('profiles').select('username').eq('id', data.user.id).single()
    if (profileError || confirmation !== profile.username) return json({ error: 'Type your exact username to confirm account deletion.' }, 400)
    // Remove only this authenticated user’s avatar folder, in bounded batches.
    // A storage failure leaves the account intact so deletion can be retried.
    for (let batch = 0; batch < 100; batch++) {
      const { data: files, error: listError } = await admin.storage.from('avatars').list(data.user.id, { limit: 100 })
      if (listError) throw listError
      if (!files?.length) break
      const { error: removeError } = await admin.storage.from('avatars').remove(files.map(file => `${data.user.id}/${file.name}`))
      if (removeError) throw removeError
      if (batch === 99) return json({ error: 'Some uploads remain. Please retry deletion to finish removing them.' }, 409)
    }
    const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id)
    if (deleteError) throw deleteError
    return json({ success: true })
  } catch { return json({ error: 'We couldn’t finish deleting your account. Please try again.' }, 500) }
})

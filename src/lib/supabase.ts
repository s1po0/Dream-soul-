import { createClient } from '@supabase/supabase-js'
import { readLocal } from './utils'
import { projectConfig } from './project-config'

const url = import.meta.env.VITE_LOCAL_ONLY === 'true' ? '' : (import.meta.env.VITE_SUPABASE_URL || projectConfig.url)
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || projectConfig.publishableKey
function createCloudClient() {
  return url && key && !url.includes('your-project') ? createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    global: { fetch: (...args: Parameters<typeof fetch>) => {
      // Also guard an already-created SDK when the user switches modes mid-session.
      if (readLocal('offline-ai-enabled', false)) return Promise.reject(new TypeError('Cloud services are paused while Offline AI is on.'))
      return fetch(...args)
    } },
  }) : null
}
// autoRefreshToken:false alone is insufficient: the SDK can refresh an expired
// session while emitting INITIAL_SESSION. Do not construct it on offline boot.
export let supabase = readLocal('offline-ai-enabled', false) ? null : createCloudClient()
export function enableCloudClient() {
  if (readLocal('offline-ai-enabled', false)) return null
  return supabase ??= createCloudClient()
}
export const supabaseUrl: string | undefined = url
export const supabaseKey: string | undefined = key

export async function uploadAvatar(file: File, userId: string) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP image.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Your image must be smaller than 5 MB.')
  if (!supabase || userId === 'demo') {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Could not read this image.'))
      reader.readAsDataURL(file)
    })
  }
  const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) throw error
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

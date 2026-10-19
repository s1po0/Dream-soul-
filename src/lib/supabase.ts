import { createClient } from '@supabase/supabase-js'
import { projectConfig } from './project-config'

const url = import.meta.env.VITE_LOCAL_ONLY === 'true' ? '' : (import.meta.env.VITE_SUPABASE_URL || projectConfig.url)
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || projectConfig.publishableKey
export const supabase = url && key && !url.includes('your-project') ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
}) : null
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

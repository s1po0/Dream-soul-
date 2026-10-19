import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { toast } from 'sonner'
import { readLocal } from './utils'
import { supabase } from './supabase'

export const NATIVE_CALLBACK = 'com.dreamsoul.app://auth/callback'
export const isNativeApp = () => Capacitor.isNativePlatform()
export function authRedirect(path: '/onboarding' | '/reset-password' = '/onboarding') {
  return isNativeApp() ? `${NATIVE_CALLBACK}?next=${encodeURIComponent(path)}` : `${window.location.origin}${path}`
}
export async function openNativeOAuth(url: string) { await Browser.open({ url }) }

export async function initializeNativeApp(navigate: (path: '/onboarding' | '/reset-password') => void) {
  if (!isNativeApp()) return
  const callback = async (url: string) => {
    if (readLocal('offline-ai-enabled', false)) return
    const parsed = new URL(url)
    if (parsed.protocol !== 'com.dreamsoul.app:' || parsed.hostname !== 'auth' || parsed.pathname !== '/callback') return
    try {
      if (parsed.searchParams.has('error')) throw new Error(parsed.searchParams.get('error_description') || 'Sign-in could not be completed.')
      const code = parsed.searchParams.get('code')
      if (!code || !supabase) throw new Error('This sign-in link has expired. Please request a new one.')
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) throw error
      await Browser.close().catch(() => {})
      navigate(parsed.searchParams.get('next') === '/reset-password' ? '/reset-password' : '/onboarding')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Sign-in could not be completed.') }
  }
  await App.addListener('appUrlOpen', event => { void callback(event.url) })
  await App.addListener('backButton', event => {
    if (event.canGoBack) window.history.back()
    else void App.exitApp()
  })
  const launch = await App.getLaunchUrl()
  if (launch?.url) await callback(launch.url)
}

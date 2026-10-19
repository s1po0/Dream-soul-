import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.dreamsoul.app',
  appName: 'DreamSoul',
  webDir: 'dist',
  backgroundColor: '#0e0d14',
  server: { androidScheme: 'https', hostname: 'localhost' },
  android: { backgroundColor: '#0e0d14', allowMixedContent: false },
}
export default config

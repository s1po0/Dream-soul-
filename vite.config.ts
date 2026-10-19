import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: '0.0.0.0', allowedHosts: ['.e2b.app', 'localhost'], port: 5173 },
  preview: { host: '0.0.0.0', allowedHosts: ['.e2b.app', 'localhost'] },
  build: { chunkSizeWarningLimit: 650, rollupOptions: { output: { manualChunks: { react: ['react', 'react-dom'], supabase: ['@supabase/supabase-js'] } } } },
})

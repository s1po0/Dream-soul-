import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import '@fontsource-variable/dm-sans'
import { AppProvider } from './context/AppContext'
import { router } from './router'
import { initializeNativeApp, isNativeApp } from './lib/native'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><AppProvider><RouterProvider router={router}/></AppProvider></React.StrictMode>)
void initializeNativeApp(path => { void router.navigate({ to: path }) })
if (!isNativeApp() && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(() => {}) })
}

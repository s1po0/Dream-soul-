import { createRootRoute, createRoute, createRouter, Link } from '@tanstack/react-router'
import { Layout } from './components/Layout'
import { Discover } from './pages/Discover'
import { AuthPage, OnboardingPage, ResetPasswordPage } from './pages/Auth'
import { CreatePage } from './pages/Create'
import { ChatPage } from './pages/Chat'
import { ChatsPage } from './pages/Chats'
import { ProfilePage } from './pages/Profile'
import { OfflinePage } from './pages/Offline'
import { LegalPage } from './pages/Legal'
import { EmptyState } from './components/ui'

const rootRoute = createRootRoute({
  component: Layout,
  notFoundComponent: () => <EmptyState title="A little lost in the dream?" description="This page doesn’t exist, but your next connection does."><Link to="/" className="button button-primary">Back to your world →</Link></EmptyState>,
  errorComponent: ({ error, reset }) => <EmptyState title="A little interruption." description={error instanceof Error ? error.message : 'Something went wrong loading this page.'}><button className="button button-primary" onClick={reset}>Try again</button><a href="/" className="text-link">Back to Discover</a></EmptyState>,
})
const discoverRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Discover })
const favoritesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/favorites', component: () => <Discover favoritesOnly/> })
const offlineRoute = createRoute({ getParentRoute: () => rootRoute, path: '/offline', component: OfflinePage })
const authRoute = createRoute({ getParentRoute: () => rootRoute, path: '/auth', component: AuthPage })
const onboardingRoute = createRoute({ getParentRoute: () => rootRoute, path: '/onboarding', validateSearch: (search: Record<string, unknown>): { demo?: boolean } => ({ demo: (search.demo === true || search.demo === 'true' || search.demo === '1') || undefined }), component: () => { const { demo } = onboardingRoute.useSearch(); return <OnboardingPage demo={demo}/> } })
const resetRoute = createRoute({ getParentRoute: () => rootRoute, path: '/reset-password', component: ResetPasswordPage })
const createCharacterRoute = createRoute({ getParentRoute: () => rootRoute, path: '/create', component: CreatePage })
const editCharacterRoute = createRoute({ getParentRoute: () => rootRoute, path: '/characters/$characterId/edit', component: () => { const { characterId } = editCharacterRoute.useParams(); return <CreatePage characterId={characterId}/> } })
const chatRoute = createRoute({ getParentRoute: () => rootRoute, path: '/chat/$characterId', component: () => { const { characterId } = chatRoute.useParams(); return <ChatPage characterId={characterId}/> } })
const chatsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/chats', component: ChatsPage })
const profileRoute = createRoute({ getParentRoute: () => rootRoute, path: '/profile', component: ProfilePage })
const termsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/terms', component: () => <LegalPage/> })
const privacyRoute = createRoute({ getParentRoute: () => rootRoute, path: '/privacy', component: () => <LegalPage privacy/> })
const routeTree = rootRoute.addChildren([discoverRoute, favoritesRoute, offlineRoute, authRoute, onboardingRoute, resetRoute, createCharacterRoute, editCharacterRoute, chatRoute, chatsRoute, profileRoute, termsRoute, privacyRoute])
export const router = createRouter({ routeTree, defaultPreload: 'intent', scrollRestoration: true })
declare module '@tanstack/react-router' { interface Register { router: typeof router } }

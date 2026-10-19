import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { Cpu, Compass, MessageCircle, Plus, Heart, UserRound, ShieldCheck, ArrowUpRight, Menu, X, WandSparkles, ChevronRight, LifeBuoy, Bell, Check } from 'lucide-react'
import { Toaster } from 'sonner'
import { useApp } from '../context/AppContext'
import { Avatar, Button, Logo, Modal } from './ui'
import { cn } from '../lib/utils'

const mainLinks = [
  { to: '/' as const, label: 'Discover', icon: Compass },
  { to: '/chats' as const, label: 'My chats', icon: MessageCircle },
  { to: '/favorites' as const, label: 'Favorites', icon: Heart },
  { to: '/offline' as const, label: 'Offline AI', icon: Cpu },
]
export function Layout() {
  const { profile, chats, isDemo, offlineAI } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [safetyOpen, setSafetyOpen] = useState(false)
  const isChat = location.pathname.startsWith('/chat/')
  const pageTitle = location.pathname === '/' ? 'Discover' : location.pathname.startsWith('/chats') ? 'My chats' : location.pathname === '/favorites' ? 'Your favorites' : location.pathname.startsWith('/create') || location.pathname.includes('/edit') ? 'Create a character' : location.pathname === '/offline' ? 'Offline AI' : location.pathname === '/profile' ? 'Your little universe' : 'Welcome to DreamSoul'
  useEffect(() => { setMenuOpen(false); if (!isChat) window.scrollTo(0, 0) }, [location.pathname, isChat])

  return <div className={cn('app-layout', isChat && 'chat-layout')}>
    {menuOpen && <div className="sidebar-scrim" onClick={() => setMenuOpen(false)}/>}
    <aside className={cn('sidebar', menuOpen && 'sidebar-open')}>
      <Link to="/" className="brand-link" aria-label="DreamSoul home"><Logo/></Link>
      <button className="sidebar-close icon-button" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={21}/></button>
      <div className="sidebar-navigation">
        <p className="nav-label">YOUR WORLD</p>
        <nav className="nav-list" aria-label="Main navigation">{mainLinks.map(({ to, label, icon: Icon }) => <Link key={to} to={to} className={cn('nav-item', location.pathname === to && 'nav-item-active')}><Icon size={19}/><span>{label}</span>{to === '/chats' && chats.length > 0 && <span className="nav-count">{chats.length}</span>}</Link>)}</nav>
        <Link to="/create" className="sidebar-create"><span><Plus size={19}/></span> Create a character <ArrowUpRight size={15}/></Link>
        <div className="nav-divider"/>
        <p className="nav-label">YOUR SPACE</p>
        <nav className="nav-list" aria-label="Account navigation"><Link to="/profile" className={cn('nav-item', location.pathname === '/profile' && 'nav-item-active')}><UserRound size={19}/><span>My profile</span></Link><button className="nav-item" onClick={() => setHelpOpen(true)}><LifeBuoy size={19}/><span>Help & about</span></button></nav>
      </div>
      <div className="sidebar-bottom">
        <div className="imagination-card"><span className="imagination-icon"><WandSparkles size={20}/></span><h3>A world only you<br/>could dream of.</h3><p>Bring your imagination to life.</p><Link to="/create">Create your first AI <ArrowUpRight size={14}/></Link><span className="imagination-star">✧</span></div>
        <div className="sidebar-legal"><Link to="/terms">Terms</Link><span>·</span><Link to="/privacy">Privacy</Link><span className="age-badge">18+</span></div>
        <Link to={profile ? '/profile' : '/auth'} className="sidebar-account"><Avatar name={profile?.username || 'Dreamer'} src={profile?.avatar_url || '/images/luna.webp'}/><span><strong>{profile ? `@${profile.username}` : 'Your story awaits'}</strong><small>{profile ? (offlineAI ? 'Offline AI · On-device' : isDemo ? 'Local demo account' : 'Free dreamer') : 'Sign in to your world'}</small></span><ChevronRight size={16}/></Link>
      </div>
    </aside>
    <div className="main-shell">
      {!isChat && <header className="topbar">
        <div className="desktop-page-heading"><h1>{pageTitle}<span className="heading-dot">.</span></h1><p>{location.pathname === '/' ? 'A new connection is just a conversation away.' : 'A little imagination goes a long way.'}</p></div>
        <div className="mobile-brand"><button className="icon-button" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={21}/></button><Link to="/" aria-label="DreamSoul home"><Logo/></Link></div>
        <div className="topbar-actions"><Link to="/offline" className={cn("offline-entry", offlineAI && "offline-entry-active")} aria-label={offlineAI ? "Offline AI is on — settings" : "Offline AI setup"}><Cpu size={16}/><span>Offline AI</span>{offlineAI && <i/>}</Link><button aria-label="Safe space" className="safety-pill" onClick={() => setSafetyOpen(true)}><ShieldCheck size={14}/><span>Safe space</span><i/></button><span className="topbar-separator"/><button className="icon-button notification-button" aria-label="Notifications" onClick={() => setNotificationsOpen(true)}><Bell size={19}/><span className="notification-dot"/></button><button onClick={() => void navigate({ to: profile ? '/profile' : '/auth' })} className="header-user" aria-label={profile ? 'Open profile' : 'Sign in'}>{profile ? <Avatar src={profile.avatar_url} name={profile.username}/> : <><UserRound size={15}/><span>Sign in</span></>}</button></div>
      </header>}
      <main className={cn('page-main', isChat && 'page-main-chat')} key={isChat ? 'chat' : location.pathname}><Outlet/></main>
      {!isChat && <footer className="page-footer"><span><Logo small/> A little more human. A little more magic.</span><p>AI characters, endless possibilities. <span>Not real people.</span></p><span className="footer-copyright">© 2026 DreamSoul</span></footer>}
    </div>
    {!isChat && <nav className="bottom-nav" aria-label="Mobile navigation">
      <Link to="/" className={cn(location.pathname === '/' && 'active')}><Compass size={22}/><span>Discover</span></Link>
      <Link to="/chats" className={cn(location.pathname === '/chats' && 'active')}><MessageCircle size={22}/><span>Chats</span>{chats.length > 0 && <i/>}</Link>
      <Link to="/create" className={cn('bottom-create', location.pathname === '/create' && 'active')}><span className="bottom-create-icon"><Plus size={23}/></span><span>Create</span></Link>
      <Link to="/profile" className={cn(location.pathname === '/profile' && 'active')}><UserRound size={22}/><span>Profile</span></Link>
    </nav>}
    <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="A little help, a lot of possibility"><div className="modal-prose"><Logo/><p>DreamSoul is a space to explore stories, meet fictional AI characters, and create your own worlds.</p><h3>Make a connection</h3><p>Pick a character in Discover. Their personality shapes each conversation. You can edit your last message, regenerate a reply, or start fresh at any time.</p><h3>Your world, your boundaries</h3><p>Content filters are on by default. Use the menu in any chat to report or block a character. AI can make mistakes and isn’t a replacement for real-world relationships or professional advice.</p><h3>Real offline AI on Android</h3><p>Open Offline AI, download the lightweight model once, then generate replies on your phone without an API key. This mode is local only and doesn’t sync cloud accounts.</p><h3>Trying the local demo?</h3><p>Demo conversations use scripted responses, not an LLM. They stay in this browser. Sign in for a connected account and cross-device history.</p><Button onClick={() => setHelpOpen(false)}>Got it <Check size={16}/></Button></div></Modal>
    <Modal open={notificationsOpen} onClose={() => setNotificationsOpen(false)} title="A little note for you"><div className="notification-welcome"><span className="empty-icon"><WandSparkles size={26}/></span><h3>Welcome to your next chapter.</h3><p>Your world is ready to explore. Find a character that speaks to you, or dream up someone entirely new.</p><Button onClick={() => { setNotificationsOpen(false); void navigate({ to: '/' }) }}>Let’s explore <ArrowUpRight size={16}/></Button></div></Modal>
    <Modal open={safetyOpen} onClose={() => setSafetyOpen(false)} title="Your comfort comes first"><div className="modal-prose"><div className="safety-modal-icon"><ShieldCheck size={32}/></div><p>This is an 18+ community with content filters <strong>{profile?.nsfw_enabled ? 'customized in your settings' : 'on by default'}</strong>. You’re always in control of your conversations.</p><ul><li>Block any character to remove them from your world.</li><li>Report harmful or inappropriate behavior.</li><li>Restart a conversation whenever you need a fresh start.</li></ul><p className="muted">Characters are AI, not real people. Never share passwords, financial details, or other sensitive information.</p><Button onClick={() => setSafetyOpen(false)}>Sounds good <Check size={16}/></Button></div></Modal>
    <Toaster theme="dark" position="top-center" richColors closeButton toastOptions={{ className: 'dream-toast' }}/>
  </div>
}

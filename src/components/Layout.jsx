import {
  Bell,
  Bookmark,
  BookOpenText,
  ChevronDown,
  CircleHelp,
  FileText,
  Home,
  LogOut,
  Menu,
  MessageSquareText,
  Plus,
  Search,
  Settings,
  Tags,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatNumber } from '../api.js'
import { Link, useLocation, useNavigate } from '../router.jsx'
import { Avatar, Button, IconButton } from './Ui.jsx'

const primaryNavigation = [
  { to: '/', label: 'Community', icon: Home },
  { to: '/?kind=question', label: 'Questions', icon: CircleHelp },
  { to: '/?kind=discussion', label: 'Discussions', icon: MessageSquareText },
  { to: '/?kind=article', label: 'Blog', icon: FileText },
  { to: '/tags', label: 'Tags', icon: Tags },
]

function SidebarLink({ item, close, location }) {
  const Icon = item.icon
  const [targetPath, targetQuery = ''] = item.to.split('?')
  const current = new URLSearchParams(location.search)
  const expected = new URLSearchParams(targetQuery)
  const active = location.pathname === targetPath
    && [...expected.entries()].every(([key, value]) => current.get(key) === value)
    && (expected.size > 0 || !current.has('kind'))
  return (
    <Link to={item.to} onClick={close} className={active ? 'active' : ''}>
      <Icon size={18} />
      <span>{item.label}</span>
    </Link>
  )
}

export default function Layout({
  children,
  user,
  onOpenAuth,
  onLogout,
  tags,
  stats,
  notifications,
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    setMobileOpen(false)
    setUserOpen(false)
  }, [location.pathname, location.search])

  const submitSearch = (event) => {
    event.preventDefault()
    const clean = query.trim()
    navigate(clean ? `/?search=${encodeURIComponent(clean)}` : '/')
  }

  const unread = notifications.filter((item) => !item.readAt).length

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__inner">
          <IconButton
            label="Open navigation"
            icon={Menu}
            className="mobile-only"
            onClick={() => setMobileOpen(true)}
          />
          <Link to="/" className="brand" aria-label="Azora Dev home">
            <img src="/azora_logo.svg" alt="" />
            <span>Azora</span>
            <strong>Dev</strong>
          </Link>

          <form className="global-search" role="search" onSubmit={submitSearch}>
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search questions, articles, discussions"
              aria-label="Search community"
            />
            <kbd>/</kbd>
          </form>

          <nav className="topbar__actions" aria-label="Account">
            {user ? (
              <>
                <Link className="icon-button notification-button" to="/notifications" aria-label="Notifications">
                  <Bell size={18} />
                  {unread > 0 && <span>{Math.min(unread, 9)}</span>}
                </Link>
                <div className="user-menu">
                  <button className="user-menu__trigger" onClick={() => setUserOpen((open) => !open)}>
                    <Avatar user={user} size="sm" />
                    <span>{user.displayName}</span>
                    <ChevronDown size={15} />
                  </button>
                  {userOpen && (
                    <div className="user-menu__panel">
                      <Link to={`/u/${user.username}`}><Users size={16} />Profile</Link>
                      <Link to="/bookmarks"><Bookmark size={16} />Bookmarks</Link>
                      <Link to="/settings"><Settings size={16} />Settings</Link>
                      <button onClick={onLogout}><LogOut size={16} />Sign out</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Button variant="quiet" onClick={() => onOpenAuth('login')}>Sign in</Button>
                <Button onClick={() => onOpenAuth('register')}>Join</Button>
              </>
            )}
          </nav>
        </div>
      </header>

      {mobileOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__mobile-header">
          <span>Navigate</span>
          <IconButton label="Close navigation" icon={X} onClick={() => setMobileOpen(false)} />
        </div>
        <nav className="sidebar__nav" aria-label="Community">
          {primaryNavigation.map((item) => (
            <SidebarLink
              key={item.label}
              item={item}
              close={() => setMobileOpen(false)}
              location={location}
            />
          ))}
        </nav>
        <div className="sidebar__section">
          <span>Azora ecosystem</span>
          <a href="https://azoralang.org"><BookOpenText size={17} />Language</a>
          <a href="https://docs.azoralang.org"><FileText size={17} />Documentation</a>
          <a href="https://code.azoralang.org"><CircleHelp size={17} />Playground</a>
        </div>
        <div className="sidebar__compose">
          <Button
            icon={Plus}
            onClick={() => user ? navigate('/new') : onOpenAuth('login')}
          >
            Create post
          </Button>
        </div>
      </aside>

      <main className="main-content">{children}</main>

      <aside className="context-panel">
        <section>
          <h2>Community</h2>
          <div className="stats-grid">
            <span><strong>{formatNumber(stats.members ?? 0)}</strong>members</span>
            <span><strong>{formatNumber(stats.posts ?? 0)}</strong>posts</span>
            <span><strong>{formatNumber(stats.answers ?? 0)}</strong>answers</span>
            <span><strong>{formatNumber(stats.solved ?? 0)}</strong>solved</span>
          </div>
        </section>
        <section>
          <div className="section-heading">
            <h2>Popular tags</h2>
            <Link to="/tags">View all</Link>
          </div>
          <div className="context-tags">
            {tags.slice(0, 8).map((tag) => (
              <Link key={tag.slug} to={`/?tag=${tag.slug}`}>
                <span>{tag.name}</span>
                <strong>{tag.postCount}</strong>
              </Link>
            ))}
          </div>
        </section>
        <footer>
          <span>Azora Dev</span>
          <a href="https://azoralang.org">Language</a>
          <a href="https://azoralabs.org">Labs</a>
        </footer>
      </aside>
    </div>
  )
}

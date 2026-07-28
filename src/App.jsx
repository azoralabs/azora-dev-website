import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { api } from './api.js'
import Layout from './components/Layout.jsx'
import { LoadingState } from './components/Ui.jsx'
import { Navigate, Route, Routes } from './router.jsx'

const AuthModal = lazy(() => import('./pages/AuthModal.jsx'))
const BookmarksPage = lazy(() => import('./pages/BookmarksPage.jsx'))
const ComposePage = lazy(() => import('./pages/ComposePage.jsx'))
const FeedPage = lazy(() => import('./pages/FeedPage.jsx'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage.jsx'))
const PostPage = lazy(() => import('./pages/PostPage.jsx'))
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'))
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'))
const TagsPage = lazy(() => import('./pages/TagsPage.jsx'))

function ProtectedRoute({ user, ready, children }) {
  if (!ready) return null
  return user ? children : <Navigate to="/" replace />
}

export default function App() {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [authMode, setAuthMode] = useState('')
  const [tags, setTags] = useState([])
  const [stats, setStats] = useState({})
  const [notifications, setNotifications] = useState([])

  const refreshNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([])
      return
    }
    const data = await api('/notifications')
    setNotifications(data.notifications)
  }, [user])

  useEffect(() => {
    Promise.all([
      api('/auth/session').catch(() => ({ user: null })),
      api('/tags').catch(() => ({ tags: [] })),
      api('/stats').catch(() => ({})),
    ]).then(([session, tagData, statData]) => {
      setUser(session.user)
      setTags(tagData.tags)
      setStats(statData)
      setReady(true)
    })
  }, [])

  useEffect(() => {
    refreshNotifications().catch(() => {})
  }, [refreshNotifications])

  const authenticated = (nextUser) => {
    setUser(nextUser)
    setAuthMode('')
  }

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {})
    setUser(null)
    setNotifications([])
  }

  return (
    <>
      <Layout
        user={user}
        onOpenAuth={setAuthMode}
        onLogout={logout}
        tags={tags}
        stats={stats}
        notifications={notifications}
      >
        <Suspense fallback={<div className="page"><LoadingState /></div>}>
          <Routes>
            <Route path="/" element={<FeedPage user={user} onOpenAuth={setAuthMode} />} />
            <Route path="/p/:slug" element={<PostPage user={user} onOpenAuth={setAuthMode} />} />
            <Route path="/tags" element={<TagsPage tags={tags} />} />
            <Route path="/u/:username" element={<ProfilePage />} />
            <Route path="/new" element={<ComposePage user={user} onOpenAuth={setAuthMode} />} />
            <Route path="/notifications" element={(
              <ProtectedRoute user={user} ready={ready}>
                <NotificationsPage notifications={notifications} onRefresh={refreshNotifications} />
              </ProtectedRoute>
            )} />
            <Route path="/bookmarks" element={(
              <ProtectedRoute user={user} ready={ready}><BookmarksPage /></ProtectedRoute>
            )} />
            <Route path="/settings" element={(
              <ProtectedRoute user={user} ready={ready}>
                <SettingsPage user={user} onUserChange={setUser} />
              </ProtectedRoute>
            )} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </Layout>
      {authMode && (
        <Suspense fallback={null}>
          <AuthModal
            mode={authMode}
            onClose={() => setAuthMode('')}
            onAuthenticated={authenticated}
          />
        </Suspense>
      )}
    </>
  )
}

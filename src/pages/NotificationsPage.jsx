import { Bell, CheckCheck, MessageCircle } from 'lucide-react'
import { useEffect } from 'react'
import { api, timeAgo } from '../api.js'
import { Button, EmptyState } from '../components/Ui.jsx'
import { Link } from '../router.jsx'

export default function NotificationsPage({ notifications, onRefresh }) {
  useEffect(() => {
    if (!notifications.some((item) => !item.readAt)) return
    api('/notifications/read', { method: 'POST' }).then(onRefresh).catch(() => {})
  }, [notifications, onRefresh])

  return (
    <div className="page">
      <header className="page-header page-header--compact">
        <div>
          <span className="page-kicker">Inbox</span>
          <h1>Notifications</h1>
          <p>Answers, accepted solutions, mentions, and community activity.</p>
        </div>
        <Button variant="quiet" icon={CheckCheck} onClick={onRefresh}>Refresh</Button>
      </header>
      {notifications.length ? (
        <div className="notification-list">
          {notifications.map((item) => (
            <article key={item.id} className={item.readAt ? '' : 'unread'}>
              <span className="notification-icon"><MessageCircle size={17} /></span>
              <div>
                <p>{item.message}</p>
                <time dateTime={item.createdAt}>{timeAgo(item.createdAt)}</time>
              </div>
              {item.actorUsername && <Link to={`/u/${item.actorUsername}`}>View member</Link>}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon={Bell} title="All quiet">New replies and accepted answers will appear here.</EmptyState>
      )}
    </div>
  )
}

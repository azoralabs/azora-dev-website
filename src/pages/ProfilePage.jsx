import { CalendarDays, ExternalLink, MapPin, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../api.js'
import PostCard from '../components/PostCard.jsx'
import { Avatar, EmptyState, LoadingState, Notice } from '../components/Ui.jsx'
import { useParams } from '../router.jsx'

export default function ProfilePage() {
  const { username } = useParams()
  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api(`/users/${encodeURIComponent(username)}`)
      .then((data) => {
        if (!cancelled) {
          setProfile(data.user)
          setPosts(data.posts)
        }
      })
      .catch((requestError) => !cancelled && setError(requestError.message))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [username])

  if (loading) return <div className="page"><LoadingState label="Loading member profile" /></div>
  if (!profile) return <div className="page"><Notice tone="error">{error || 'Member not found.'}</Notice></div>

  return (
    <div className="page profile-page">
      <header className="profile-header">
        <Avatar user={profile} size="xl" />
        <div>
          <span className="page-kicker">{profile.role}</span>
          <h1>{profile.displayName}</h1>
          <p>@{profile.username}</p>
          {profile.bio && <div className="profile-bio">{profile.bio}</div>}
          <div className="profile-facts">
            <span><Trophy size={15} />{profile.reputation} reputation</span>
            <span><CalendarDays size={15} />Joined {new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
            {profile.location && <span><MapPin size={15} />{profile.location}</span>}
            {profile.website && (
              <a href={profile.website} rel="noreferrer" target="_blank">
                <ExternalLink size={15} />Website
              </a>
            )}
          </div>
        </div>
      </header>
      <section className="profile-posts">
        <h2>Recent posts</h2>
        {posts.length ? (
          <div className="post-list">{posts.map((post) => <PostCard key={post.id} post={post} />)}</div>
        ) : (
          <EmptyState icon={CalendarDays} title="No posts yet">This member has not published anything.</EmptyState>
        )}
      </section>
    </div>
  )
}

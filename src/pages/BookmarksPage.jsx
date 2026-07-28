import { Bookmark } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../api.js'
import PostCard from '../components/PostCard.jsx'
import { EmptyState, LoadingState, Notice } from '../components/Ui.jsx'

export default function BookmarksPage() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/me/bookmarks')
      .then((data) => setPosts(data.posts))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page">
      <header className="page-header page-header--compact">
        <div>
          <span className="page-kicker">Reading list</span>
          <h1>Bookmarks</h1>
          <p>Technical posts you saved for later.</p>
        </div>
      </header>
      {error && <Notice tone="error">{error}</Notice>}
      {loading ? <LoadingState /> : posts.length ? (
        <div className="post-list">{posts.map((post) => <PostCard key={post.id} post={post} />)}</div>
      ) : (
        <EmptyState icon={Bookmark} title="No bookmarks">Save a post and it will appear here.</EmptyState>
      )}
    </div>
  )
}

import {
  ArrowDownUp,
  CircleHelp,
  FileText,
  MessageSquareText,
  Plus,
  SearchX,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import PostCard from '../components/PostCard.jsx'
import { Button, EmptyState, LoadingState, Notice } from '../components/Ui.jsx'
import { useNavigate, useSearchParams } from '../router.jsx'

const kindTabs = [
  { value: '', label: 'All', icon: Sparkles },
  { value: 'question', label: 'Questions', icon: CircleHelp },
  { value: 'discussion', label: 'Discussions', icon: MessageSquareText },
  { value: 'article', label: 'Blog', icon: FileText },
]

const sortOptions = [
  { value: 'active', label: 'Active' },
  { value: 'newest', label: 'Newest' },
  { value: 'top', label: 'Top' },
  { value: 'unanswered', label: 'Unanswered' },
]

export default function FeedPage({ user, onOpenAuth }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const navigate = useNavigate()

  const kind = searchParams.get('kind') ?? ''
  const sort = searchParams.get('sort') ?? 'active'
  const search = searchParams.get('search') ?? ''
  const tag = searchParams.get('tag') ?? ''
  const page = Number(searchParams.get('page') ?? 1)

  const queryKey = useMemo(
    () => new URLSearchParams({ kind, sort, search, tag, page: String(page) }).toString(),
    [kind, sort, search, tag, page],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    api(`/posts?${queryKey}`)
      .then((data) => {
        if (cancelled) return
        setPosts(data.posts)
        setHasMore(data.hasMore)
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [queryKey])

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    setSearchParams(next)
  }

  const title = search
    ? `Results for "${search}"`
    : tag
      ? `Posts tagged ${tag}`
      : kind
        ? kindTabs.find((item) => item.value === kind)?.label ?? 'Community'
        : 'Community'

  return (
    <div className="page feed-page">
      <header className="page-header">
        <div>
          <span className="page-kicker">Azora community</span>
          <h1>{title}</h1>
          <p>Engineering questions, design discussions, and field notes from people building with Azora.</p>
        </div>
        <Button
          icon={Plus}
          onClick={() => user ? navigate('/new') : onOpenAuth('login')}
        >
          Create post
        </Button>
      </header>

      <div className="feed-toolbar">
        <div className="segmented" aria-label="Post type">
          {kindTabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.value}
                className={kind === tab.value ? 'active' : ''}
                onClick={() => updateParam('kind', tab.value)}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            )
          })}
        </div>
        <label className="sort-control">
          <ArrowDownUp size={15} />
          <select value={sort} onChange={(event) => updateParam('sort', event.target.value)}>
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {loading ? (
        <LoadingState label="Loading community posts" />
      ) : posts.length ? (
        <>
          <div className="post-list">
            {posts.map((post) => <PostCard key={post.id} post={post} />)}
          </div>
          {(page > 1 || hasMore) && (
            <nav className="pagination" aria-label="Pagination">
              <Button
                variant="quiet"
                disabled={page <= 1}
                onClick={() => updateParam('page', String(page - 1))}
              >
                Previous
              </Button>
              <span>Page {page}</span>
              <Button
                variant="quiet"
                disabled={!hasMore}
                onClick={() => updateParam('page', String(page + 1))}
              >
                Next
              </Button>
            </nav>
          )}
        </>
      ) : (
        <EmptyState
          icon={SearchX}
          title="No posts found"
          action={(
            <Button
              icon={Plus}
              onClick={() => user ? navigate('/new') : onOpenAuth('register')}
            >
              Start the conversation
            </Button>
          )}
        >
          Adjust the filter or publish the first post in this area.
        </EmptyState>
      )}
    </div>
  )
}

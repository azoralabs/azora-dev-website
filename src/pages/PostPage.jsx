import {
  ArrowBigDown,
  ArrowBigUp,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Flag,
  MessageCircle,
  Send,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api, timeAgo } from '../api.js'
import { KindBadge } from '../components/PostCard.jsx'
import {
  Avatar,
  Button,
  EmptyState,
  IconButton,
  LoadingState,
  Modal,
  Notice,
} from '../components/Ui.jsx'
import { Link, useParams } from '../router.jsx'

function VoteControl({ score, viewerVote, onVote, label }) {
  return (
    <div className="vote-control" aria-label={label}>
      <IconButton
        label="Vote up"
        icon={ArrowBigUp}
        className={viewerVote === 1 ? 'active' : ''}
        onClick={() => onVote(viewerVote === 1 ? 0 : 1)}
      />
      <strong>{score}</strong>
      <IconButton
        label="Vote down"
        icon={ArrowBigDown}
        className={viewerVote === -1 ? 'active' : ''}
        onClick={() => onVote(viewerVote === -1 ? 0 : -1)}
      />
    </div>
  )
}

function ReportModal({ post, onClose }) {
  const [reason, setReason] = useState('spam')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      const result = await api(`/posts/${post.id}/report`, {
        method: 'POST',
        body: { reason, details },
      })
      setMessage(result.message)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Report post" onClose={onClose}>
      {message ? (
        <Notice>{message}</Notice>
      ) : (
        <form className="stack-form" onSubmit={submit}>
          <label>
            <span>Reason</span>
            <select value={reason} onChange={(event) => setReason(event.target.value)}>
              <option value="spam">Spam</option>
              <option value="harassment">Harassment</option>
              <option value="unsafe">Unsafe content</option>
              <option value="off_topic">Off topic</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            <span>Details</span>
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={4}
              maxLength={500}
              placeholder="Optional context for moderators"
            />
          </label>
          <Button type="submit" icon={Flag} busy={busy}>Send report</Button>
        </form>
      )}
    </Modal>
  )
}

export default function PostPage({ user, onOpenAuth }) {
  const { slug } = useParams()
  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reportOpen, setReportOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api(`/posts/${encodeURIComponent(slug)}`)
      setPost(data.post)
      setComments(data.comments)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { load() }, [load])

  const requireAccount = () => {
    if (user) return true
    onOpenAuth('login')
    return false
  }

  const votePost = async (value) => {
    if (!requireAccount()) return
    const previous = post.viewerVote
    setPost((current) => ({
      ...current,
      viewerVote: value,
      score: current.score + value - previous,
    }))
    try {
      await api(`/posts/${post.id}/vote`, { method: 'POST', body: { value } })
    } catch (requestError) {
      setPost((current) => ({
        ...current,
        viewerVote: previous,
        score: current.score + previous - value,
      }))
      setError(requestError.message)
    }
  }

  const voteComment = async (comment, value) => {
    if (!requireAccount()) return
    setComments((items) => items.map((item) => item.id === comment.id ? {
      ...item,
      score: item.score + value - item.viewerVote,
      viewerVote: value,
    } : item))
    try {
      await api(`/comments/${comment.id}/vote`, { method: 'POST', body: { value } })
    } catch (requestError) {
      setError(requestError.message)
      load()
    }
  }

  const toggleBookmark = async () => {
    if (!requireAccount()) return
    try {
      const result = await api(`/posts/${post.id}/bookmark`, { method: 'POST' })
      setPost((current) => ({ ...current, bookmarked: result.bookmarked }))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const submitAnswer = async (event) => {
    event.preventDefault()
    if (!requireAccount()) return
    setBusy(true)
    setError('')
    try {
      await api(`/posts/${post.id}/comments`, {
        method: 'POST',
        body: { body: answer },
      })
      setAnswer('')
      await load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  const accept = async (commentId) => {
    try {
      await api(`/posts/${post.id}/accept/${commentId}`, { method: 'POST' })
      await load()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  if (loading) return <div className="page"><LoadingState label="Loading post" /></div>
  if (!post) {
    return (
      <div className="page">
        <EmptyState icon={MessageCircle} title="Post unavailable">{error || 'This post could not be found.'}</EmptyState>
      </div>
    )
  }

  const canAccept = user
    && post.kind === 'question'
    && (user.id === post.author.id || ['moderator', 'admin'].includes(user.role))

  return (
    <div className="page post-page">
      <Link to="/" className="back-link"><ArrowLeft size={16} />Back to community</Link>
      {error && <Notice tone="error">{error}</Notice>}
      <article className="post-detail">
        <aside>
          <VoteControl
            score={post.score}
            viewerVote={post.viewerVote}
            onVote={votePost}
            label="Post score"
          />
          <IconButton
            label={post.bookmarked ? 'Remove bookmark' : 'Bookmark post'}
            icon={post.bookmarked ? BookmarkCheck : Bookmark}
            className={post.bookmarked ? 'active' : ''}
            onClick={toggleBookmark}
          />
        </aside>
        <div className="post-detail__main">
          <div className="post-detail__meta">
            <KindBadge kind={post.kind} />
            {post.status === 'solved' && <span className="solved-label"><CheckCircle2 size={14} />Solved</span>}
            <span>{post.viewCount} views</span>
          </div>
          <h1>{post.title}</h1>
          <div className="post-author">
            <Link to={`/u/${post.author.username}`}><Avatar user={post.author} /></Link>
            <div>
              <Link to={`/u/${post.author.username}`}>{post.author.displayName}</Link>
              <span>@{post.author.username} · {timeAgo(post.createdAt)}</span>
            </div>
          </div>
          <div className="markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.body}</ReactMarkdown>
          </div>
          <footer className="post-detail__footer">
            <div className="tag-row">
              {post.tags.map((tag) => <Link key={tag.slug} to={`/?tag=${tag.slug}`} className="tag">{tag.name}</Link>)}
            </div>
            <button onClick={() => requireAccount() && setReportOpen(true)}><Flag size={14} />Report</button>
          </footer>
        </div>
      </article>

      <section className="answers-section">
        <header>
          <h2>{comments.length} {comments.length === 1 ? 'response' : 'responses'}</h2>
          {post.kind === 'question' && <span>Clear, reproducible answers help the next developer too.</span>}
        </header>
        <div className="answer-list">
          {comments.map((comment) => (
            <article key={comment.id} className={`answer ${comment.accepted ? 'answer--accepted' : ''}`}>
              <aside>
                <VoteControl
                  score={comment.score}
                  viewerVote={comment.viewerVote}
                  onVote={(value) => voteComment(comment, value)}
                  label="Answer score"
                />
                {comment.accepted && <CheckCircle2 className="accepted-mark" size={22} />}
              </aside>
              <div className="answer__main">
                {comment.accepted && <span className="accepted-label">Accepted solution</span>}
                <div className="markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.body}</ReactMarkdown>
                </div>
                <footer>
                  {canAccept && !comment.accepted && (
                    <Button variant="quiet" icon={CheckCircle2} onClick={() => accept(comment.id)}>
                      Accept solution
                    </Button>
                  )}
                  <Link to={`/u/${comment.author.username}`} className="author-link">
                    <Avatar user={comment.author} size="sm" />
                    <span>{comment.author.displayName}</span>
                    <strong>{comment.author.reputation}</strong>
                  </Link>
                  <time dateTime={comment.createdAt}>{timeAgo(comment.createdAt)}</time>
                </footer>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="answer-editor">
        <h2>{post.kind === 'question' ? 'Write an answer' : 'Join the conversation'}</h2>
        {user ? (
          <form onSubmit={submitAnswer}>
            <textarea
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              required
              minLength={2}
              maxLength={12_000}
              rows={8}
              placeholder="Markdown is supported. Explain the reasoning, not only the result."
            />
            <Button type="submit" icon={Send} busy={busy}>Publish response</Button>
          </form>
        ) : (
          <Notice>
            <button className="text-button" onClick={() => onOpenAuth('login')}>Sign in</button>
            {' '}to answer or join this discussion.
          </Notice>
        )}
      </section>
      {reportOpen && <ReportModal post={post} onClose={() => setReportOpen(false)} />}
    </div>
  )
}

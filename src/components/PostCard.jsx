import {
  CheckCircle2,
  Eye,
  FileText,
  MessageCircle,
  MessagesSquare,
  Vote,
} from 'lucide-react'
import { formatNumber, timeAgo } from '../api.js'
import { Link } from '../router.jsx'
import { Avatar } from './Ui.jsx'

const kindMeta = {
  question: { label: 'Question', icon: MessageCircle },
  discussion: { label: 'Discussion', icon: MessagesSquare },
  article: { label: 'Article', icon: FileText },
}

export function KindBadge({ kind }) {
  const meta = kindMeta[kind] ?? kindMeta.discussion
  const Icon = meta.icon
  return (
    <span className={`kind-badge kind-badge--${kind}`}>
      <Icon size={13} />
      {meta.label}
    </span>
  )
}

export default function PostCard({ post }) {
  return (
    <article className="post-card">
      <div className="post-card__metrics" aria-label="Post metrics">
        <span><Vote size={15} />{formatNumber(post.score)}</span>
        <span><MessageCircle size={15} />{formatNumber(post.commentCount)}</span>
        <span><Eye size={15} />{formatNumber(post.viewCount)}</span>
      </div>

      <div className="post-card__content">
        <div className="post-card__eyebrow">
          <KindBadge kind={post.kind} />
          {post.status === 'solved' && (
            <span className="solved-label"><CheckCircle2 size={14} />Solved</span>
          )}
        </div>
        <h2>
          <Link to={`/p/${post.slug}`}>{post.title}</Link>
        </h2>
        <p>{post.excerpt}</p>
        <div className="tag-row">
          {post.tags.map((tag) => (
            <Link key={tag.slug} to={`/?tag=${encodeURIComponent(tag.slug)}`} className="tag">
              {tag.name}
            </Link>
          ))}
        </div>
        <footer className="post-card__footer">
          <Link to={`/u/${post.author.username}`} className="author-link">
            <Avatar user={post.author} size="sm" />
            <span>{post.author.displayName}</span>
            <strong>{post.author.reputation}</strong>
          </Link>
          <time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time>
        </footer>
      </div>
    </article>
  )
}

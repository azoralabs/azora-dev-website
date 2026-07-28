import { ArrowLeft, Eye, FileText, MessageCircle, MessagesSquare, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '../api.js'
import { Button, Notice } from '../components/Ui.jsx'
import { Link, useNavigate } from '../router.jsx'

const kinds = [
  {
    value: 'question',
    label: 'Question',
    description: 'Ask for a focused solution.',
    icon: MessageCircle,
  },
  {
    value: 'discussion',
    label: 'Discussion',
    description: 'Explore design and tradeoffs.',
    icon: MessagesSquare,
  },
  {
    value: 'article',
    label: 'Blog article',
    description: 'Share a durable technical write-up.',
    icon: FileText,
  },
]

export default function ComposePage({ user, onOpenAuth }) {
  const [form, setForm] = useState({ kind: 'question', title: '', body: '', tags: '' })
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const tags = useMemo(
    () => form.tags.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 5),
    [form.tags],
  )

  const update = (key) => (event) => setForm((current) => ({
    ...current,
    [key]: event.target.value,
  }))

  const submit = async (event) => {
    event.preventDefault()
    if (!user) return onOpenAuth('login')
    setBusy(true)
    setError('')
    try {
      const data = await api('/posts', {
        method: 'POST',
        body: { ...form, tags },
      })
      navigate(`/p/${data.slug}`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page compose-page">
      <Link to="/" className="back-link"><ArrowLeft size={16} />Back to community</Link>
      <header className="page-header page-header--compact">
        <div>
          <span className="page-kicker">Publish</span>
          <h1>Create a post</h1>
          <p>Give readers enough context to reproduce the problem or understand the idea.</p>
        </div>
      </header>

      {error && <Notice tone="error">{error}</Notice>}

      <form className="compose-form" onSubmit={submit}>
        <fieldset className="kind-picker">
          <legend>Post type</legend>
          {kinds.map((kind) => {
            const Icon = kind.icon
            return (
              <label key={kind.value} className={form.kind === kind.value ? 'active' : ''}>
                <input
                  type="radio"
                  name="kind"
                  value={kind.value}
                  checked={form.kind === kind.value}
                  onChange={update('kind')}
                />
                <Icon size={19} />
                <span><strong>{kind.label}</strong><small>{kind.description}</small></span>
              </label>
            )
          })}
        </fieldset>

        <label>
          <span>Title</span>
          <input
            value={form.title}
            onChange={update('title')}
            required
            minLength={8}
            maxLength={160}
            placeholder="What should another developer understand at a glance?"
          />
          <small>{form.title.length}/160</small>
        </label>

        <div className="editor">
          <div className="editor__toolbar">
            <span>Content</span>
            <button type="button" onClick={() => setPreview((visible) => !visible)}>
              <Eye size={15} />
              {preview ? 'Edit' : 'Preview'}
            </button>
          </div>
          {preview ? (
            <div className="markdown markdown--editor">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {form.body || '*Nothing to preview yet.*'}
              </ReactMarkdown>
            </div>
          ) : (
            <textarea
              value={form.body}
              onChange={update('body')}
              required
              minLength={30}
              maxLength={40_000}
              rows={16}
              placeholder="Include context, expected behavior, what you tried, and a minimal example. Markdown is supported."
            />
          )}
        </div>

        <label>
          <span>Tags</span>
          <input
            value={form.tags}
            onChange={update('tags')}
            placeholder="llvm, stdlib, help"
          />
          <small>Up to five, separated by commas.</small>
        </label>

        <div className="compose-actions">
          <Button type="button" variant="quiet" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" icon={Send} busy={busy}>Publish</Button>
        </div>
      </form>
    </div>
  )
}

import { Hash, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState } from '../components/Ui.jsx'
import { Link } from '../router.jsx'

export default function TagsPage({ tags }) {
  const [query, setQuery] = useState('')
  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return normalized
      ? tags.filter((tag) => `${tag.name} ${tag.description}`.toLowerCase().includes(normalized))
      : tags
  }, [query, tags])

  return (
    <div className="page tags-page">
      <header className="page-header">
        <div>
          <span className="page-kicker">Browse knowledge</span>
          <h1>Tags</h1>
          <p>Follow compiler areas, backends, libraries, tools, and engineering topics.</p>
        </div>
      </header>
      <label className="page-search">
        <Search size={17} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter tags" />
      </label>
      {visible.length ? (
        <div className="tag-grid">
          {visible.map((tag) => (
            <Link key={tag.slug} to={`/?tag=${tag.slug}`} className="tag-card">
              <div><Hash size={16} /><strong>{tag.name}</strong></div>
              <p>{tag.description || `Community posts about ${tag.name}.`}</p>
              <span>{tag.postCount} {tag.postCount === 1 ? 'post' : 'posts'}</span>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon={Hash} title="No matching tags">Try a broader search.</EmptyState>
      )}
    </div>
  )
}

import { Compass } from 'lucide-react'
import { EmptyState } from '../components/Ui.jsx'
import { Link } from '../router.jsx'

export default function NotFoundPage() {
  return (
    <div className="page">
      <EmptyState
        icon={Compass}
        title="Page not found"
        action={<Link className="button button--primary" to="/">Return home</Link>}
      >
        The address may have changed or the page is no longer available.
      </EmptyState>
    </div>
  )
}

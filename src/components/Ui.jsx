import { LoaderCircle, X } from 'lucide-react'

export function Avatar({ user, size = 'md' }) {
  const initials = (user?.displayName ?? user?.username ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
  return (
    <span className={`avatar avatar--${size}`} aria-hidden="true">
      {initials}
    </span>
  )
}

export function Button({
  children,
  variant = 'primary',
  icon: Icon,
  busy = false,
  className = '',
  ...props
}) {
  return (
    <button
      className={`button button--${variant} ${className}`}
      disabled={busy || props.disabled}
      {...props}
    >
      {busy ? <LoaderCircle className="spin" size={16} /> : Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  )
}

export function IconButton({ label, icon: Icon, className = '', ...props }) {
  return (
    <button className={`icon-button ${className}`} aria-label={label} title={label} {...props}>
      <Icon size={18} />
    </button>
  )
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="empty-state">
      <Icon size={30} strokeWidth={1.5} />
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  )
}

export function LoadingState({ label = 'Loading' }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={20} />
      <span>{label}</span>
    </div>
  )
}

export function Notice({ tone = 'info', children }) {
  return <div className={`notice notice--${tone}`}>{children}</div>
}

export function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <h2>{title}</h2>
          <IconButton label="Close" icon={X} onClick={onClose} />
        </header>
        {children}
      </section>
    </div>
  )
}

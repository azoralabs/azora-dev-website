import { Eye, EyeOff, KeyRound, LogIn, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { api } from '../api.js'
import { Button, Modal, Notice } from '../components/Ui.jsx'

export default function AuthModal({ mode: initialMode, onClose, onAuthenticated }) {
  const [mode, setMode] = useState(initialMode)
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    email: '',
    username: '',
    displayName: '',
    password: '',
  })

  const update = (key) => (event) => setForm((current) => ({
    ...current,
    [key]: event.target.value,
  }))

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await api(`/auth/${mode}`, {
        method: 'POST',
        body: mode === 'register'
          ? form
          : { email: form.email, password: form.password },
      })
      onAuthenticated(data.user)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  const switchMode = () => {
    setMode((current) => current === 'login' ? 'register' : 'login')
    setError('')
  }

  return (
    <Modal title={mode === 'login' ? 'Sign in to Azora Dev' : 'Create your account'} onClose={onClose}>
      <form className="auth-form" onSubmit={submit}>
        {error && <Notice tone="error">{error}</Notice>}
        {mode === 'register' && (
          <div className="form-grid form-grid--two">
            <label>
              <span>Display name</span>
              <input
                value={form.displayName}
                onChange={update('displayName')}
                autoComplete="name"
                required
                minLength={2}
                maxLength={60}
              />
            </label>
            <label>
              <span>Username</span>
              <input
                value={form.username}
                onChange={update('username')}
                autoComplete="username"
                required
                minLength={3}
                maxLength={30}
                pattern="[A-Za-z0-9_-]+"
              />
            </label>
          </div>
        )}
        <label>
          <span>Email</span>
          <input
            type="email"
            value={form.email}
            onChange={update('email')}
            autoComplete="email"
            required
          />
        </label>
        <label>
          <span>Password</span>
          <div className="password-field">
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={update('password')}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'register' ? 10 : 1}
              maxLength={128}
            />
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {mode === 'register' && <small>Use at least 10 characters.</small>}
        </label>
        <Button
          type="submit"
          icon={mode === 'login' ? LogIn : UserPlus}
          busy={busy}
        >
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </Button>
      </form>
      <div className="auth-switch">
        <KeyRound size={17} />
        <span>
          {mode === 'login' ? 'New to Azora Dev?' : 'Already have an account?'}
        </span>
        <button onClick={switchMode}>
          {mode === 'login' ? 'Create one' : 'Sign in'}
        </button>
      </div>
    </Modal>
  )
}

import { KeyRound, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { Button, Notice } from '../components/Ui.jsx'

export default function SettingsPage({ user, onUserChange }) {
  const [profile, setProfile] = useState({
    displayName: user.displayName,
    bio: user.bio ?? '',
    location: user.location ?? '',
    website: user.website ?? '',
  })
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '' })
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setProfile({
      displayName: user.displayName,
      bio: user.bio ?? '',
      location: user.location ?? '',
      website: user.website ?? '',
    })
  }, [user])

  const update = (setter, key) => (event) => setter((current) => ({
    ...current,
    [key]: event.target.value,
  }))

  const saveProfile = async (event) => {
    event.preventDefault()
    setBusy('profile')
    setError('')
    setMessage('')
    try {
      const result = await api('/auth/profile', { method: 'PATCH', body: profile })
      onUserChange(result.user)
      setMessage('Profile updated.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy('')
    }
  }

  const changePassword = async (event) => {
    event.preventDefault()
    setBusy('password')
    setError('')
    setMessage('')
    try {
      await api('/auth/change-password', { method: 'POST', body: password })
      setPassword({ currentPassword: '', newPassword: '' })
      setMessage('Password changed. Your other sessions were signed out.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="page settings-page">
      <header className="page-header page-header--compact">
        <div>
          <span className="page-kicker">Account</span>
          <h1>Settings</h1>
          <p>Update your public profile and account security.</p>
        </div>
      </header>
      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}
      <section className="settings-section">
        <h2>Profile</h2>
        <form className="stack-form" onSubmit={saveProfile}>
          <label><span>Display name</span><input value={profile.displayName} onChange={update(setProfile, 'displayName')} required /></label>
          <label><span>Bio</span><textarea value={profile.bio} onChange={update(setProfile, 'bio')} maxLength={280} rows={4} /></label>
          <div className="form-grid form-grid--two">
            <label><span>Location</span><input value={profile.location} onChange={update(setProfile, 'location')} maxLength={80} /></label>
            <label><span>Website</span><input type="url" value={profile.website} onChange={update(setProfile, 'website')} maxLength={200} /></label>
          </div>
          <Button type="submit" icon={Save} busy={busy === 'profile'}>Save profile</Button>
        </form>
      </section>
      <section className="settings-section">
        <h2>Password</h2>
        <form className="stack-form" onSubmit={changePassword}>
          <label><span>Current password</span><input type="password" value={password.currentPassword} onChange={update(setPassword, 'currentPassword')} required /></label>
          <label><span>New password</span><input type="password" value={password.newPassword} onChange={update(setPassword, 'newPassword')} minLength={10} required /></label>
          <Button type="submit" icon={KeyRound} busy={busy === 'password'}>Change password</Button>
        </form>
      </section>
    </div>
  )
}

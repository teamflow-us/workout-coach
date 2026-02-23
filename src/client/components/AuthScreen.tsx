import { useState, useEffect } from 'react'
import { signUp, signIn, requestPasswordReset, updateUserPassword } from '../lib/authApi'

type AuthView = 'sign-in' | 'sign-up' | 'forgot-password' | 'check-email' | 'reset-password'

interface AuthScreenProps {
  recoveryToken: string | null
  onLoginSuccess: (accessToken: string, refreshToken: string, expiresIn: number) => void
}

export default function AuthScreen({ recoveryToken, onLoginSuccess }: AuthScreenProps) {
  const [view, setView] = useState<AuthView>(recoveryToken ? 'reset-password' : 'sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (recoveryToken) setView('reset-password')
  }, [recoveryToken])

  const clearForm = () => {
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setError('')
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await signIn(email, password)
      if (data.access_token && data.refresh_token && data.expires_in) {
        onLoginSuccess(data.access_token, data.refresh_token, data.expires_in)
      } else {
        setError(data.error_description || data.msg || data.error || 'Sign in failed')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const data = await signUp(email, password)
      if (data.error || data.msg) {
        setError(data.error_description || data.msg || data.error || 'Sign up failed')
        return
      }
      // Auto-confirm: try signing in immediately
      const loginData = await signIn(email, password)
      if (loginData.access_token && loginData.refresh_token && loginData.expires_in) {
        onLoginSuccess(loginData.access_token, loginData.refresh_token, loginData.expires_in)
      } else {
        // Account created but can't auto-sign-in (email confirmation might be required)
        setError('')
        setView('sign-in')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await requestPasswordReset(email)
      if (data.error || data.msg) {
        // Don't reveal whether the email exists — always show check-email
      }
      setView('check-email')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (!recoveryToken) {
      setError('Invalid recovery link')
      return
    }

    setLoading(true)
    try {
      const data = await updateUserPassword(recoveryToken, password)
      if (data.error) {
        setError(data.error_description || data.error || 'Password reset failed')
      } else {
        // Success — go to sign in
        clearForm()
        setView('sign-in')
        setError('')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-branding">
          <div className="auth-icon">
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 24h6v16H8V24Z" fill="currentColor" opacity="0.7" />
              <path d="M50 24h6v16h-6V24Z" fill="currentColor" opacity="0.7" />
              <path d="M14 20h4v24h-4V20Z" fill="currentColor" />
              <path d="M46 20h4v24h-4V20Z" fill="currentColor" />
              <rect x="18" y="29" width="28" height="6" rx="2" fill="currentColor" />
              <circle cx="32" cy="14" r="3" fill="currentColor" opacity="0.35" />
              <circle cx="32" cy="50" r="3" fill="currentColor" opacity="0.35" />
              <path d="M28 10l4 6 4-6" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.35" />
              <path d="M28 54l4-6 4 6" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.35" />
            </svg>
          </div>
          <h1 className="auth-title">Gymini</h1>
          <p className="auth-subtitle">Your AI Personal Trainer</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {view === 'sign-in' && (
          <form onSubmit={handleSignIn} className="auth-form">
            <input
              type="email"
              className="auth-input"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
            <input
              type="password"
              className="auth-input"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button type="submit" className="btn-primary auth-submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <div className="auth-links">
              <button type="button" className="auth-link" onClick={() => { clearForm(); setView('sign-up') }}>
                Create an account
              </button>
              <button type="button" className="auth-link" onClick={() => { clearForm(); setView('forgot-password') }}>
                Forgot password?
              </button>
            </div>
          </form>
        )}

        {view === 'sign-up' && (
          <form onSubmit={handleSignUp} className="auth-form">
            <input
              type="email"
              className="auth-input"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
            <input
              type="password"
              className="auth-input"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
            <input
              type="password"
              className="auth-input"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <button type="submit" className="btn-primary auth-submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Sign Up'}
            </button>
            <div className="auth-links">
              <button type="button" className="auth-link" onClick={() => { clearForm(); setView('sign-in') }}>
                Already have an account? Sign in
              </button>
            </div>
          </form>
        )}

        {view === 'forgot-password' && (
          <form onSubmit={handleForgotPassword} className="auth-form">
            <p className="auth-description">
              Enter your email and we'll send you a link to reset your password.
            </p>
            <input
              type="email"
              className="auth-input"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
            <button type="submit" className="btn-primary auth-submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <div className="auth-links">
              <button type="button" className="auth-link" onClick={() => { clearForm(); setView('sign-in') }}>
                Back to sign in
              </button>
            </div>
          </form>
        )}

        {view === 'check-email' && (
          <div className="auth-form">
            <div className="auth-check-email">
              <div className="auth-check-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
                  <path d="M2 7l10 6 10-6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </div>
              <h3>Check your email</h3>
              <p>We sent a password reset link to <strong>{email}</strong>. Click the link in the email to reset your password.</p>
            </div>
            <div className="auth-links">
              <button type="button" className="auth-link" onClick={() => { clearForm(); setView('sign-in') }}>
                Back to sign in
              </button>
            </div>
          </div>
        )}

        {view === 'reset-password' && (
          <form onSubmit={handleResetPassword} className="auth-form">
            <p className="auth-description">
              Enter your new password below.
            </p>
            <input
              type="password"
              className="auth-input"
              placeholder="New password (min 6 characters)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              autoFocus
            />
            <input
              type="password"
              className="auth-input"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <button type="submit" className="btn-primary auth-submit" disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

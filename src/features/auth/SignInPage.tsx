import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { friendlyError, supabase } from '../../lib/supabase';
import { useAuth } from './AuthProvider';
import { Logo } from '../../ui/Logo';

export function SignInPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from ?? '/';
  if (session) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(friendlyError(error));
    else navigate(from, { replace: true });
  }

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <Logo size="lg" />
        <p className="auth-sub">Shuttle and Tours · Records</p>
      </div>
      <form className="auth-card card" onSubmit={onSubmit} noValidate>
        <h1>Sign in</h1>
        {!supabase ? (
          <p className="alert alert-warn" role="status">
            This app isn't connected to its database yet. Once the Supabase project is set up, sign-in will work here.
          </p>
        ) : null}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn btn-primary btn-block" disabled={!supabase || busy || !email || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="muted small">Forgot your password? Ask the developer to reset it.</p>
      </form>
    </div>
  );
}

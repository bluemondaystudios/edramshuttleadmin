import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './AuthProvider';
import { requireSupabase } from '../../lib/supabase';
import { Logo } from '../../ui/Logo';
import { signOut } from './signOut';

function Splash() {
  return (
    <div className="splash" role="status" aria-live="polite">
      <Logo size="lg" />
      <span className="visually-hidden">Loading…</span>
    </div>
  );
}

/** Only signed-in team members get past this point. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, session } = useAuth();
  const location = useLocation();
  const userId = session?.user.id;

  const membership = useQuery({
    queryKey: ['is_team_member', userId],
    enabled: !!userId,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc('is_team_member');
      if (error) throw error;
      return data === true;
    },
  });

  if (!ready) return <Splash />;
  if (!session) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  if (membership.isPending) return <Splash />;

  if (membership.data === false) {
    return (
      <div className="auth-page">
        <div className="auth-card card">
          <h1>Account not set up yet</h1>
          <p className="muted">
            You're signed in as <strong>{session.user.email}</strong>, but this account hasn't been given access to the
            records. Ask the developer to add it to the team.
          </p>
          <button type="button" className="btn btn-secondary btn-block" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // If the membership check itself failed (e.g. offline), carry on: RLS still protects the data
  // and each screen shows its own error.
  return <>{children}</>;
}

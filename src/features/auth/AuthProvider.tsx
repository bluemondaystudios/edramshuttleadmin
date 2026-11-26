import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

interface AuthState {
  /** False until the saved session has been read from this device. */
  ready: boolean;
  session: Session | null;
}

const AuthContext = createContext<AuthState>({ ready: false, session: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ ready: !supabase, session: null });

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ ready: true, session: data.session });
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ ready: true, session });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import type { AuthedUser } from '../types';

export function useAuth() {
  const [user, setUser] = useState<AuthedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAuth = useCallback(async () => {
    setLoading(true);
    try {
      const me = await api.auth.me();
      setUser({
        id: me.id,
        google_id: '',
        email: me.email,
        display_name: me.display_name,
        avatar_url: me.avatar_url,
      });
      setError(null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // ignore
    }
    setUser(null);
    window.location.href = '/login';
  }, []);

  return { user, loading, error, logout, checkAuth };
}

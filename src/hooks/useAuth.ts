import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { AuthedUser } from '../types';

export function useAuth() {
  const [user, setUser] = useState<AuthedUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string, email: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    setUser({
      id: userId,
      google_id: '',
      email,
      display_name: profile?.display_name || email,
      avatar_url: profile?.avatar_url || '',
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      if (session?.user) {
        await loadProfile(session.user.id, session.user.email || '');
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (session?.user) {
          await loadProfile(session.user.id, session.user.email || '');
        } else {
          setUser(null);
        }
        setLoading(false);
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      throw new Error(
        error.message.includes('provider') || error.message.includes('not enabled')
          ? 'Google sign-in is not enabled. Use email/password sign-in below.'
          : error.message
      );
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.toLowerCase().includes('invalid login credentials')) {
        throw new Error('Invalid email or password. If you just signed up, please try signing in again.');
      }
      throw error;
    }
    if (data.user) {
      await loadProfile(data.user.id, data.user.email || '');
    }
  }, [loadProfile]);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    // If session is null, the user was created but needs confirmation
    // (our trigger auto-confirms, so this shouldn't happen, but handle it)
    if (data.user && !data.session) {
      // Try to sign in immediately since auto-confirm should have worked
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        throw new Error('Account created but could not sign in automatically. Please try signing in.');
      }
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return { user, loading, logout, signInWithGoogle, signInWithEmail, signUpWithEmail };
}

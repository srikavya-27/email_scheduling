import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useToast } from './hooks/useToast';
import { api } from './services/api';
import type { SenderConfig } from './types';
import { Toast } from './components/Toast';
import { Header } from './components/Header';
import { Loading } from './components/States';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ComposePage } from './pages/ComposePage';
import { ScheduledPage } from './pages/ScheduledPage';
import { SentPage } from './pages/SentPage';
import { SettingsPage } from './pages/SettingsPage';

function App() {
  const { user, loading, logout, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const { toast, show } = useToast();
  const [page, setPage] = useState('dashboard');
  const [senders, setSenders] = useState<SenderConfig[]>([]);

  useEffect(() => {
    if (user) {
      api.dashboard.senders().then(setSenders).catch(() => {});
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading message="Loading..." />
      </div>
    );
  }

  if (!user) {
    return <LoginPage onGoogleLogin={signInWithGoogle} onEmailSignIn={signInWithEmail} onEmailSignUp={signUpWithEmail} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} currentPage={page} onNavigate={setPage} onLogout={logout} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {page === 'dashboard' && <DashboardPage onNavigate={setPage} />}
        {page === 'compose' && <ComposePage senders={senders} onToast={show} />}
        {page === 'scheduled' && <ScheduledPage />}
        {page === 'sent' && <SentPage />}
        {page === 'settings' && <SettingsPage onToast={show} />}
      </main>
      <Toast toast={toast} />
    </div>
  );
}

export default App;

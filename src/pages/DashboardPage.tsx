import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { DashboardStats } from '../types';
import { Loading, ErrorState } from '../components/States';
import { Mail, Send, Clock, CheckCircle, XCircle, TrendingUp, Inbox } from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (page: string) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.dashboard.stats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <Loading message="Loading dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!stats) return null;

  const cards = [
    { label: 'Total Campaigns', value: stats.totalCampaigns, icon: Inbox, color: 'blue' },
    { label: 'Total Emails', value: stats.totalEmails, icon: Mail, color: 'gray' },
    { label: 'Sent', value: stats.sentCount, icon: Send, color: 'emerald' },
    { label: 'Failed', value: stats.failedCount, icon: XCircle, color: 'red' },
    { label: 'Scheduled', value: stats.scheduledCount, icon: Clock, color: 'amber' },
    { label: 'In Progress', value: stats.inProgressCount, icon: TrendingUp, color: 'purple' },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    gray: 'bg-gray-50 text-gray-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of your email outreach campaigns</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colorMap[card.color]}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-500 mt-1">{card.label}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Success Rate</h2>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            <span className="text-2xl font-bold text-gray-900">{stats.successRate}%</span>
          </div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div
            className="bg-emerald-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${stats.successRate}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Based on {stats.sentCount + stats.failedCount} completed deliveries
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => onNavigate('compose')}
          className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Compose New Email
        </button>
        <button
          onClick={() => onNavigate('scheduled')}
          className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          View Scheduled
        </button>
        <button
          onClick={() => onNavigate('sent')}
          className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          View Sent
        </button>
      </div>
    </div>
  );
}

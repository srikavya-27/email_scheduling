import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { SlackStatus, SenderConfig } from '../types';
import { Loading, ErrorState } from '../components/States';
import { Slack, RefreshCw, Settings as SettingsIcon } from 'lucide-react';

interface SettingsPageProps {
  onToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function SettingsPage({ onToast }: SettingsPageProps) {
  const [slack, setSlack] = useState<SlackStatus | null>(null);
  const [senders, setSenders] = useState<SenderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [slackData, sendersData] = await Promise.all([
        api.slack.status().catch(() => ({ connected: false })),
        api.dashboard.senders(),
      ]);
      setSlack(slackData);
      setSenders(sendersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSlackConnect = () => {
    window.location.href = api.slack.connect();
  };

  const handleSlackDisconnect = async () => {
    try {
      await api.slack.disconnect();
      setSlack({ connected: false });
      onToast('Slack disconnected', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to disconnect', 'error');
    }
  };

  const handleUpdateSender = async (id: number, field: string, value: number) => {
    setSaving(true);
    try {
      await api.dashboard.updateSender(id, { [field]: value } as any);
      onToast('Sender updated', 'success');
      load();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to update', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading message="Loading settings..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your integrations and sender configuration</p>
      </div>

      {/* Slack Integration */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
            <Slack className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Slack Integration</h2>
            <p className="text-xs text-gray-500">Receive notifications when hourly limits are reached</p>
          </div>
        </div>

        {slack?.connected ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                Connected to {slack.teamName}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSlackConnect}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reconnect
              </button>
              <button
                onClick={handleSlackDisconnect}
                className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleSlackConnect}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Slack className="w-4 h-4" />
            Connect Slack
          </button>
        )}
      </div>

      {/* Sender Configuration */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Sender Configuration</h2>
            <p className="text-xs text-gray-500">Adjust rate limits for your email senders</p>
          </div>
        </div>

        {senders.length === 0 ? (
          <p className="text-sm text-gray-500">No senders configured yet.</p>
        ) : (
          <div className="space-y-4">
            {senders.map((s) => (
              <div key={s.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{s.from_name}</p>
                    <p className="text-xs text-gray-500">{s.from_email}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${s.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Hourly Limit</label>
                    <input
                      type="number"
                      defaultValue={s.hourly_limit}
                      min={1}
                      onBlur={(e) => {
                        const val = Number(e.target.value);
                        if (val !== s.hourly_limit) handleUpdateSender(s.id, 'hourlyLimit', val);
                      }}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Min Delay (sec)</label>
                    <input
                      type="number"
                      defaultValue={s.min_delay_sec}
                      min={1}
                      onBlur={(e) => {
                        const val = Number(e.target.value);
                        if (val !== s.min_delay_sec) handleUpdateSender(s.id, 'minDelaySec', val);
                      }}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {saving && <p className="text-xs text-gray-400 mt-2">Saving...</p>}
      </div>
    </div>
  );
}

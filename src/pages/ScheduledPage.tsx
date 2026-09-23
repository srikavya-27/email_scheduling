import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Delivery, PaginatedResult } from '../types';
import { Loading, EmptyState, ErrorState } from '../components/States';
import { Pagination } from '../components/Pagination';
import { Clock, Mail } from 'lucide-react';

export function ScheduledPage() {
  const [data, setData] = useState<PaginatedResult<Delivery> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.deliveries.scheduled(p, 50);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scheduled emails');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(page);
  }, [page]);

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      scheduled: 'bg-blue-50 text-blue-700',
      pending: 'bg-gray-50 text-gray-700',
      rescheduled: 'bg-amber-50 text-amber-700',
      queued: 'bg-purple-50 text-purple-700',
    };
    return colors[status] || 'bg-gray-50 text-gray-700';
  };

  if (loading && !data) return <Loading message="Loading scheduled emails..." />;
  if (error) return <ErrorState message={error} onRetry={() => load(page)} />;
  if (!data) return null;
  if (data.data.length === 0) return <EmptyState title="No scheduled emails" message="Your scheduled email deliveries will appear here once you compose a campaign." />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Scheduled Emails</h1>
        <p className="text-sm text-gray-500 mt-1">{data.total} emails waiting to be sent</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Recipient</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Scheduled Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Attempts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.data.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Mail className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{d.to_email}</p>
                        {d.to_name && <p className="text-xs text-gray-500 truncate">{d.to_name}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">{d.subject}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      {d.scheduled_time ? new Date(d.scheduled_time).toLocaleString() : '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${statusBadge(d.status)}`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{d.attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
    </div>
  );
}

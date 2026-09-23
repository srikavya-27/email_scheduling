import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Delivery, PaginatedResult } from '../types';
import { Loading, EmptyState, ErrorState } from '../components/States';
import { Pagination } from '../components/Pagination';
import { CheckCircle, XCircle, ExternalLink, Mail } from 'lucide-react';

export function SentPage() {
  const [data, setData] = useState<PaginatedResult<Delivery> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.deliveries.sent(p, 50);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sent emails');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(page);
  }, [page]);

  if (loading && !data) return <Loading message="Loading sent emails..." />;
  if (error) return <ErrorState message={error} onRetry={() => load(page)} />;
  if (!data) return null;
  if (data.data.length === 0) return <EmptyState title="No sent emails yet" message="Your sent and failed email deliveries will appear here." />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sent Emails</h1>
        <p className="text-sm text-gray-500 mt-1">{data.total} delivered emails</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Recipient</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Sent Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Result</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.data.map((d) => {
                const isSent = d.status === 'sent';
                return (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isSent ? 'bg-emerald-50' : 'bg-red-50'}`}>
                          <Mail className={`w-4 h-4 ${isSent ? 'text-emerald-500' : 'text-red-500'}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{d.to_email}</p>
                          {d.to_name && <p className="text-xs text-gray-500 truncate">{d.to_name}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">{d.subject}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {d.actual_send_time ? new Date(d.actual_send_time).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {isSent ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Sent
                        </span>
                      ) : (
                        <div>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium text-red-700 bg-red-50 rounded-full">
                            <XCircle className="w-3.5 h-3.5" />
                            Failed
                          </span>
                          {d.last_error && (
                            <p className="text-xs text-gray-400 mt-1 max-w-xs truncate" title={d.last_error}>{d.last_error}</p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {d.ethereal_preview_url ? (
                        <a
                          href={d.ethereal_preview_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
    </div>
  );
}

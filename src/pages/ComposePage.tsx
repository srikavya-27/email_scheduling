import { useState, useRef } from 'react';
import { api } from '../services/api';
import type { ParseResult, SenderConfig } from '../types';
import { Loading } from '../components/States';
import { Upload, FileText, Send, AlertCircle, CheckCircle } from 'lucide-react';

interface ComposePageProps {
  senders: SenderConfig[];
  onToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function ComposePage({ senders, onToast }: ComposePageProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [startTime, setStartTime] = useState('');
  const [minDelay, setMinDelay] = useState(60);
  const [hourlyLimit, setHourlyLimit] = useState(50);
  const [senderId, setSenderId] = useState<number>(0);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const activeSender = senders.find((s) => s.is_active === 1);
  const effectiveSenderId = senderId || activeSender?.id || 0;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setFileName(file.name);
    try {
      const result = await api.campaigns.parseRecipients(file);
      setParseResult(result);
      onToast(`Parsed ${result.total} recipients (${result.duplicates} duplicates, ${result.invalid} invalid removed)`, 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to parse file', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSchedule = async () => {
    if (!subject.trim()) return onToast('Subject is required', 'error');
    if (!body.trim()) return onToast('Body is required', 'error');
    if (!startTime) return onToast('Start time is required', 'error');
    if (!effectiveSenderId) return onToast('No sender configured', 'error');
    if (!parseResult || parseResult.recipients.length === 0) return onToast('Please upload recipients', 'error');

    setScheduling(true);
    try {
      const result = await api.campaigns.schedule({
        senderId: effectiveSenderId,
        subject,
        body,
        startTime: new Date(startTime).toISOString(),
        minDelaySec: minDelay,
        hourlyLimit,
        recipients: parseResult.recipients,
      });
      onToast(`Campaign created: ${result.deliveryCount} emails scheduled`, 'success');
      setSubject('');
      setBody('');
      setStartTime('');
      setParseResult(null);
      setFileName('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to schedule campaign', 'error');
    } finally {
      setScheduling(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Compose New Email</h1>
        <p className="text-sm text-gray-500 mt-1">Upload recipients, set your schedule, and launch your campaign</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {/* Sender */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Sender</label>
          <select
            value={effectiveSenderId}
            onChange={(e) => setSenderId(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            {senders.length === 0 && <option value={0}>No senders available</option>}
            {senders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.from_name} ({s.from_email}) - {s.hourly_limit}/hr
              </option>
            ))}
          </select>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject line"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Body */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your email content here..."
            rows={8}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
          />
        </div>

        {/* Recipient Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Recipients (CSV/TXT)</label>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            {uploading ? (
              <Loading message="Parsing recipients..." />
            ) : fileName ? (
              <div className="flex flex-col items-center gap-2">
                <FileText className="w-8 h-8 text-blue-500" />
                <p className="text-sm font-medium text-gray-700">{fileName}</p>
                <p className="text-xs text-gray-500">Click to replace</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-gray-400" />
                <p className="text-sm text-gray-600">Click to upload CSV or TXT file</p>
                <p className="text-xs text-gray-400">Must contain an email column</p>
              </div>
            )}
          </div>
          {parseResult && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full">
                <CheckCircle className="w-3.5 h-3.5" />
                {parseResult.total} valid
              </span>
              {parseResult.duplicates > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {parseResult.duplicates} duplicates removed
                </span>
              )}
              {parseResult.invalid > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 rounded-full">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {parseResult.invalid} invalid
                </span>
              )}
            </div>
          )}
        </div>

        {/* Schedule Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Time</label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Min Delay (sec)</label>
            <input
              type="number"
              min={1}
              max={3600}
              value={minDelay}
              onChange={(e) => setMinDelay(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Hourly Limit</label>
            <input
              type="number"
              min={1}
              max={10000}
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSchedule}
            disabled={scheduling || uploading}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {scheduling ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Schedule Campaign
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

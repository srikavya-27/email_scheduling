import type { useToast as _ } from '../hooks/useToast';

interface ToastProps {
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
}

export function Toast({ toast }: ToastProps) {
  if (!toast) return null;

  const bgClass =
    toast.type === 'success'
      ? 'bg-emerald-600'
      : toast.type === 'error'
        ? 'bg-red-600'
        : 'bg-blue-600';

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fade-in-up">
      <div className={`${bgClass} text-white px-5 py-3 rounded-lg shadow-lg max-w-md`}>
        {toast.message}
      </div>
    </div>
  );
}

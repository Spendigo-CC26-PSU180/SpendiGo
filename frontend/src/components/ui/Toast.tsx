import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export interface ToastData {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastProps extends ToastData {
  onClose: (id: string) => void;
}

function Toast({ id, type, message, onClose }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onClose(id), 300);
    }, 3000);

    return () => clearTimeout(timer);
  }, [id, onClose]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
  };

  const backgrounds = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    info: 'bg-blue-50 border-blue-200',
  };

  return (
    <div
      className={`flex items-center gap-3 p-4 rounded-xl border shadow-lg ${backgrounds[type]} ${
        isExiting ? 'toast-exit' : 'toast-enter'
      }`}
    >
      {icons[type]}
      <p className="text-sm text-gray-700 flex-1">{message}</p>
      <button
        onClick={() => {
          setIsExiting(true);
          setTimeout(() => onClose(id), 300);
        }}
        className="p-1 rounded-lg hover:bg-gray-200/50"
      >
        <X className="w-4 h-4 text-gray-500" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastData[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={onClose} />
      ))}
    </div>
  );
}

// Toast hook
let toastCallback: ((toast: Omit<ToastData, 'id'>) => void) | null = null;

export function setToastCallback(callback: (toast: Omit<ToastData, 'id'>) => void) {
  toastCallback = callback;
}

export function toast(type: ToastData['type'], message: string) {
  if (toastCallback) {
    toastCallback({ type, message });
  }
}

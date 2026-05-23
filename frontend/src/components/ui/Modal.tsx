import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg sm:mx-4 max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between p-4 border-b border-gray-100 rounded-t-2xl">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

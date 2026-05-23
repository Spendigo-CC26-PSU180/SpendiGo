import { useState } from 'react';
import { Plus } from 'lucide-react';
import Modal from '../ui/Modal';
import TransactionForm from '../transactions/TransactionForm';

interface QuickAddButtonProps {
  onSuccess?: () => void;
}

export default function QuickAddButton({ onSuccess }: QuickAddButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSuccess = () => {
    setIsOpen(false);
    if (onSuccess) {
      onSuccess();
    } else {
      // Reload page to refresh data
      window.location.reload();
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-20 lg:top-6 right-4 lg:right-8 w-12 h-12 bg-gradient-to-br from-primary-500 to-accent-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center hover:scale-105 active:scale-95 z-30"
      >
        <Plus className="w-6 h-6" />
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Tambah Transaksi">
        <TransactionForm onSuccess={handleSuccess} onCancel={() => setIsOpen(false)} />
      </Modal>
    </>
  );
}

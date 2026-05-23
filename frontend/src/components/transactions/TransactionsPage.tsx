import { useState } from 'react';
import { Plus } from 'lucide-react';
import TransactionList from './TransactionList';
import TransactionFilter from './TransactionFilter';
import TransactionForm from './TransactionForm';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

export default function TransactionsPage() {
  const [filters, setFilters] = useState<{
    type?: string;
    category?: string;
    month?: string;
  }>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleAddSuccess = () => {
    setShowAddModal(false);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transaksi</h1>
          <p className="text-gray-500">Riwayat transaksi kamu</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4" />
          Tambah
        </Button>
      </div>

      {/* Filters */}
      <TransactionFilter filters={filters} onChange={setFilters} />

      {/* Transaction List */}
      <TransactionList
        key={refreshKey}
        filters={filters}
        onAddClick={() => setShowAddModal(true)}
      />

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Tambah Transaksi">
        <TransactionForm onSuccess={handleAddSuccess} onCancel={() => setShowAddModal(false)} />
      </Modal>
    </div>
  );
}

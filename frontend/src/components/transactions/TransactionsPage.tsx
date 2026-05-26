import { useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import TransactionList from './TransactionList';
import TransactionFilter from './TransactionFilter';
import TransactionForm from './TransactionForm';
import ImportCSV from './ImportCSV';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

export default function TransactionsPage() {
  const [filters, setFilters] = useState<{
    type?: string;
    category?: string;
    month?: string;
  }>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleAddSuccess = () => {
    setShowAddModal(false);
    setRefreshKey((k) => k + 1);
  };

  const handleImportSuccess = () => {
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
        <div className="flex gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import CSV</span>
          </button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4" />
            Tambah
          </Button>
        </div>
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

      {/* Import Modal */}
      <ImportCSV
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={handleImportSuccess}
      />
    </div>
  );
}

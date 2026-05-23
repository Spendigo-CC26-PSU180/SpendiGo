import { useState, useEffect } from 'react';
import { Trash2, Edit2, ChevronLeft, ChevronRight } from 'lucide-react';
import { transactionsApi } from '../../lib/api';
import { formatRupiah, getRelativeDate, getCategoryInfo } from '../../lib/utils';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import TransactionForm from './TransactionForm';
import EmptyState from '../ui/EmptyState';
import { TransactionSkeleton } from '../ui/Skeleton';

interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description?: string;
}

interface TransactionListProps {
  filters: {
    type?: string;
    category?: string;
    month?: string;
  };
  onAddClick: () => void;
}

export default function TransactionList({ filters, onAddClick }: TransactionListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 15 };
      if (filters.type) params.type = filters.type;
      if (filters.category) params.category = filters.category;
      if (filters.month) {
        const [year, month] = filters.month.split('-');
        params.start_date = `${year}-${month}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        params.end_date = `${year}-${month}-${lastDay}`;
      }

      const response = await transactionsApi.getAll(params);
      setTransactions(response.data.data);
      setTotalPages(response.data.total_pages);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    fetchTransactions();
  }, [page, filters]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await transactionsApi.delete(deleteId);
      setDeleteId(null);
      fetchTransactions();
    } catch (error) {
      console.error('Failed to delete:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleEditSuccess = () => {
    setEditTransaction(null);
    fetchTransactions();
  };

  // Group transactions by date
  const groupedTransactions = transactions.reduce((groups, transaction) => {
    const date = transaction.date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(transaction);
    return groups;
  }, {} as Record<string, Transaction[]>);

  if (loading) {
    return (
      <div className="space-y-4">
        <TransactionSkeleton />
        <TransactionSkeleton />
        <TransactionSkeleton />
        <TransactionSkeleton />
        <TransactionSkeleton />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon="📝"
        title="Belum ada transaksi"
        description="Mulai catat pengeluaran dan pemasukanmu untuk melihat analisis keuangan"
        action={{ label: 'Tambah Transaksi', onClick: onAddClick }}
      />
    );
  }

  return (
    <div>
      <div className="space-y-6">
        {Object.entries(groupedTransactions).map(([date, items]) => (
          <div key={date}>
            <h3 className="text-sm font-medium text-gray-500 mb-3">{getRelativeDate(date)}</h3>
            <div className="card p-0 divide-y divide-gray-100">
              {items.map((transaction) => {
                const categoryInfo = getCategoryInfo(transaction.category, transaction.type);
                return (
                  <div
                    key={transaction.id}
                    className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-xl shrink-0">
                      {categoryInfo.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{categoryInfo.label}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {transaction.description || '-'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-sm font-semibold ${
                          transaction.type === 'income' ? 'text-income' : 'text-expense'
                        }`}
                      >
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatRupiah(transaction.amount)}
                      </p>
                      <Badge variant={transaction.type}>
                        {transaction.type === 'income' ? 'Masuk' : 'Keluar'}
                      </Badge>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => setEditTransaction(transaction)}
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary-500 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(transaction.id)}
                        className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </Button>
          <span className="text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        isOpen={!!editTransaction}
        onClose={() => setEditTransaction(null)}
        title="Edit Transaksi"
      >
        {editTransaction && (
          <TransactionForm
            initialData={editTransaction}
            onSuccess={handleEditSuccess}
            onCancel={() => setEditTransaction(null)}
          />
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Hapus Transaksi"
      >
        <p className="text-gray-600 mb-6">Yakin ingin menghapus transaksi ini? Aksi ini tidak bisa dibatalkan.</p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setDeleteId(null)} className="flex-1">
            Batal
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting} className="flex-1">
            Hapus
          </Button>
        </div>
      </Modal>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { transactionsApi } from '../../lib/api';
import { formatRupiah, getRelativeDate, getCategoryInfo } from '../../lib/utils';
import Badge from '../ui/Badge';
import { TransactionSkeleton } from '../ui/Skeleton';

interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description?: string;
}

export default function RecentTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await transactionsApi.getAll({ limit: 5 });
        setTransactions(response.data.data);
      } catch (error) {
        console.error('Failed to fetch transactions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  if (loading) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Transaksi Terbaru</h3>
        <div className="space-y-4">
          <TransactionSkeleton />
          <TransactionSkeleton />
          <TransactionSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Transaksi Terbaru</h3>
        <a
          href="/transactions"
          className="text-sm text-primary-500 hover:text-primary-600 flex items-center gap-1"
        >
          Lihat semua
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>

      {transactions.length === 0 ? (
        <div className="py-8 text-center text-gray-500">
          <p>Belum ada transaksi</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((transaction) => {
            const categoryInfo = getCategoryInfo(transaction.category, transaction.type);
            return (
              <div
                key={transaction.id}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-xl">
                  {categoryInfo.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{categoryInfo.label}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {transaction.description || getRelativeDate(transaction.date)}
                  </p>
                </div>
                <div className="text-right">
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

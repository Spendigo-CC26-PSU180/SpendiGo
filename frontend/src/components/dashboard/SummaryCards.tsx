import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Wallet, Activity } from 'lucide-react';
import { analyticsApi } from '../../lib/api';
import { formatRupiah, getCurrentMonth, getMonthName } from '../../lib/utils';
import { CardSkeleton } from '../ui/Skeleton';

interface Summary {
  total_income: number;
  total_expense: number;
  balance: number;
  transaction_count: number;
  avg_daily_expense: number;
}

export default function SummaryCards() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [month] = useState(getCurrentMonth());

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await analyticsApi.getSummary(month);
        setSummary(response.data);
      } catch (error) {
        console.error('Failed to fetch summary:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [month]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const cards = [
    {
      label: 'Total Pemasukan',
      value: formatRupiah(summary.total_income),
      icon: TrendingUp,
      color: 'text-income',
      bgColor: 'bg-income-light',
    },
    {
      label: 'Total Pengeluaran',
      value: formatRupiah(summary.total_expense),
      icon: TrendingDown,
      color: 'text-expense',
      bgColor: 'bg-expense-light',
    },
    {
      label: 'Saldo',
      value: formatRupiah(summary.balance),
      icon: Wallet,
      color: 'text-primary-600',
      bgColor: 'bg-primary-100',
    },
    {
      label: 'Rata-rata/Hari',
      value: formatRupiah(summary.avg_daily_expense),
      icon: Activity,
      color: 'text-secondary-500',
      bgColor: 'bg-teal-100',
    },
  ];

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">{getMonthName(month)}</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((card) => (
          <div key={card.label} className="card">
            <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
              <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl ${card.bgColor}`}>
                <card.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${card.color}`} />
              </div>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{card.value}</p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

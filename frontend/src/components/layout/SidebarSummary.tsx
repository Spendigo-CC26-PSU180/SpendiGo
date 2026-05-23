import { useEffect, useState } from 'react';
import { analyticsApi } from '../../lib/api';
import { formatRupiah } from '../../lib/utils';

interface SummaryData {
  income: number;
  expense: number;
  balance: number;
}

export default function SidebarSummary() {
  const [data, setData] = useState<SummaryData | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await analyticsApi.getSummary();
        setData(response.data);
      } catch (error) {
        console.error('Failed to fetch summary:', error);
      }
    };
    fetchSummary();
  }, []);

  if (!data) {
    return (
      <div className="bg-gradient-to-br from-primary-50 to-secondary-50 rounded-xl p-3 mb-4 animate-pulse">
        <div className="h-3 bg-gray-200 rounded w-20 mb-2"></div>
        <div className="h-5 bg-gray-200 rounded w-24 mb-3"></div>
        <div className="flex justify-between">
          <div className="h-3 bg-gray-200 rounded w-16"></div>
          <div className="h-3 bg-gray-200 rounded w-16"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-primary-50 to-secondary-50 rounded-xl p-3 mb-4">
      <p className="text-xs text-gray-500 mb-1">Saldo Bulan Ini</p>
      <p className={`text-lg font-bold ${data.balance >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
        {formatRupiah(data.balance)}
      </p>
      <div className="flex justify-between mt-2 text-xs">
        <span className="text-green-600">+{formatRupiah(data.income)}</span>
        <span className="text-red-500">-{formatRupiah(data.expense)}</span>
      </div>
    </div>
  );
}

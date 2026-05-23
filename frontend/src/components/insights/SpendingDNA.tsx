import { useEffect, useState } from 'react';
import { analyticsApi } from '../../lib/api';
import { formatRupiah } from '../../lib/utils';
import { CardSkeleton } from '../ui/Skeleton';

interface SpendingDNAData {
  dna_type: string;
  icon: string;
  label: string;
  description: string;
  top_categories: { category: string; amount: number }[];
}

const DNA_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  hedonist: { bg: 'from-pink-50 to-rose-50', border: 'border-pink-200', text: 'text-pink-600' },
  saver: { bg: 'from-emerald-50 to-green-50', border: 'border-emerald-200', text: 'text-emerald-600' },
  unpredictable: { bg: 'from-amber-50 to-orange-50', border: 'border-amber-200', text: 'text-amber-600' },
  balanced: { bg: 'from-violet-50 to-purple-50', border: 'border-violet-200', text: 'text-violet-600' },
};

export default function SpendingDNA() {
  const [data, setData] = useState<SpendingDNAData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDNA = async () => {
      try {
        const response = await analyticsApi.getSpendingDNA();
        setData(response.data);
      } catch (error) {
        console.error('Failed to fetch spending DNA:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDNA();
  }, []);

  if (loading) {
    return <CardSkeleton />;
  }

  if (!data) {
    return (
      <div className="card text-center py-8">
        <p className="text-gray-500">Belum cukup data untuk analisis</p>
      </div>
    );
  }

  const colors = DNA_COLORS[data.dna_type] || DNA_COLORS.balanced;

  return (
    <div className={`card bg-gradient-to-br ${colors.bg} border ${colors.border}`}>
      <div className="flex items-start gap-4">
        <div className="text-4xl sm:text-5xl">{data.icon}</div>
        <div className="flex-1">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Spending DNA</p>
          <h3 className={`text-lg sm:text-xl font-bold ${colors.text}`}>{data.label}</h3>
          <p className="text-sm text-gray-600 mt-1">{data.description}</p>
        </div>
      </div>

      {data.top_categories.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200/50">
          <p className="text-xs text-gray-500 mb-2">Top Pengeluaran:</p>
          <div className="flex flex-wrap gap-2">
            {data.top_categories.map((cat, i) => (
              <span
                key={cat.category}
                className="inline-flex items-center gap-1 px-2 py-1 bg-white/80 rounded-lg text-xs"
              >
                <span className="font-medium text-gray-700">{cat.category}</span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-500">{formatRupiah(cat.amount)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

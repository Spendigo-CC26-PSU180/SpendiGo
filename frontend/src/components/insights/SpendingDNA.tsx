import { useEffect, useState } from 'react';
import { Dna } from 'lucide-react';
import { analyticsApi } from '../../lib/api';
import { formatRupiah } from '../../lib/utils';
import { CardSkeleton } from '../ui/Skeleton';

interface SpendingDNAData {
  has_data: boolean;
  dna_type: string | null;
  label: string | null;
  description: string | null;
  top_categories: { category: string; amount: number }[];
  message?: string | null;
  stats?: {
    spending_ratio: number;
    savings_rate: number;
    variance: number;
    income_sources: number;
  };
}

// Colors for all 13 DNA types - gradient for border, text for label
const DNA_COLORS: Record<string, { gradient: string; text: string }> = {
  hustler: { gradient: 'from-amber-500 to-orange-500', text: 'text-amber-600' },
  investor: { gradient: 'from-emerald-500 to-teal-500', text: 'text-emerald-600' },
  saver: { gradient: 'from-green-500 to-emerald-500', text: 'text-green-600' },
  gamer: { gradient: 'from-purple-500 to-indigo-500', text: 'text-purple-600' },
  foodie: { gradient: 'from-orange-500 to-red-500', text: 'text-orange-600' },
  shopaholic: { gradient: 'from-pink-500 to-rose-500', text: 'text-pink-600' },
  social: { gradient: 'from-blue-500 to-cyan-500', text: 'text-blue-600' },
  survivor: { gradient: 'from-slate-500 to-gray-500', text: 'text-slate-600' },
  hedonist: { gradient: 'from-rose-500 to-pink-500', text: 'text-rose-600' },
  impulsive: { gradient: 'from-yellow-500 to-amber-500', text: 'text-yellow-600' },
  minimalist: { gradient: 'from-gray-400 to-slate-400', text: 'text-gray-600' },
  planner: { gradient: 'from-indigo-500 to-blue-500', text: 'text-indigo-600' },
  balanced: { gradient: 'from-violet-500 to-purple-500', text: 'text-violet-600' },
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
        <p className="text-gray-500">Gagal memuat data</p>
      </div>
    );
  }

  // Empty state when no data - match PredictionCard styling
  if (!data.has_data) {
    return (
      <div className="relative p-[2px] rounded-2xl bg-gradient-to-br from-gray-400 to-slate-400">
        <div className="bg-white rounded-2xl p-4 sm:p-6 relative overflow-hidden">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-gray-100">
              <Dna className="w-6 h-6 text-gray-400" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Spending DNA</p>
              <h3 className="text-base font-semibold text-gray-900 mb-1">Belum Tersedia</h3>
              <p className="text-sm text-gray-600">{data.message || "Mulai catat transaksimu untuk mengetahui spending DNA kamu!"}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const colors = DNA_COLORS[data.dna_type || 'balanced'] || DNA_COLORS.balanced;
  const iconPath = `/icons/dna/${data.dna_type || 'balanced'}.png`;

  return (
    <div className={`relative p-[2px] rounded-2xl bg-gradient-to-br ${colors.gradient}`}>
      <div className="bg-white rounded-2xl p-4 sm:p-6 relative overflow-hidden">
        {/* DNA Icon background watermark */}
        <img
          src={iconPath}
          alt={data.dna_type || 'balanced'}
          className="absolute -right-8 -top-4 w-24 sm:w-32 h-24 sm:h-32 opacity-10"
        />

        <div className="flex items-start gap-4 relative">
          <img
            src={iconPath}
            alt={data.dna_type || 'balanced'}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-contain"
          />
          <div className="flex-1">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Spending DNA</p>
            <h3 className={`text-lg sm:text-xl font-bold ${colors.text}`}>{data.label}</h3>
            <p className="text-sm text-gray-600 mt-1">{data.description}</p>
          </div>
        </div>

        {data.top_categories && data.top_categories.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200/50 relative">
            <p className="text-xs text-gray-500 mb-2">Top Pengeluaran:</p>
            <div className="flex flex-wrap gap-2">
              {data.top_categories.map((cat) => (
                <span
                  key={cat.category}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 rounded-lg text-xs"
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
    </div>
  );
}

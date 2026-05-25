import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';
import { predictApi } from '../../lib/api';
import { formatRupiah } from '../../lib/utils';
import { CardSkeleton } from '../ui/Skeleton';

interface MonthPrediction {
  month: string;
  month_label: string;
  predicted_expense: number;
  confidence_percentage: number;
}

interface ThreeMonthData {
  has_prediction: boolean;
  months_available: number;
  predictions: MonthPrediction[];
  total_predicted: number | null;
  average_predicted: number | null;
  trend: string | null;
  message: string;
}

const TREND_CONFIG = {
  increasing: { icon: TrendingUp, color: 'text-red-500', bg: 'bg-red-50', label: 'Naik' },
  decreasing: { icon: TrendingDown, color: 'text-green-500', bg: 'bg-green-50', label: 'Turun' },
  stable: { icon: Minus, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Stabil' },
};

export default function ThreeMonthChart() {
  const [data, setData] = useState<ThreeMonthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await predictApi.getNextThreeMonths();
        setData(response.data);
      } catch (error) {
        console.error('Failed to fetch 3-month prediction:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
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

  // Empty state
  if (!data.has_prediction) {
    return (
      <div className="card bg-gradient-to-br from-gray-50 to-slate-50 border border-gray-200">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-gray-100">
            <Calendar className="w-6 h-6 text-gray-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Prediksi 3 Bulan</p>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Belum Tersedia</h3>
            <p className="text-sm text-gray-600">{data.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const trendConfig = TREND_CONFIG[data.trend as keyof typeof TREND_CONFIG] || TREND_CONFIG.stable;
  const TrendIcon = trendConfig.icon;

  // Find max for bar chart scaling
  const maxExpense = Math.max(...data.predictions.map(p => p.predicted_expense));

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Prediksi 3 Bulan</p>
          <h3 className="text-lg font-bold text-gray-900">Proyeksi Pengeluaran</h3>
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${trendConfig.bg}`}>
          <TrendIcon className={`w-4 h-4 ${trendConfig.color}`} />
          <span className={`text-xs font-medium ${trendConfig.color}`}>{trendConfig.label}</span>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="space-y-3 mb-4">
        {data.predictions.map((pred, index) => {
          const barWidth = (pred.predicted_expense / maxExpense) * 100;
          const isHighest = pred.predicted_expense === maxExpense;

          return (
            <div key={pred.month}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700">{pred.month_label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{pred.confidence_percentage}%</span>
                  <span className={`text-sm font-semibold ${isHighest ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatRupiah(pred.predicted_expense)}
                  </span>
                </div>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isHighest
                      ? 'bg-gradient-to-r from-red-400 to-red-500'
                      : 'bg-gradient-to-r from-primary-400 to-primary-500'
                  }`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500">Total 3 Bulan</p>
          <p className="text-base font-bold text-gray-900">{formatRupiah(data.total_predicted || 0)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Rata-rata/Bulan</p>
          <p className="text-base font-bold text-gray-900">{formatRupiah(data.average_predicted || 0)}</p>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-3">{data.message}</p>
    </div>
  );
}

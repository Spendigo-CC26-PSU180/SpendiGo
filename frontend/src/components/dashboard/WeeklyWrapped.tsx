import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Calendar, Tag } from 'lucide-react';
import { analyticsApi } from '../../lib/api';
import { formatRupiah } from '../../lib/utils';
import { CardSkeleton } from '../ui/Skeleton';

interface WeeklyData {
  total_spent: number;
  vs_last_week: number;
  busiest_day: string;
  top_category: string;
  top_category_amount: number;
  insight: string;
}

export default function WeeklyWrapped() {
  const [data, setData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await analyticsApi.getWeeklyWrapped();
        setData(response.data);
      } catch (error) {
        console.error('Failed to fetch weekly wrapped:', error);
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
    return null;
  }

  const isUp = data.vs_last_week > 0;

  return (
    <div className="card bg-gradient-to-br from-primary-50 to-secondary-50 border border-primary-100">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">📊</span>
        <h3 className="text-sm sm:text-base font-semibold text-gray-900">Weekly Wrapped</h3>
      </div>

      {/* Total & Change */}
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-xl sm:text-2xl font-bold text-gray-900">
          {formatRupiah(data.total_spent)}
        </span>
        <span className={`flex items-center gap-1 text-xs sm:text-sm font-medium ${isUp ? 'text-red-500' : 'text-green-500'}`}>
          {isUp ? <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" /> : <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4" />}
          {Math.abs(data.vs_last_week)}%
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white/60 rounded-xl p-3">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="text-xs">Hari Terboros</span>
          </div>
          <p className="text-sm font-semibold text-gray-900">{data.busiest_day}</p>
        </div>
        <div className="bg-white/60 rounded-xl p-3">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Tag className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="text-xs">Top Kategori</span>
          </div>
          <p className="text-sm font-semibold text-gray-900 truncate">{data.top_category}</p>
        </div>
      </div>

      {/* Insight */}
      <div className="bg-white/60 rounded-xl p-3">
        <p className="text-xs sm:text-sm text-gray-700">
          <span className="mr-1">💡</span>
          {data.insight}
        </p>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { analyticsApi } from '../../lib/api';
import { formatRupiah, getCategoryInfo, getCurrentMonth } from '../../lib/utils';
import { ChartSkeleton } from '../ui/Skeleton';

interface CategoryData {
  category: string;
  total: number;
  percentage: number;
  count: number;
}

export default function CategoryComparison() {
  const [thisMonth, setThisMonth] = useState<CategoryData[]>([]);
  const [lastMonth, setLastMonth] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const currentMonth = getCurrentMonth();
        const [year, month] = currentMonth.split('-').map(Number);
        const prevMonth = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;

        const [thisRes, lastRes] = await Promise.all([
          analyticsApi.getCategory({ month: currentMonth, type: 'expense' }),
          analyticsApi.getCategory({ month: prevMonth, type: 'expense' }),
        ]);

        setThisMonth(thisRes.data);
        setLastMonth(lastRes.data);
      } catch (error) {
        console.error('Failed to fetch category comparison:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <ChartSkeleton />;
  }

  // Combine data for comparison
  const categories = [...new Set([...thisMonth.map((t) => t.category), ...lastMonth.map((l) => l.category)])];

  const chartData = categories.slice(0, 6).map((cat) => {
    const thisData = thisMonth.find((t) => t.category === cat);
    const lastData = lastMonth.find((l) => l.category === cat);
    const categoryInfo = getCategoryInfo(cat, 'expense');

    return {
      category: categoryInfo.label,
      'Bulan ini': thisData?.total || 0,
      'Bulan lalu': lastData?.total || 0,
    };
  });

  if (chartData.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Perbandingan Kategori</h3>
        <p className="text-gray-500 text-sm">Belum cukup data untuk perbandingan</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-xl shadow-lg border border-gray-100">
          <p className="text-sm font-medium text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any) => (
            <p key={entry.name} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatRupiah(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Perbandingan dengan Bulan Lalu</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
            <XAxis
              type="number"
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              tick={{ fontSize: 12, fill: '#71717A' }}
            />
            <YAxis
              type="category"
              dataKey="category"
              tick={{ fontSize: 12, fill: '#71717A' }}
              width={70}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="Bulan ini" fill="#6356F5" radius={[0, 4, 4, 0]} />
            <Bar dataKey="Bulan lalu" fill="#E4E4E7" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

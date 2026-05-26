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
import { formatRupiah, getCategoryInfo, getCurrentMonth, getMonthName } from '../../lib/utils';
import { ChartSkeleton } from '../ui/Skeleton';

interface CategoryData {
  category: string;
  total: number;
  percentage: number;
  count: number;
}

interface CategoryComparisonProps {
  month?: string;
}

export default function CategoryComparison({ month }: CategoryComparisonProps) {
  const [thisMonthData, setThisMonthData] = useState<CategoryData[]>([]);
  const [lastMonthData, setLastMonthData] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthLabels, setMonthLabels] = useState({ current: 'Bulan ini', prev: 'Bulan lalu' });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const currentMonth = month || getCurrentMonth();
        const [year, monthNum] = currentMonth.split('-').map(Number);
        const prevMonth = monthNum === 1 ? `${year - 1}-12` : `${year}-${String(monthNum - 1).padStart(2, '0')}`;

        // Set month labels
        setMonthLabels({
          current: getMonthName(currentMonth).split(' ')[0], // Just month name
          prev: getMonthName(prevMonth).split(' ')[0],
        });

        const [thisRes, lastRes] = await Promise.all([
          analyticsApi.getCategory({ month: currentMonth, type: 'expense' }),
          analyticsApi.getCategory({ month: prevMonth, type: 'expense' }),
        ]);

        setThisMonthData(thisRes.data);
        setLastMonthData(lastRes.data);
      } catch (error) {
        console.error('Failed to fetch category comparison:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [month]);

  if (loading) {
    return <ChartSkeleton />;
  }

  // Combine data for comparison
  const categories = [...new Set([...thisMonthData.map((t) => t.category), ...lastMonthData.map((l) => l.category)])];

  const chartData = categories.slice(0, 6).map((cat) => {
    const thisData = thisMonthData.find((t) => t.category === cat);
    const lastData = lastMonthData.find((l) => l.category === cat);
    const categoryInfo = getCategoryInfo(cat, 'expense');

    return {
      category: categoryInfo.label,
      [monthLabels.current]: thisData?.total || 0,
      [monthLabels.prev]: lastData?.total || 0,
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
            <Bar dataKey={monthLabels.current} fill="#6356F5" radius={[0, 4, 4, 0]} />
            <Bar dataKey={monthLabels.prev} fill="#E4E4E7" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

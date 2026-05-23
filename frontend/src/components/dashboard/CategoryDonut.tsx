import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { analyticsApi } from '../../lib/api';
import { formatRupiah, getCurrentMonth, getCategoryInfo, CHART_COLORS } from '../../lib/utils';
import { ChartSkeleton } from '../ui/Skeleton';

interface CategoryData {
  category: string;
  total: number;
  percentage: number;
  count: number;
}

export default function CategoryDonut() {
  const [data, setData] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [month] = useState(getCurrentMonth());

  useEffect(() => {
    const fetchCategory = async () => {
      try {
        const response = await analyticsApi.getCategory({ month, type: 'expense' });
        setData(response.data.slice(0, 5)); // Top 5
      } catch (error) {
        console.error('Failed to fetch category:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategory();
  }, [month]);

  if (loading) {
    return <ChartSkeleton />;
  }

  if (data.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Pengeluaran per Kategori</h3>
        <div className="h-64 flex items-center justify-center text-gray-500">
          <p>Belum ada data pengeluaran</p>
        </div>
      </div>
    );
  }

  const chartData = data.map((item) => ({
    ...item,
    name: getCategoryInfo(item.category, 'expense').label,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-xl shadow-lg border border-gray-100">
          <p className="text-sm font-medium text-gray-900">{item.name}</p>
          <p className="text-sm text-gray-600">{formatRupiah(item.total)}</p>
          <p className="text-xs text-gray-500">{item.percentage}% dari total</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Pengeluaran per Kategori</h3>
      <div className="flex flex-col lg:flex-row items-center gap-4">
        <div className="w-48 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="total"
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2">
          {chartData.map((item, index) => (
            <div key={item.category} className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-900 truncate">{item.name}</span>
                  <span className="text-sm font-medium text-gray-900">{item.percentage}%</span>
                </div>
                <p className="text-xs text-gray-500">{formatRupiah(item.total)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

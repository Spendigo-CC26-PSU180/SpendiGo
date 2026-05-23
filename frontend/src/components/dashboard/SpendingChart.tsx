import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { analyticsApi } from '../../lib/api';
import { formatRupiah, formatDateShort } from '../../lib/utils';
import { ChartSkeleton } from '../ui/Skeleton';

interface TrendData {
  date: string;
  income: number;
  expense: number;
  balance: number;
}

export default function SpendingChart() {
  const [data, setData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrend = async () => {
      try {
        const response = await analyticsApi.getTrend(30);
        setData(response.data);
      } catch (error) {
        console.error('Failed to fetch trend:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrend();
  }, []);

  if (loading) {
    return <ChartSkeleton />;
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-xl shadow-lg border border-gray-100">
          <p className="text-sm font-medium text-gray-900 mb-2">
            {formatDateShort(label)}
          </p>
          {payload.map((entry: any) => (
            <p key={entry.name} className="text-sm" style={{ color: entry.color }}>
              {entry.name === 'income' ? 'Pemasukan' : 'Pengeluaran'}:{' '}
              {formatRupiah(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card">
      <h3 className="text-sm sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Tren 30 Hari Terakhir</h3>
      <div className="h-48 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
            <XAxis
              dataKey="date"
              tickFormatter={(date) => formatDateShort(date)}
              tick={{ fontSize: 10, fill: '#71717A' }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              tick={{ fontSize: 10, fill: '#71717A' }}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value) => (value === 'income' ? 'Pemasukan' : 'Pengeluaran')}
              wrapperStyle={{ fontSize: '12px' }}
            />
            <Line
              type="monotone"
              dataKey="income"
              stroke="#22C55E"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="expense"
              stroke="#F43F5E"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

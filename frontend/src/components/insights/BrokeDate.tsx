import { useEffect, useState } from 'react';
import { AlertTriangle, Shield, Clock } from 'lucide-react';
import { predictApi } from '../../lib/api';
import { formatRupiah, formatDateShort } from '../../lib/utils';
import { CardSkeleton } from '../ui/Skeleton';

interface BrokeDateData {
  broke_date: string | null;
  days_left: number | null;
  daily_budget: number;
  current_balance: number;
  status: 'safe' | 'warning' | 'danger';
  message: string;
}

const STATUS_CONFIG = {
  safe: {
    bg: 'from-emerald-50 to-green-50',
    border: 'border-emerald-200',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    Icon: Shield,
  },
  warning: {
    bg: 'from-amber-50 to-yellow-50',
    border: 'border-amber-200',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    Icon: Clock,
  },
  danger: {
    bg: 'from-red-50 to-rose-50',
    border: 'border-red-200',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    Icon: AlertTriangle,
  },
};

export default function BrokeDate() {
  const [data, setData] = useState<BrokeDateData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await predictApi.getBrokeDate();
        setData(response.data);
      } catch (error) {
        console.error('Failed to fetch broke date:', error);
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

  const config = STATUS_CONFIG[data.status];
  const Icon = config.Icon;

  return (
    <div className={`card bg-gradient-to-br ${config.bg} border ${config.border}`}>
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl ${config.iconBg}`}>
          <Icon className={`w-6 h-6 ${config.iconColor}`} />
        </div>
        <div className="flex-1">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Prediksi Kantong Kering</p>

          {data.days_left !== null ? (
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-gray-900">{data.days_left}</span>
              <span className="text-sm text-gray-600">hari lagi</span>
            </div>
          ) : (
            <p className="text-lg font-semibold text-gray-900">Aman!</p>
          )}

          <p className="text-sm text-gray-600 mt-1">{data.message}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-200/50">
        <div className="bg-white/60 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">Saldo Saat Ini</p>
          <p className={`text-sm font-semibold ${data.current_balance >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
            {formatRupiah(data.current_balance)}
          </p>
        </div>
        <div className="bg-white/60 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">Rata-rata Harian</p>
          <p className="text-sm font-semibold text-gray-900">{formatRupiah(data.daily_budget)}/hari</p>
        </div>
      </div>

      {data.broke_date && data.status !== 'safe' && (
        <div className="mt-3 p-3 bg-white/60 rounded-xl">
          <p className="text-xs text-gray-500">
            Estimasi habis: <span className="font-medium text-gray-700">{formatDateShort(data.broke_date)}</span>
          </p>
        </div>
      )}
    </div>
  );
}

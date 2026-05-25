import { useEffect, useState } from 'react';
import { AlertTriangle, Shield, Clock, Lightbulb } from 'lucide-react';
import { predictApi } from '../../lib/api';
import { formatRupiah } from '../../lib/utils';
import { CardSkeleton } from '../ui/Skeleton';

interface BrokeDateData {
  has_prediction: boolean;
  current_balance: number | null;
  avg_daily_expense: number | null;
  days_remaining: number | null;
  predicted_broke_date: string | null;
  predicted_broke_date_formatted: string | null;
  warning_level: 'safe' | 'warning' | 'danger' | null;
  tips: string[];
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

  // Empty state when no prediction available
  if (!data.has_prediction) {
    return (
      <div className="card bg-gradient-to-br from-gray-50 to-slate-50 border border-gray-200">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-gray-100">
            <Clock className="w-6 h-6 text-gray-500" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Prediksi Kantong Kering</p>
            <p className="text-base font-semibold text-gray-900 mb-1">Belum Tersedia</p>
            <p className="text-sm text-gray-600">{data.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const warningLevel = data.warning_level || 'safe';
  const config = STATUS_CONFIG[warningLevel];
  const Icon = config.Icon;

  return (
    <div className={`card bg-gradient-to-br ${config.bg} border ${config.border}`}>
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl ${config.iconBg}`}>
          <Icon className={`w-6 h-6 ${config.iconColor}`} />
        </div>
        <div className="flex-1">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Prediksi Kantong Kering</p>

          {data.days_remaining !== null && data.days_remaining > 0 ? (
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-gray-900">{data.days_remaining}</span>
              <span className="text-sm text-gray-600">hari lagi</span>
            </div>
          ) : data.days_remaining === 0 ? (
            <p className="text-lg font-semibold text-red-600">Saldo Habis!</p>
          ) : (
            <p className="text-lg font-semibold text-gray-900">Aman!</p>
          )}

          <p className="text-sm text-gray-600 mt-1">{data.message}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-200/50">
        <div className="bg-white/60 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">Saldo Saat Ini</p>
          <p className={`text-sm font-semibold ${(data.current_balance || 0) >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
            {formatRupiah(data.current_balance || 0)}
          </p>
        </div>
        <div className="bg-white/60 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">Rata-rata Harian</p>
          <p className="text-sm font-semibold text-gray-900">{formatRupiah(data.avg_daily_expense || 0)}/hari</p>
        </div>
      </div>

      {data.predicted_broke_date_formatted && warningLevel !== 'safe' && (
        <div className="mt-3 p-3 bg-white/60 rounded-xl">
          <p className="text-xs text-gray-500">
            Estimasi habis: <span className="font-medium text-gray-700">{data.predicted_broke_date_formatted}</span>
          </p>
        </div>
      )}

      {/* Tips section */}
      {data.tips && data.tips.length > 0 && warningLevel !== 'safe' && (
        <div className="mt-3 p-3 bg-white/60 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <p className="text-xs font-medium text-gray-700">Tips dari Spen:</p>
          </div>
          <ul className="space-y-1">
            {data.tips.map((tip, i) => (
              <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                <span className="text-primary-500">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

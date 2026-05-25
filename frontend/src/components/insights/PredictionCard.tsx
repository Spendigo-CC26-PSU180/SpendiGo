import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { predictApi } from '../../lib/api';
import { formatRupiah, getCategoryInfo } from '../../lib/utils';
import { CardSkeleton } from '../ui/Skeleton';

interface CategoryPrediction {
  category: string;
  predicted: number;
  percentage: number;
}

interface Prediction {
  has_prediction: boolean;
  months_available: number;
  months_needed: number;
  predicted_expense: number | null;
  last_month_expense: number | null;
  change_percentage: number | null;
  change_direction: string | null;
  confidence: string | null;
  confidence_percentage: number | null;
  breakdown: CategoryPrediction[];
  message: string;
}

export default function PredictionCard() {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrediction = async () => {
      try {
        const response = await predictApi.getNextMonth();
        setPrediction(response.data);
      } catch (error) {
        console.error('Failed to fetch prediction:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrediction();
  }, []);

  if (loading) {
    return <CardSkeleton />;
  }

  if (!prediction) {
    return null;
  }

  // Empty state when not enough data
  if (!prediction.has_prediction) {
    return (
      <div className="relative p-[2px] rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500">
        <div className="bg-white rounded-2xl p-4 sm:p-6 relative overflow-hidden text-center">
          <img
            src="/spen.png"
            alt="Spen AI"
            className="w-16 h-16 mx-auto mb-3 opacity-80"
          />
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
            Prediksi Belum Tersedia
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            {prediction.message}
          </p>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">
              Data kamu: <span className="font-semibold">{prediction.months_available}</span> bulan
            </p>
            <p className="text-xs text-gray-500">
              Dibutuhkan: <span className="font-semibold">{prediction.months_needed}</span> bulan
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Terus catat transaksi kamu!
          </p>
        </div>
      </div>
    );
  }

  const confidencePercent = prediction.confidence_percentage || 0;
  const isUp = prediction.change_direction === 'up';

  return (
    <div className="relative p-[2px] rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500">
      <div className="bg-white rounded-2xl p-4 sm:p-6 relative overflow-hidden">
        {/* Spen mascot background */}
        <img
          src="/spen.png"
          alt="Spen AI"
          className="absolute -right-8 -top-4 w-24 sm:w-32 h-24 sm:h-32 opacity-10"
        />

        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 relative">
          <img src="/spen.png" alt="Spen" className="w-8 h-8 sm:w-10 sm:h-10" />
          <div>
            <span className="text-xs sm:text-sm font-medium text-gray-900 block">Spen bilang...</span>
            <span className="text-xs text-gray-500">Prediksi Bulan Depan (LSTM AI)</span>
          </div>
        </div>

        <div className="mb-4 sm:mb-6">
          <div className="flex items-baseline gap-3 mb-2">
            <p className="text-xl sm:text-3xl font-bold text-gray-900">
              {formatRupiah(prediction.predicted_expense || 0)}
            </p>
            {prediction.change_percentage !== null && (
              <span className={`flex items-center gap-1 text-sm font-medium ${isUp ? 'text-red-500' : 'text-green-500'}`}>
                {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {Math.abs(prediction.change_percentage)}%
              </span>
            )}
          </div>

          {/* Confidence bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all"
                style={{ width: `${confidencePercent}%` }}
              />
            </div>
            <span className="text-sm text-gray-600">{confidencePercent}%</span>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            {prediction.message} | Confidence: {prediction.confidence}
          </p>
        </div>

        {/* Category breakdown */}
        {prediction.breakdown.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Prediksi per Kategori:</p>
            <div className="space-y-2">
              {prediction.breakdown.slice(0, 5).map((item) => {
                const categoryInfo = getCategoryInfo(item.category, 'expense');
                return (
                  <div key={item.category} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{categoryInfo.icon}</span>
                      <span className="text-sm text-gray-600">{categoryInfo.label}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-gray-900">{formatRupiah(item.predicted)}</span>
                      <span className="text-xs text-gray-400 ml-1">({item.percentage}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

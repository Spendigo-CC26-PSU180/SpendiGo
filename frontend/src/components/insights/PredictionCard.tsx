import { useEffect, useState } from 'react';
import { predictApi } from '../../lib/api';
import { formatRupiah, getCategoryInfo } from '../../lib/utils';
import { CardSkeleton } from '../ui/Skeleton';

interface CategoryPrediction {
  category: string;
  predicted: number;
}

interface Prediction {
  predicted_expense: number;
  confidence: number;
  based_on_months: number;
  breakdown: CategoryPrediction[];
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

  const confidencePercent = Math.round(prediction.confidence * 100);

  return (
    <div className="relative p-[2px] rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500">
      <div className="bg-white rounded-2xl p-6 relative overflow-hidden">
        {/* Spen mascot background */}
        <img
          src="/spen.png"
          alt="Spen AI"
          className="absolute -right-8 -top-4 w-32 h-32 opacity-10"
        />

        <div className="flex items-center gap-3 mb-4 relative">
          <img src="/spen.png" alt="Spen" className="w-10 h-10" />
          <div>
            <span className="text-sm font-medium text-gray-900 block">Spen bilang...</span>
            <span className="text-xs text-gray-500">Prediksi Bulan Depan</span>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-3xl font-bold text-gray-900 mb-2">{formatRupiah(prediction.predicted_expense)}</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all"
                style={{ width: `${confidencePercent}%` }}
              />
            </div>
            <span className="text-sm text-gray-600">{confidencePercent}% confidence</span>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Berdasarkan {prediction.based_on_months} bulan data kamu
          </p>
        </div>

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
                  <span className="text-sm font-medium text-gray-900">{formatRupiah(item.predicted)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

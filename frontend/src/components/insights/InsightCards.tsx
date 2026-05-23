import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { predictApi } from '../../lib/api';
import { TransactionSkeleton } from '../ui/Skeleton';

interface Insight {
  type: 'warning' | 'success' | 'info';
  message: string;
  category?: string;
  change_percent?: number;
}

export default function InsightCards() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const response = await predictApi.getInsights();
        setInsights(response.data.insights);
      } catch (error) {
        console.error('Failed to fetch insights:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        <TransactionSkeleton />
        <TransactionSkeleton />
      </div>
    );
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getStyles = (type: string) => {
    switch (type) {
      case 'warning':
        return 'bg-amber-50 border-amber-200';
      case 'success':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Insights dari Spen</h3>
      <div className="space-y-3">
        {insights.length === 0 ? (
          <p className="text-gray-500 text-sm">Belum ada insights. Terus catat transaksimu!</p>
        ) : (
          insights.map((insight, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 p-4 rounded-xl border ${getStyles(insight.type)}`}
            >
              {getIcon(insight.type)}
              <div className="flex-1">
                <p className="text-sm text-gray-900">{insight.message}</p>
                {insight.change_percent && (
                  <p className="text-xs text-gray-500 mt-1">
                    Perubahan: {insight.change_percent > 0 ? '+' : ''}
                    {insight.change_percent.toFixed(1)}%
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

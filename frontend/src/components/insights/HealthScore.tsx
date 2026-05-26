import { useEffect, useState } from 'react';
import { Heart, Check, AlertTriangle, Info } from 'lucide-react';
import { predictApi } from '../../lib/api';
import { CardSkeleton } from '../ui/Skeleton';

interface HealthCheck {
  status: 'good' | 'warning' | 'info';
  message: string;
}

interface HealthScoreData {
  score: number;
  label: string;
  checks: HealthCheck[];
}

interface HealthScoreProps {
  month?: string;
}

export default function HealthScore({ month }: HealthScoreProps) {
  const [data, setData] = useState<HealthScoreData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      setLoading(true);
      try {
        const response = await predictApi.getHealthScore(month);
        setData(response.data);
      } catch (error) {
        console.error('Failed to fetch health score:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
  }, [month]);

  if (loading) {
    return <CardSkeleton />;
  }

  if (!data) {
    return null;
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-primary-500';
    if (score >= 40) return 'text-amber-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-primary-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getCheckIcon = (status: string) => {
    switch (status) {
      case 'good':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-6">
        <Heart className="w-5 h-5 text-accent-500" />
        <h3 className="text-lg font-semibold text-gray-900">Financial Health Score</h3>
      </div>

      <div className="text-center mb-6">
        <div className={`text-5xl font-bold ${getScoreColor(data.score)} mb-2`}>
          {data.score}
          <span className="text-2xl text-gray-400">/100</span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full ${getScoreBg(data.score)} rounded-full transition-all duration-500`}
            style={{ width: `${data.score}%` }}
          />
        </div>
        <p className={`text-sm font-medium ${getScoreColor(data.score)}`}>{data.label}</p>
      </div>

      <div className="space-y-3">
        {data.checks.map((check, index) => (
          <div key={index} className="flex items-center gap-3">
            {getCheckIcon(check.status)}
            <span className="text-sm text-gray-700">{check.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

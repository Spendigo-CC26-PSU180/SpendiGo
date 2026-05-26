import { useEffect, useState } from 'react';
import { Plus, Trash2, Target } from 'lucide-react';
import { budgetApi } from '../../lib/api';
import { formatRupiah, EXPENSE_CATEGORIES, getCategoryInfo, getCurrentMonth, getMonthName } from '../../lib/utils';
import { CardSkeleton } from '../ui/Skeleton';
import Modal from '../ui/Modal';

interface BudgetGoal {
  id: string;
  category: string;
  budget_limit: number;
  spent: number;
  percentage: number;
  month: string;
}

interface BudgetData {
  goals: BudgetGoal[];
  total_budget: number;
  total_spent: number;
}

interface BudgetGoalsProps {
  month?: string;
}

export default function BudgetGoals({ month }: BudgetGoalsProps) {
  const [data, setData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    category: '',
    budget_limit: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const selectedMonth = month || getCurrentMonth();

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await budgetApi.getGoals(selectedMonth);
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch budget goals:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [month]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category || !formData.budget_limit) return;

    setSubmitting(true);
    try {
      await budgetApi.createGoal({
        category: formData.category,
        budget_limit: parseInt(formData.budget_limit),
      });
      setIsModalOpen(false);
      setFormData({ category: '', budget_limit: '' });
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to create budget goal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus budget ini?')) return;

    try {
      await budgetApi.deleteGoal(id);
      fetchData();
    } catch (error) {
      console.error('Failed to delete budget goal:', error);
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-amber-500';
    return 'bg-primary-500';
  };

  const getTextColor = (percentage: number) => {
    if (percentage >= 100) return 'text-red-500';
    if (percentage >= 80) return 'text-amber-500';
    return 'text-primary-500';
  };

  if (loading) {
    return <CardSkeleton />;
  }

  // Filter out categories that already have goals
  const usedCategories = data?.goals.map((g) => g.category) || [];
  const availableCategories = EXPENSE_CATEGORIES.filter((c) => !usedCategories.includes(c.id));

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary-500" />
          <h3 className="text-sm sm:text-base font-semibold text-gray-900">Budget Goals</h3>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="p-2 rounded-xl bg-primary-50 text-primary-500 hover:bg-primary-100 transition-colors"
          disabled={availableCategories.length === 0}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Month indicator */}
      <p className="text-xs text-gray-500 mb-4">{getMonthName(selectedMonth)}</p>

      {/* Goals List */}
      {data && data.goals.length > 0 ? (
        <div className="space-y-3">
          {data.goals.map((goal) => {
            const catInfo = getCategoryInfo(goal.category, 'expense');
            return (
              <div key={goal.id} className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{catInfo.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{catInfo.label}</p>
                      <p className="text-xs text-gray-500">
                        {formatRupiah(goal.spent)} / {formatRupiah(goal.budget_limit)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${getTextColor(goal.percentage)}`}>
                      {goal.percentage.toFixed(0)}%
                    </span>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${getProgressColor(goal.percentage)}`}
                    style={{ width: `${Math.min(goal.percentage, 100)}%` }}
                  />
                </div>
                {goal.percentage >= 80 && goal.percentage < 100 && (
                  <p className="text-xs text-amber-600 mt-1">Hampir mencapai limit!</p>
                )}
                {goal.percentage >= 100 && (
                  <p className="text-xs text-red-500 mt-1">Budget terlampaui!</p>
                )}
              </div>
            );
          })}

          {/* Total Summary */}
          <div className="pt-3 border-t border-gray-200">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Budget:</span>
              <span className="font-medium text-gray-900">{formatRupiah(data.total_budget)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-500">Total Terpakai:</span>
              <span className={`font-medium ${data.total_spent > data.total_budget ? 'text-red-500' : 'text-gray-900'}`}>
                {formatRupiah(data.total_spent)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-6">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Belum ada budget goals</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-3 text-sm text-primary-500 hover:text-primary-600"
          >
            + Tambah budget pertama
          </button>
        </div>
      )}

      {/* Add Budget Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Tambah Budget">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="input"
              required
            >
              <option value="">Pilih kategori</option>
              {availableCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget Limit</label>
            <input
              type="number"
              value={formData.budget_limit}
              onChange={(e) => setFormData({ ...formData, budget_limit: e.target.value })}
              className="input"
              placeholder="500000"
              min="1000"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full"
          >
            {submitting ? 'Menyimpan...' : 'Simpan Budget'}
          </button>
        </form>
      </Modal>
    </div>
  );
}

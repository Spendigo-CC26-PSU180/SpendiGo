import { useState } from 'react';
import { Calculator, TrendingDown, TrendingUp, Sparkles, RefreshCw } from 'lucide-react';
import { predictApi, type WhatIfRequest } from '../../lib/api';
import { formatRupiah } from '../../lib/utils';

interface WhatIfResult {
  has_prediction: boolean;
  baseline_expense: number | null;
  simulated_expense: number | null;
  difference: number | null;
  difference_percentage: number | null;
  baseline_broke_days: number | null;
  simulated_broke_days: number | null;
  broke_days_difference: number | null;
  insights: string[];
  message: string;
}

const PRESET_SCENARIOS = [
  {
    id: 'hemat-kopi',
    label: 'Kurangi Kopi 50%',
    icon: '☕',
    params: { expense_category_changes: { kopi: -50 } },
  },
  {
    id: 'hemat-makan',
    label: 'Hemat Makan 30%',
    icon: '🍜',
    params: { expense_category_changes: { makan: -30 } },
  },
  {
    id: 'income-turun',
    label: 'Income -20%',
    icon: '📉',
    params: { income_change: -20 },
  },
  {
    id: 'new-kos',
    label: 'Pindah Kos +500rb',
    icon: '🏠',
    params: { add_monthly_expense: 500000 },
  },
];

export default function WhatIfSimulator() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [customMode, setCustomMode] = useState(false);

  // Custom form state
  const [incomeChange, setIncomeChange] = useState(0);
  const [makanChange, setMakanChange] = useState(0);
  const [kopiChange, setKopiChange] = useState(0);
  const [additionalExpense, setAdditionalExpense] = useState(0);

  const runSimulation = async (params: WhatIfRequest) => {
    setLoading(true);
    try {
      const response = await predictApi.simulateWhatIf(params);
      setResult(response.data);
    } catch (error) {
      console.error('Simulation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreset = (preset: typeof PRESET_SCENARIOS[0]) => {
    setSelectedScenario(preset.id);
    setCustomMode(false);
    runSimulation(preset.params);
  };

  const handleCustomSimulation = () => {
    const params: WhatIfRequest = {
      income_change: incomeChange,
      expense_category_changes: {},
      add_monthly_expense: additionalExpense,
    };
    if (makanChange !== 0) params.expense_category_changes!.makan = makanChange;
    if (kopiChange !== 0) params.expense_category_changes!.kopi = kopiChange;

    runSimulation(params);
  };

  const resetSimulation = () => {
    setResult(null);
    setSelectedScenario(null);
    setCustomMode(false);
    setIncomeChange(0);
    setMakanChange(0);
    setKopiChange(0);
    setAdditionalExpense(0);
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100">
            <Calculator className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">What-If Simulator</h3>
            <p className="text-xs text-gray-500">Simulasi perubahan keuangan</p>
          </div>
        </div>
        {result && (
          <button
            onClick={resetSimulation}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Preset Scenarios */}
      {!result && !customMode && (
        <>
          <p className="text-sm text-gray-600 mb-3">Pilih skenario:</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {PRESET_SCENARIOS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePreset(preset)}
                disabled={loading}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  selectedScenario === preset.id
                    ? 'border-violet-400 bg-violet-50'
                    : 'border-gray-100 hover:border-violet-200 hover:bg-violet-50/50'
                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className="text-xl">{preset.icon}</span>
                <p className="text-sm font-medium text-gray-700 mt-1">{preset.label}</p>
              </button>
            ))}
          </div>

          <button
            onClick={() => setCustomMode(true)}
            className="w-full py-2 text-sm text-violet-600 hover:text-violet-700 font-medium"
          >
            Buat skenario custom →
          </button>
        </>
      )}

      {/* Custom Mode */}
      {!result && customMode && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Perubahan Income (%)</label>
            <input
              type="range"
              min="-50"
              max="50"
              value={incomeChange}
              onChange={(e) => setIncomeChange(Number(e.target.value))}
              className="w-full mt-1"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>-50%</span>
              <span className={incomeChange >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                {incomeChange > 0 ? '+' : ''}{incomeChange}%
              </span>
              <span>+50%</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Hemat Makan (%)</label>
            <input
              type="range"
              min="-50"
              max="0"
              value={makanChange}
              onChange={(e) => setMakanChange(Number(e.target.value))}
              className="w-full mt-1"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>-50%</span>
              <span className="text-green-600 font-medium">{makanChange}%</span>
              <span>0%</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Hemat Kopi (%)</label>
            <input
              type="range"
              min="-100"
              max="0"
              value={kopiChange}
              onChange={(e) => setKopiChange(Number(e.target.value))}
              className="w-full mt-1"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>-100%</span>
              <span className="text-green-600 font-medium">{kopiChange}%</span>
              <span>0%</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Tambahan Pengeluaran (Rp)</label>
            <input
              type="number"
              value={additionalExpense}
              onChange={(e) => setAdditionalExpense(Number(e.target.value))}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              placeholder="500000"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setCustomMode(false)}
              className="flex-1 py-2 text-gray-600 font-medium border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              onClick={handleCustomSimulation}
              disabled={loading}
              className="flex-1 py-2 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50"
            >
              {loading ? 'Menghitung...' : 'Simulasi'}
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-violet-600 border-t-transparent" />
        </div>
      )}

      {/* Results */}
      {result && result.has_prediction && !loading && (
        <div className="space-y-4">
          {/* Expense Comparison */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500">Baseline</p>
              <p className="text-base font-bold text-gray-700">
                {formatRupiah(result.baseline_expense || 0)}
              </p>
            </div>
            <div className={`p-3 rounded-xl ${result.difference && result.difference < 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className="text-xs text-gray-500">Simulasi</p>
              <p className={`text-base font-bold ${result.difference && result.difference < 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatRupiah(result.simulated_expense || 0)}
              </p>
            </div>
          </div>

          {/* Difference */}
          <div className={`p-4 rounded-xl ${result.difference && result.difference < 0 ? 'bg-green-100' : 'bg-red-100'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {result.difference && result.difference < 0 ? (
                  <TrendingDown className="w-5 h-5 text-green-600" />
                ) : (
                  <TrendingUp className="w-5 h-5 text-red-600" />
                )}
                <span className={`text-sm font-medium ${result.difference && result.difference < 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {result.difference && result.difference < 0 ? 'Hemat' : 'Tambah'}
                </span>
              </div>
              <span className={`text-lg font-bold ${result.difference && result.difference < 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatRupiah(Math.abs(result.difference || 0))}
              </span>
            </div>
            {result.broke_days_difference !== null && result.broke_days_difference !== 0 && (
              <p className={`text-sm mt-2 ${result.broke_days_difference > 0 ? 'text-green-700' : 'text-red-700'}`}>
                Uang cukup {result.broke_days_difference > 0 ? '+' : ''}{result.broke_days_difference} hari
              </p>
            )}
          </div>

          {/* Insights */}
          {result.insights.length > 0 && (
            <div className="space-y-2">
              {result.insights.map((insight, i) => (
                <div key={i} className="flex items-start gap-2 p-3 bg-violet-50 rounded-lg">
                  <Sparkles className="w-4 h-4 text-violet-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-violet-700">{insight}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No Data State */}
      {result && !result.has_prediction && !loading && (
        <div className="text-center py-6">
          <p className="text-gray-500">{result.message}</p>
        </div>
      )}
    </div>
  );
}

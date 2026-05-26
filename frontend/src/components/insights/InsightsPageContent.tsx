import { useState } from 'react';
import MonthPicker from './MonthPicker';
import SpendingDNA from './SpendingDNA';
import BrokeDate from './BrokeDate';
import PredictionCard from './PredictionCard';
import HealthScore from './HealthScore';
import ThreeMonthChart from './ThreeMonthChart';
import WhatIfSimulator from './WhatIfSimulator';
import InsightCards from './InsightCards';
import BudgetGoals from './BudgetGoals';
import CategoryComparison from './CategoryComparison';
import { getCurrentMonth } from '../../lib/utils';

export default function InsightsPageContent() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());

  return (
    <div className="p-4 lg:p-8">
      {/* Header with Spen + Month Picker */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <img src="/spen.png" alt="Spen AI" className="w-12 h-12 sm:w-16 sm:h-16" />
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Halo, aku Spen!</h1>
            <p className="text-xs sm:text-base text-gray-500">AI assistant yang bantu analisis keuanganmu</p>
          </div>
        </div>
        <MonthPicker selectedMonth={selectedMonth} onChange={setSelectedMonth} />
      </div>

      {/* Row 1: Spending DNA + Broke Date (not affected by month) */}
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
        <SpendingDNA />
        <BrokeDate />
      </div>

      {/* Row 2: Prediction + Health Score */}
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
        <PredictionCard />
        <HealthScore month={selectedMonth} />
      </div>

      {/* Row 3: 3-Month Chart + What-If Simulator (not affected by month) */}
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
        <ThreeMonthChart />
        <WhatIfSimulator />
      </div>

      {/* Insights Cards */}
      <div className="mb-4 sm:mb-6">
        <InsightCards month={selectedMonth} />
      </div>

      {/* Row 4: Budget Goals + Category Comparison */}
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        <BudgetGoals month={selectedMonth} />
        <CategoryComparison month={selectedMonth} />
      </div>
    </div>
  );
}

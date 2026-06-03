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

      {/* Masonry layout - cards flow naturally without big gaps */}
      <div className="columns-1 lg:columns-2 gap-4 sm:gap-6 space-y-4 sm:space-y-6">
        <div className="break-inside-avoid">
          <SpendingDNA />
        </div>
        <div className="break-inside-avoid">
          <BrokeDate />
        </div>
        <div className="break-inside-avoid">
          <PredictionCard />
        </div>
        <div className="break-inside-avoid">
          <HealthScore month={selectedMonth} />
        </div>
        <div className="break-inside-avoid">
          <ThreeMonthChart />
        </div>
        <div className="break-inside-avoid">
          <WhatIfSimulator />
        </div>
        <div className="break-inside-avoid">
          <InsightCards month={selectedMonth} />
        </div>
        <div className="break-inside-avoid">
          <BudgetGoals month={selectedMonth} />
        </div>
        <div className="break-inside-avoid">
          <CategoryComparison month={selectedMonth} />
        </div>
      </div>
    </div>
  );
}

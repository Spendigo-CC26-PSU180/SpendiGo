import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { getMonthName } from '../../lib/utils';

interface MonthPickerProps {
  selectedMonth: string;
  onChange: (month: string) => void;
}

export default function MonthPicker({ selectedMonth, onChange }: MonthPickerProps) {
  const navigateMonth = (direction: 'prev' | 'next') => {
    const [year, month] = selectedMonth.split('-').map(Number);
    let newYear = year;
    let newMonth = month;

    if (direction === 'prev') {
      if (month === 1) {
        newYear = year - 1;
        newMonth = 12;
      } else {
        newMonth = month - 1;
      }
    } else {
      if (month === 12) {
        newYear = year + 1;
        newMonth = 1;
      } else {
        newMonth = month + 1;
      }
    }

    onChange(`${newYear}-${String(newMonth).padStart(2, '0')}`);
  };

  // Don't allow navigating to future months
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const canGoNext = selectedMonth < currentMonth;

  return (
    <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 px-3 py-2">
      <Calendar className="w-4 h-4 text-gray-400" />
      <button
        onClick={() => navigateMonth('prev')}
        className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <ChevronLeft className="w-4 h-4 text-gray-600" />
      </button>
      <span className="text-sm font-medium text-gray-700 min-w-[120px] text-center">
        {getMonthName(selectedMonth)}
      </span>
      <button
        onClick={() => navigateMonth('next')}
        disabled={!canGoNext}
        className={`p-1 rounded-lg transition-colors ${
          canGoNext ? 'hover:bg-gray-100' : 'opacity-30 cursor-not-allowed'
        }`}
      >
        <ChevronRight className="w-4 h-4 text-gray-600" />
      </button>
    </div>
  );
}

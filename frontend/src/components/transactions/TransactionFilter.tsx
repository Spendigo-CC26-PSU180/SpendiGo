import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, getCurrentMonth } from '../../lib/utils';

interface TransactionFilterProps {
  filters: {
    type?: string;
    category?: string;
    month?: string;
  };
  onChange: (filters: { type?: string; category?: string; month?: string }) => void;
}

export default function TransactionFilter({ filters, onChange }: TransactionFilterProps) {
  const allCategories = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
  const uniqueCategories = allCategories.filter(
    (cat, index, self) => self.findIndex((c) => c.id === cat.id) === index
  );

  // Generate month options (last 12 months)
  const monthOptions = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(date);
    monthOptions.push({ value, label });
  }

  return (
    <div className="overflow-x-auto -mx-4 px-4 mb-6">
      <div className="flex gap-2 sm:gap-3 min-w-max sm:min-w-0 sm:flex-wrap">
        {/* Month Filter */}
        <select
          value={filters.month || ''}
          onChange={(e) => onChange({ ...filters, month: e.target.value || undefined })}
          className="px-3 sm:px-4 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none"
        >
          <option value="">Semua waktu</option>
          {monthOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Type Filter */}
        <select
          value={filters.type || ''}
          onChange={(e) => onChange({ ...filters, type: e.target.value || undefined, category: undefined })}
          className="px-3 sm:px-4 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none"
        >
          <option value="">Semua tipe</option>
          <option value="expense">Pengeluaran</option>
          <option value="income">Pemasukan</option>
        </select>

        {/* Category Filter */}
        <select
          value={filters.category || ''}
          onChange={(e) => onChange({ ...filters, category: e.target.value || undefined })}
          className="px-3 sm:px-4 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none"
        >
          <option value="">Semua kategori</option>
          {(filters.type === 'income' ? INCOME_CATEGORIES : filters.type === 'expense' ? EXPENSE_CATEGORIES : uniqueCategories).map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.icon} {cat.label}
            </option>
          ))}
        </select>

        {/* Clear Filters */}
        {(filters.type || filters.category || filters.month) && (
          <button
            onClick={() => onChange({})}
            className="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm text-primary-500 hover:bg-primary-50 transition-colors whitespace-nowrap"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

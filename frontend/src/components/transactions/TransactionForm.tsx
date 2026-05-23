import { useState } from 'react';
import { transactionsApi } from '../../lib/api';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, formatDateInput } from '../../lib/utils';
import Button from '../ui/Button';

interface TransactionFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: {
    id: string;
    date: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    description?: string;
  };
}

export default function TransactionForm({ onSuccess, onCancel, initialData }: TransactionFormProps) {
  const [type, setType] = useState<'expense' | 'income'>(initialData?.type || 'expense');
  const [amount, setAmount] = useState(initialData?.amount?.toString() || '');
  const [category, setCategory] = useState(initialData?.category || '');
  const [date, setDate] = useState(initialData?.date || formatDateInput(new Date()));
  const [description, setDescription] = useState(initialData?.description || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const formatAmount = (value: string) => {
    const num = value.replace(/\D/g, '');
    return num ? parseInt(num).toLocaleString('id-ID') : '';
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    setAmount(raw);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!amount || parseInt(amount) <= 0) {
      setError('Jumlah harus lebih dari 0');
      return;
    }

    if (!category) {
      setError('Pilih kategori');
      return;
    }

    setLoading(true);

    try {
      const data = {
        date,
        amount: parseInt(amount),
        type,
        category,
        description: description || undefined,
      };

      if (initialData?.id) {
        await transactionsApi.update(initialData.id, data);
      } else {
        await transactionsApi.create(data);
      }

      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Gagal menyimpan transaksi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Type Toggle */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
        <button
          type="button"
          onClick={() => {
            setType('expense');
            setCategory('');
          }}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
            type === 'expense'
              ? 'bg-expense text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Pengeluaran
        </button>
        <button
          type="button"
          onClick={() => {
            setType('income');
            setCategory('');
          }}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
            type === 'income'
              ? 'bg-income text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Pemasukan
        </button>
      </div>

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
          <input
            type="text"
            value={formatAmount(amount)}
            onChange={handleAmountChange}
            placeholder="0"
            className="input pl-12 text-lg font-semibold"
            required
          />
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Kategori</label>
        <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                category === cat.id
                  ? type === 'income'
                    ? 'border-income bg-income-light'
                    : 'border-expense bg-expense-light'
                  : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span className="text-xl">{cat.icon}</span>
              <span className="text-xs text-gray-700 text-center">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input"
          required
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Deskripsi <span className="text-gray-400">(opsional)</span>
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Catatan tambahan..."
          className="input"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
          Batal
        </Button>
        <Button type="submit" loading={loading} className="flex-1">
          {initialData ? 'Simpan' : 'Tambah'}
        </Button>
      </div>
    </form>
  );
}

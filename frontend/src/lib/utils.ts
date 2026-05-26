export const formatRupiah = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (date: string | Date): string => {
  const d = new Date(date);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
};

export const formatDateShort = (date: string | Date): string => {
  const d = new Date(date);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
  }).format(d);
};

export const formatDateInput = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const getRelativeDate = (date: string | Date): string => {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) {
    return 'Hari ini';
  } else if (d.toDateString() === yesterday.toDateString()) {
    return 'Kemarin';
  } else {
    return formatDate(d);
  }
};

export const getCurrentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const getMonthName = (monthStr: string): string => {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(date);
};

export const EXPENSE_CATEGORIES = [
  { id: 'makan', label: 'Makan', icon: '🍜' },
  { id: 'transport', label: 'Transport', icon: '🚗' },
  { id: 'belanja online', label: 'Belanja Online', icon: '🛍️' },
  { id: 'fashion', label: 'Fashion', icon: '👗' },
  { id: 'kopi', label: 'Kopi', icon: '☕' },
  { id: 'hiburan', label: 'Hiburan', icon: '🎬' },
  { id: 'nongkrong', label: 'Nongkrong', icon: '🍻' },
  { id: 'top up game', label: 'Top Up Game', icon: '🎮' },
  { id: 'kuota', label: 'Kuota', icon: '📱' },
  { id: 'skincare', label: 'Skincare', icon: '✨' },
  { id: 'kesehatan', label: 'Kesehatan', icon: '💊' },
  { id: 'edukasi', label: 'Edukasi', icon: '📚' },
  { id: 'kos/kontrakan', label: 'Kos/Kontrakan', icon: '🏠' },
  { id: 'tagihan', label: 'Tagihan', icon: '📄' },
  { id: 'investasi', label: 'Investasi', icon: '📈' },
  { id: 'lainnya', label: 'Lainnya', icon: '📦' },
];

export const INCOME_CATEGORIES = [
  { id: 'uang saku', label: 'Uang Saku', icon: '💵' },
  { id: 'gaji', label: 'Gaji', icon: '💰' },
  { id: 'freelance', label: 'Freelance', icon: '💻' },
  { id: 'part time', label: 'Part Time', icon: '⏰' },
  { id: 'beasiswa', label: 'Beasiswa', icon: '🎓' },
  { id: 'transfer masuk', label: 'Transfer Masuk', icon: '📥' },
  { id: 'lainnya', label: 'Lainnya', icon: '📦' },
];

export const getCategoryInfo = (category: string, type: 'income' | 'expense') => {
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return categories.find((c) => c.id === category) || { id: category, label: category, icon: '📦' };
};

// Chart colors
export const CHART_COLORS = [
  '#6356F5', // primary
  '#14B8A6', // secondary
  '#EC4899', // accent
  '#F59E0B', // amber
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EF4444', // red
  '#10B981', // emerald
];

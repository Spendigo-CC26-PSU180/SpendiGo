const EXPENSE_CATEGORIES = [
  'makan', 'transport', 'belanja online', 'fashion', 'kopi',
  'hiburan', 'nongkrong', 'top up game', 'kuota', 'skincare',
  'kesehatan', 'edukasi', 'kos/kontrakan', 'tagihan', 'investasi', 'lainnya'
];

const INCOME_CATEGORIES = [
  'uang saku', 'gaji', 'freelance', 'part time',
  'beasiswa', 'transfer masuk', 'lainnya'
];

const validateCategory = (type, category) => {
  const categoryLower = category.toLowerCase();
  if (type === 'expense') {
    return EXPENSE_CATEGORIES.includes(categoryLower);
  } else if (type === 'income') {
    return INCOME_CATEGORIES.includes(categoryLower);
  }
  return false;
};

module.exports = {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  validateCategory,
};

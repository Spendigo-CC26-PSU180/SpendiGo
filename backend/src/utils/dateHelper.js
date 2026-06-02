const parseMonth = (monthStr) => {
  let year, month;

  if (monthStr) {
    [year, month] = monthStr.split('-').map(Number);
  } else {
    const today = new Date();
    year = today.getFullYear();
    month = today.getMonth() + 1;
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of the month

  return { startDate, endDate, year, month };
};

const getCurrentMonth = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
};

const formatDateForDB = (date) => {
  return new Date(date).toISOString().split('T')[0];
};

const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

module.exports = {
  parseMonth,
  getCurrentMonth,
  formatDateForDB,
  dayNames,
  monthNames,
};

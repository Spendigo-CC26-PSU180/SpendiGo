import { useEffect, useState } from 'react';
import { Menu, X, LogOut } from 'lucide-react';
import { analyticsApi } from '../../lib/api';
import { formatRupiah } from '../../lib/utils';
import { auth } from '../../lib/auth';

interface SummaryData {
  total_income: number;
  total_expense: number;
  balance: number;
}

export default function MobileHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [user, setUser] = useState<{ username: string; full_name?: string } | null>(null);

  useEffect(() => {
    // Get user from auth
    const userData = auth.getUser();
    if (userData) {
      setUser(userData);
    }

    // Fetch summary
    const fetchSummary = async () => {
      try {
        const response = await analyticsApi.getSummary();
        setSummary(response.data);
      } catch (error) {
        console.error('Failed to fetch summary:', error);
      }
    };
    fetchSummary();
  }, []);

  const handleLogout = () => {
    auth.logout();
  };

  const balance = summary?.balance ?? 0;
  const income = summary?.total_income ?? 0;
  const expense = summary?.total_expense ?? 0;

  return (
    <>
      {/* Mobile Header Bar */}
      <header className="lg:hidden sticky top-0 z-50 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <a href="/dashboard">
            <img src="/logo.png" alt="SpendiGo" className="h-8 w-auto" />
          </a>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Collapsible Summary */}
        {isOpen && (
          <div className="mt-3 pt-3 border-t border-gray-100 animate-in slide-in-from-top">
            {/* Mini Summary */}
            <div className="bg-gradient-to-br from-primary-50 to-secondary-50 rounded-xl p-3 mb-3">
              <p className="text-xs text-gray-500 mb-1">Saldo Bulan Ini</p>
              <p className={`text-lg font-bold ${balance >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
                {formatRupiah(balance)}
              </p>
              <div className="flex justify-between mt-2 text-xs">
                <span className="text-green-600">+{formatRupiah(income)}</span>
                <span className="text-red-500">-{formatRupiah(expense)}</span>
              </div>
            </div>

            {/* User Info */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-accent-400 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold">
                    {user?.username?.charAt(0).toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {user?.full_name || user?.username || 'User'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </header>
    </>
  );
}

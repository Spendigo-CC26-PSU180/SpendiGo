import type { ReactNode } from 'react';

interface BadgeProps {
  variant?: 'income' | 'expense' | 'info' | 'warning' | 'success';
  children: ReactNode;
  className?: string;
}

export default function Badge({ variant = 'info', children, className = '' }: BadgeProps) {
  const variants = {
    income: 'bg-income-light text-income',
    expense: 'bg-expense-light text-expense',
    info: 'bg-primary-100 text-primary-600',
    warning: 'bg-amber-100 text-amber-700',
    success: 'bg-green-100 text-green-700',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}

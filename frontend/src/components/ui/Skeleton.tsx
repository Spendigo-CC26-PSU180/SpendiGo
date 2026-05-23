interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />
  );
}

export function CardSkeleton() {
  return (
    <div className="card">
      <Skeleton className="h-4 w-24 mb-3" />
      <Skeleton className="h-8 w-32 mb-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function TransactionSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4">
      <Skeleton className="w-12 h-12 rounded-xl" />
      <div className="flex-1">
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-5 w-20" />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="card">
      <Skeleton className="h-5 w-32 mb-4" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

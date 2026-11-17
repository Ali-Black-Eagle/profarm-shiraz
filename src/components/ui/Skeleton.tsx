import React from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('rounded-xl bg-farm-bg-warm animate-pulse', className)}
      {...props}
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="bg-white rounded-3xl border border-farm-border overflow-hidden p-4 space-y-4 shadow-farm"
    >
      <Skeleton className="w-full aspect-square rounded-2xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-10 w-24 rounded-xl" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-3xl border border-farm-border p-5 space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-3xl border border-farm-border p-6 space-y-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div
      aria-hidden="true"
      className="bg-white rounded-3xl border border-farm-border p-5 space-y-3 overflow-hidden"
    >
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, c) => (
          <Skeleton key={`h-${c}`} className="h-4 w-full" />
        ))}
      </div>
      <div className="divide-y divide-farm-bg-warm space-y-2 pt-2">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={`r-${r}`}
            className="grid gap-3 pt-3"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton key={`c-${r}-${c}`} className="h-5 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

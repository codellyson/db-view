import React from 'react';
import { Skeleton as JustSkeleton, cn } from '@codellyson/justui/react';

interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  className,
}) => <JustSkeleton className={cn('bg-border/50', className)} style={{ width, height }} />;

export const SkeletonRow: React.FC<{ className?: string }> = ({ className }) => (
  <Skeleton height="1rem" className={className} />
);

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className,
}) => {
  const widths = ['100%', '85%', '70%', '90%', '60%'];
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={widths[i % widths.length]} height="0.75rem" />
      ))}
    </div>
  );
};
